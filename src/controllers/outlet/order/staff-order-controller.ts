import { Request, Response } from "express";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import {
  generateBillNo,
  generatedOrderId,
  getOrderByOutketId,
  getOrderSessionById,
  getOutletById,
} from "../../../lib/outlet";
import {
  getFetchAllOrderByStaffToRedis,
  getFetchLiveOrderByStaffToRedis,
} from "../../../lib/outlet/get-order";
import { redis } from "../../../services/redis";
import { prismaDB } from "../../..";

import { websocketManager } from "../../../services/ws";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { OrderStatus, OrderType, CashRegister } from "@prisma/client";
import { getYear } from "date-fns";
import { inviteCode, menuCardSchema } from "./orderOutletController";
import { sendNewOrderNotification } from "../../../services/expo-notifications";
import { Kafka } from "kafkajs";

export const getByStaffLiveOrders = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  // @ts-ignore
  const staffId = req?.user?.id;

  // const redisLiveOrder = await redis.get(`liv-o-${outletId}-${staffId}`);

  // if (redisLiveOrder) {
  //   return res.json({
  //     success: true,
  //     liveOrders: JSON.parse(redisLiveOrder),
  //     message: "FETCHED UP ⚡",
  //   });
  // }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const liveOrders = await getFetchLiveOrderByStaffToRedis(outlet.id, staffId);

  return res.json({
    success: true,
    liveOrders,
    message: "Fetching ✅",
  });
};

export const postOrderForStaf = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const validTypes = Object.values(OrderType);

  const {
    staffId,
    username,
    customerId,
    isPaid,
    cashRegisterId,
    isValid,
    phoneNo,
    orderType,
    totalNetPrice,
    gstPrice,
    totalAmount,
    totalGrossProfit,
    orderItems,
    tableId,
    paymentMethod,
    orderMode,
    isSplitPayment,
    splitPayments,
    receivedAmount,
    changeAmount,
  } = req.body;

  if (isValid === true && !phoneNo) {
    throw new BadRequestsException(
      "please provide Phone No",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  console.log(`Payment Method: ${paymentMethod}`);

  // Authorization and basic validation
  // @ts-ignore
  if (staffId !== req.user?.id) {
    throw new BadRequestsException("Invalid Staff", ErrorCode.UNAUTHORIZED);
  }

  // Normal payment validation
  if (isPaid === true && !isSplitPayment && !paymentMethod) {
    throw new BadRequestsException(
      "Please Select Payment Mode",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Split payment validation
  if (isPaid === true && isSplitPayment === true) {
    if (
      !splitPayments ||
      !Array.isArray(splitPayments) ||
      splitPayments.length === 0
    ) {
      throw new BadRequestsException(
        "Split payment selected but no payment details provided",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    // Calculate total amount from split payments
    const totalPaid = splitPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );

    // Validate split payment total matches bill total (allow small difference for rounding)
    if (Math.abs(totalPaid - totalAmount) > 0.1) {
      throw new BadRequestsException(
        `Total split payment amount (${totalPaid.toFixed(
          2
        )}) must equal bill total (${totalAmount.toFixed(2)})`,
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  }

  let cashRegister: CashRegister | null = null;

  if (isPaid === true) {
    const findCashRegister = await prismaDB.cashRegister.findFirst({
      where: { id: cashRegisterId, status: "OPEN" },
    });
    if (!findCashRegister?.id) {
      throw new NotFoundException(
        "Cash Register Not Found",
        ErrorCode.NOT_FOUND
      );
    }
    cashRegister = findCashRegister;
  }

  const [findStaff, getOutlet] = await Promise.all([
    prismaDB.staff.findFirst({ where: { id: staffId } }),
    getOutletById(outletId),
  ]);

  if (!findStaff?.id || !getOutlet?.id) {
    throw new NotFoundException("Unauthorized Access", ErrorCode.NOT_FOUND);
  }

  if (!validTypes.includes(orderType)) {
    throw new BadRequestsException(
      "Invalid Order Type",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (orderType === "DINEIN" && !tableId) {
    throw new BadRequestsException(
      "Table ID is required for DINEIN order type",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Generate IDs
  const [orderId, billNo] = await Promise.all([
    generatedOrderId(getOutlet.id),
    generateBillNo(getOutlet.id),
  ]);
  // Determine order status
  const orderStatus =
    orderMode === "KOT"
      ? "INCOMMING"
      : orderMode === "EXPRESS"
      ? "COMPLETED"
      : orderMode === "READY"
      ? "FOODREADY"
      : "SERVED";

  const result = await prismaDB.$transaction(async (prisma) => {
    let customer;
    if (isValid) {
      customer = await prisma.customerRestaurantAccess.findFirst({
        where: {
          restaurantId: outletId,
          customerId: customerId,
        },
      });
    }
    const orderSession = await prisma.orderSession.create({
      data: {
        active: isPaid === true && orderStatus === "COMPLETED" ? false : true,
        sessionStatus:
          isPaid === true && orderStatus === "COMPLETED"
            ? "COMPLETED"
            : "ONPROGRESS",
        billId: getOutlet?.invoice?.isGSTEnabled
          ? `${getOutlet?.invoice?.prefix}${
              getOutlet?.invoice?.invoiceNo
            }/${getYear(new Date())}`
          : billNo,
        orderType: orderType,
        username: username ?? findStaff.name,
        phoneNo: phoneNo ?? null,
        staffId: findStaff.id,
        customerId: isValid === true ? customer?.id : null,
        paymentMethod: isPaid
          ? isSplitPayment
            ? "SPLIT"
            : paymentMethod
          : null,
        tableId: tableId,
        isPaid: isPaid,
        restaurantId: getOutlet.id,
        createdBy: `${findStaff?.name}-(${findStaff?.role})`,
        subTotal: isPaid ? totalAmount : null,
        amountReceived:
          isPaid && !isSplitPayment && receivedAmount ? receivedAmount : null,
        change: isPaid && !isSplitPayment && changeAmount ? changeAmount : null,
        isSplitPayment: isPaid && isSplitPayment ? true : false,
        splitPayments:
          isPaid && isSplitPayment && splitPayments
            ? {
                create: splitPayments.map((payment: any) => ({
                  method: payment.method,
                  amount: Number(payment.amount),
                  note: `Part of split payment for bill #${billNo}`,
                  createdBy: `${findStaff?.name} (${findStaff?.role})`,
                })),
              }
            : undefined,
        orders: {
          create: {
            restaurantId: getOutlet.id,
            staffId: staffId,
            createdBy: `${findStaff?.name}-(${findStaff?.role})`,
            isPaid: isPaid,
            active: true,
            orderStatus:
              isPaid === true && orderStatus === "COMPLETED"
                ? "COMPLETED"
                : orderStatus,
            totalNetPrice: totalNetPrice,
            gstPrice: gstPrice,
            totalAmount: totalAmount,
            totalGrossProfit: totalGrossProfit,
            generatedOrderId: orderId,
            orderType: orderType,
            paymentMethod: isPaid
              ? isSplitPayment
                ? "SPLIT"
                : paymentMethod
              : null,
            orderItems: {
              create: orderItems?.map((item: any) => ({
                menuId: item?.menuId,
                name: item?.menuItem?.name,
                strike: false,
                isVariants: item?.menuItem?.isVariants,
                originalRate: item?.originalPrice,
                quantity: item?.quantity,
                netPrice: item?.netPrice.toString(),
                gst: item?.gst,
                grossProfit: item?.grossProfit,
                totalPrice: item?.price,
                selectedVariant: item?.sizeVariantsId
                  ? {
                      create: {
                        sizeVariantId: item?.sizeVariantsId,
                        name: item?.menuItem?.menuItemVariants?.find(
                          (variant: any) => variant?.id === item?.sizeVariantsId
                        )?.variantName,
                        type: item?.menuItem?.menuItemVariants?.find(
                          (variant: any) => variant?.id === item?.sizeVariantsId
                        )?.type,
                        price: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.price as string
                        ),
                        gst: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.gst
                        ),
                        netPrice: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.netPrice as string
                        ).toString(),
                        grossProfit: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.grossProfit
                        ),
                      },
                    }
                  : undefined,
                addOnSelected: {
                  create: item?.addOnSelected?.map((addon: any) => {
                    const groupAddOn = item?.menuItem?.menuGroupAddOns?.find(
                      (gAddon: any) => gAddon?.id === addon?.id
                    );
                    return {
                      addOnId: addon?.id,
                      name: groupAddOn?.addOnGroupName,
                      selectedAddOnVariantsId: {
                        create: addon?.selectedVariantsId?.map(
                          (addOnVariant: any) => {
                            const matchedVaraint =
                              groupAddOn?.addonVariants?.find(
                                (variant: any) =>
                                  variant?.id === addOnVariant?.id
                              );
                            return {
                              selectedAddOnVariantId: addOnVariant?.id,
                              name: matchedVaraint?.name,
                              type: matchedVaraint?.type,
                              price: Number(matchedVaraint?.price),
                              gst: Number(
                                item?.menuItem.menuItemVariants.find(
                                  (v: any) => v?.id === item?.sizeVariantsId
                                )?.gst
                              ),
                              netPrice: Number(
                                item?.menuItem.menuItemVariants.find(
                                  (v: any) => v?.id === item?.sizeVariantsId
                                )?.netPrice as string
                              ).toString(),
                              grossProfit: Number(
                                item?.menuItem.menuItemVariants.find(
                                  (v: any) => v?.id === item?.sizeVariantsId
                                )?.grossProfit
                              ),
                            };
                          }
                        ),
                      },
                    };
                  }),
                },
              })),
            },
          },
        },
      },
    });

    // Update raw material stock if `chooseProfit` is "itemRecipe"
    await Promise.all(
      orderItems.map(async (item: any) => {
        const menuItem = await prisma.menuItem.findUnique({
          where: { id: item.menuId, restaurantId: outletId },
          include: { itemRecipe: { include: { ingredients: true } } },
        });

        if (menuItem?.chooseProfit === "itemRecipe" && menuItem.itemRecipe) {
          await Promise.all(
            menuItem.itemRecipe.ingredients.map(async (ingredient) => {
              const rawMaterial = await prisma.rawMaterial.findUnique({
                where: { id: ingredient.rawMaterialId, restaurantId: outletId },
              });

              if (rawMaterial) {
                let decrementStock = 0;

                // Check if the ingredient's unit matches the purchase unit or consumption unit
                if (ingredient.unitId === rawMaterial.minimumStockLevelUnit) {
                  // If MOU is linked to purchaseUnit, multiply directly with quantity
                  decrementStock =
                    Number(ingredient.quantity) * Number(item.quantity || 1);
                } else if (
                  ingredient.unitId === rawMaterial.consumptionUnitId
                ) {
                  // If MOU is linked to consumptionUnit, apply conversion factor
                  decrementStock =
                    (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                    Number(rawMaterial.conversionFactor || 1);
                } else {
                  // Default fallback if MOU doesn't match either unit
                  decrementStock =
                    (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                    Number(rawMaterial.conversionFactor || 1);
                }

                if (Number(rawMaterial.currentStock) < decrementStock) {
                  throw new BadRequestsException(
                    `Insufficient stock for raw material: ${rawMaterial.name}`,
                    ErrorCode.UNPROCESSABLE_ENTITY
                  );
                }

                await prisma.rawMaterial.update({
                  where: { id: rawMaterial.id, restaurantId: outletId },
                  data: {
                    currentStock:
                      Number(rawMaterial.currentStock) - Number(decrementStock),
                  },
                });
              }
            })
          );
        }
      })
    );

    if (tableId) {
      const table = await prisma.table.findFirst({
        where: { id: tableId, restaurantId: getOutlet.id },
      });

      if (!table) {
        throw new NotFoundException("No Table found", ErrorCode.NOT_FOUND);
      }

      await prisma.table.update({
        where: { id: table.id, restaurantId: getOutlet.id },
        data: {
          occupied: true,
          inviteCode: inviteCode(),
          currentOrderSessionId: orderSession.id,
        },
      });
    }

    await prisma.notification.create({
      data: {
        restaurantId: getOutlet.id,
        orderId: orderId,
        message: "You have a new Order",
        orderType: tableId ? "DINEIN" : orderType,
      },
    });

    if (getOutlet?.invoice?.id) {
      await prisma.invoice.update({
        where: {
          restaurantId: getOutlet.id,
        },
        data: {
          invoiceNo: { increment: 1 },
        },
      });
    }

    if (isPaid && cashRegister?.id) {
      const registerIdString = cashRegister.id; // Ensure we have a string value

      if (isSplitPayment && splitPayments && splitPayments.length > 0) {
        // Create multiple cash transactions for split payments
        await Promise.all(
          splitPayments.map(async (payment: any) => {
            await prismaDB.cashTransaction.create({
              data: {
                registerId: registerIdString,
                amount: Number(payment.amount),
                type: "CASH_IN",
                source: "ORDER",
                description: `Split Payment (${payment.method}) - #${orderSession.billId} - ${orderSession.orderType} - ${orderItems?.length} x Items`,
                paymentMethod: payment.method,
                performedBy: staffId,
                orderId: orderSession.id,
                referenceId: orderSession.id, // Add reference ID for easier tracing
              },
            });
          })
        );
      } else {
        // Create a single cash transaction for regular payment
        await prismaDB.cashTransaction.create({
          data: {
            registerId: registerIdString,
            amount: totalAmount,
            type: "CASH_IN",
            source: "ORDER",
            description: `Order Sales - #${orderSession.billId} - ${orderSession.orderType} - ${orderItems?.length} x Items`,
            paymentMethod: paymentMethod,
            performedBy: staffId,
            orderId: orderSession.id,
            referenceId: orderSession.id, // Add reference ID for easier tracing
          },
        });
      }
    }

    // Delete any LOW_STOCK alerts for this restaurant
    await prisma.alert.deleteMany({
      where: {
        restaurantId: getOutlet.id,
        type: "LOW_STOCK",
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
      },
    });

    if (orderType === "DINEIN" && orderSession?.tableId) {
      await sendNewOrderNotification({
        restaurantId: outletId,
        orderId: orderId,
        orderNumber: orderId,
        customerName: orderSession?.username,
        tableId: orderSession?.tableId,
      });
    }

    return orderSession;
  });
  // Post-transaction tasks
  await Promise.all([
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
    redis.del(`liv-o-${outletId}-${staffId}`),
    redis.del(`${outletId}-all-items-online-and-delivery`),
    redis.del(`${outletId}-all-items`),
  ]);

  websocketManager.notifyClients(getOutlet?.id, "NEW_ORDER_SESSION_CREATED");

  return res.json({
    success: true,
    orderSessionId: result.id,
    billId: result?.billId,
    kotNumber: orderId,
    message: "Order Created from Captain ✅",
  });
};

export const postOrderForStafUsingQueue = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const validTypes = Object.values(OrderType);

  const {
    staffId,
    username,
    customerId,
    isPaid,
    cashRegisterId,
    isValid,
    phoneNo,
    orderType,
    totalNetPrice,
    gstPrice,
    totalAmount,
    totalGrossProfit,
    orderItems,
    tableId,
    paymentMethod,
    orderMode,
    isSplitPayment,
    splitPayments,
    receivedAmount,
    changeAmount,
  } = req.body;

  if (isValid === true && !phoneNo) {
    throw new BadRequestsException(
      "please provide Phone No",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Authorization and basic validation
  // @ts-ignore
  if (staffId !== req.user?.id) {
    throw new BadRequestsException("Invalid Staff", ErrorCode.UNAUTHORIZED);
  }

  // Normal payment validation
  if (isPaid === true && !isSplitPayment && !paymentMethod) {
    throw new BadRequestsException(
      "Please Select Payment Mode",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Split payment validation
  if (isPaid === true && isSplitPayment === true) {
    if (
      !splitPayments ||
      !Array.isArray(splitPayments) ||
      splitPayments.length === 0
    ) {
      throw new BadRequestsException(
        "Split payment selected but no payment details provided",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    // Calculate total amount from split payments
    const totalPaid = splitPayments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );

    // Validate split payment total matches bill total (allow small difference for rounding)
    if (Math.abs(totalPaid - totalAmount) > 0.1) {
      throw new BadRequestsException(
        `Total split payment amount (${totalPaid.toFixed(
          2
        )}) must equal bill total (${totalAmount.toFixed(2)})`,
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  }

  if (!validTypes.includes(orderType)) {
    throw new BadRequestsException(
      "Invalid Order Type",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (orderType === "DINEIN" && !tableId) {
    throw new BadRequestsException(
      "Table ID is required for DINEIN order type",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  let cashRegister: CashRegister | null = null;

  if (isPaid === true) {
    const findCashRegister = await prismaDB.cashRegister.findFirst({
      where: { id: cashRegisterId, status: "OPEN" },
    });
    if (!findCashRegister?.id) {
      throw new NotFoundException(
        "Cash Register Not Found",
        ErrorCode.NOT_FOUND
      );
    }
    cashRegister = findCashRegister;
  }

  const [findStaff, getOutlet] = await Promise.all([
    prismaDB.staff.findFirst({ where: { id: staffId } }),
    getOutletById(outletId),
  ]);

  if (!findStaff?.id || !getOutlet?.id) {
    throw new NotFoundException("Unauthorized Access", ErrorCode.NOT_FOUND);
  }

  // Generate IDs
  const [orderId, billNo] = await Promise.all([
    generatedOrderId(getOutlet.id),
    generateBillNo(getOutlet.id),
  ]);

  // Determine order status
  const orderStatus =
    orderMode === "KOT"
      ? "INCOMMING"
      : orderMode === "EXPRESS"
      ? "COMPLETED"
      : orderMode === "READY"
      ? "FOODREADY"
      : "SERVED";

  const result = await prismaDB.$transaction(async (prisma) => {
    let customer;
    if (isValid) {
      customer = await prisma.customerRestaurantAccess.findFirst({
        where: {
          restaurantId: outletId,
          customerId: customerId,
        },
      });
    }
    const orderSession = await prisma.orderSession.create({
      data: {
        active: isPaid === true && orderStatus === "COMPLETED" ? false : true,
        sessionStatus:
          isPaid === true && orderStatus === "COMPLETED"
            ? "COMPLETED"
            : "ONPROGRESS",
        billId: getOutlet?.invoice?.isGSTEnabled
          ? `${getOutlet?.invoice?.prefix}${
              getOutlet?.invoice?.invoiceNo
            }/${getYear(new Date())}`
          : billNo,
        orderType: orderType,
        username: username ?? findStaff.name,
        phoneNo: phoneNo ?? null,
        staffId: findStaff.id,
        customerId: isValid === true ? customer?.id : null,
        paymentMethod: isPaid && !isSplitPayment ? paymentMethod : null,
        tableId: tableId,
        isPaid: isPaid,
        restaurantId: getOutlet.id,
        createdBy: `${findStaff?.name} (${findStaff?.role})`,
        subTotal: isPaid ? totalAmount : null,
        amountReceived:
          isPaid && !isSplitPayment && receivedAmount ? receivedAmount : null,
        change: isPaid && !isSplitPayment && changeAmount ? changeAmount : null,
        isSplitPayment: isPaid && isSplitPayment ? true : false,
        splitPayments:
          isPaid && isSplitPayment && splitPayments
            ? {
                create: splitPayments.map((payment: any) => ({
                  method: payment.method,
                  amount: Number(payment.amount),
                  note: `Part of split payment for bill #${billNo}`,
                  createdBy: `${findStaff?.name} (${findStaff?.role})`,
                })),
              }
            : undefined,
        orders: {
          create: {
            restaurantId: getOutlet.id,
            staffId: staffId,
            createdBy: `${findStaff?.name} (${findStaff?.role})`,
            isPaid: isPaid,
            active: true,
            orderStatus:
              isPaid === true && orderStatus === "COMPLETED"
                ? "COMPLETED"
                : orderStatus,
            totalNetPrice: totalNetPrice,
            gstPrice: gstPrice,
            totalAmount: totalAmount,
            totalGrossProfit: totalGrossProfit,
            generatedOrderId: orderId,
            orderType: orderType,
            paymentMethod: isPaid && !isSplitPayment ? paymentMethod : null,
            orderItems: {
              create: orderItems?.map((item: any) => ({
                menuId: item?.menuId,
                name: item?.menuItem?.name,
                strike: false,
                isVariants: item?.menuItem?.isVariants,
                originalRate: item?.originalPrice,
                quantity: item?.quantity,
                netPrice: item?.netPrice.toString(),
                gst: item?.gst,
                grossProfit: item?.grossProfit,
                totalPrice: item?.price,
                selectedVariant: item?.sizeVariantsId
                  ? {
                      create: {
                        sizeVariantId: item?.sizeVariantsId,
                        name: item?.menuItem?.menuItemVariants?.find(
                          (variant: any) => variant?.id === item?.sizeVariantsId
                        )?.variantName,
                        type: item?.menuItem?.menuItemVariants?.find(
                          (variant: any) => variant?.id === item?.sizeVariantsId
                        )?.type,
                        price: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.price as string
                        ),
                        gst: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.gst
                        ),
                        netPrice: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.netPrice as string
                        ).toString(),
                        grossProfit: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.grossProfit
                        ),
                      },
                    }
                  : undefined,
                addOnSelected: {
                  create: item?.addOnSelected?.map((addon: any) => {
                    const groupAddOn = item?.menuItem?.menuGroupAddOns?.find(
                      (gAddon: any) => gAddon?.id === addon?.id
                    );
                    return {
                      addOnId: addon?.id,
                      name: groupAddOn?.addOnGroupName,
                      selectedAddOnVariantsId: {
                        create: addon?.selectedVariantsId?.map(
                          (addOnVariant: any) => {
                            const matchedVaraint =
                              groupAddOn?.addonVariants?.find(
                                (variant: any) =>
                                  variant?.id === addOnVariant?.id
                              );
                            return {
                              selectedAddOnVariantId: addOnVariant?.id,
                              name: matchedVaraint?.name,
                              type: matchedVaraint?.type,
                              price: Number(matchedVaraint?.price),
                              gst: Number(
                                item?.menuItem.menuItemVariants.find(
                                  (v: any) => v?.id === item?.sizeVariantsId
                                )?.gst
                              ),
                              netPrice: Number(
                                item?.menuItem.menuItemVariants.find(
                                  (v: any) => v?.id === item?.sizeVariantsId
                                )?.netPrice as string
                              ).toString(),
                              grossProfit: Number(
                                item?.menuItem.menuItemVariants.find(
                                  (v: any) => v?.id === item?.sizeVariantsId
                                )?.grossProfit
                              ),
                            };
                          }
                        ),
                      },
                    };
                  }),
                },
              })),
            },
          },
        },
      },
    });

    if (tableId) {
      const table = await prisma.table.findFirst({
        where: { id: tableId, restaurantId: getOutlet.id },
      });

      if (!table) {
        throw new NotFoundException("No Table found", ErrorCode.NOT_FOUND);
      }

      await prisma.table.update({
        where: { id: table.id, restaurantId: getOutlet.id },
        data: {
          occupied: true,
          inviteCode: inviteCode(),
          currentOrderSessionId: orderSession.id,
        },
      });
    }

    await prisma.notification.create({
      data: {
        restaurantId: getOutlet.id,
        orderId: orderId,
        message: "You have a new Order",
        orderType: tableId ? "DINEIN" : orderType,
      },
    });

    if (getOutlet?.invoice?.id) {
      await prisma.invoice.update({
        where: {
          restaurantId: getOutlet.id,
        },
        data: {
          invoiceNo: { increment: 1 },
        },
      });
    }

    if (isPaid && cashRegister?.id) {
      const registerIdString = cashRegister.id; // Ensure we have a string value

      if (isSplitPayment && splitPayments && splitPayments.length > 0) {
        // Create multiple cash transactions for split payments
        await Promise.all(
          splitPayments.map(async (payment: any) => {
            await prismaDB.cashTransaction.create({
              data: {
                registerId: registerIdString,
                amount: Number(payment.amount),
                type: "CASH_IN",
                source: "ORDER",
                description: `Split Payment (${payment.method}) - #${orderSession.billId} - ${orderSession.orderType} - ${orderItems?.length} x Items`,
                paymentMethod: payment.method,
                performedBy: staffId,
                orderId: orderSession.id,
                referenceId: orderSession.id, // Add reference ID for easier tracing
              },
            });
          })
        );
      } else {
        // Create a single cash transaction for regular payment
        await prismaDB.cashTransaction.create({
          data: {
            registerId: registerIdString,
            amount: totalAmount,
            type: "CASH_IN",
            source: "ORDER",
            description: `Order Sales - #${orderSession.billId} - ${orderSession.orderType} - ${orderItems?.length} x Items`,
            paymentMethod: paymentMethod,
            performedBy: staffId,
            orderId: orderSession.id,
            referenceId: orderSession.id, // Add reference ID for easier tracing
          },
        });
      }
    }

    // Delete any LOW_STOCK alerts for this restaurant
    await prisma.alert.deleteMany({
      where: {
        restaurantId: getOutlet.id,
        type: "LOW_STOCK",
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
      },
    });

    if (orderType === "DINEIN" && orderSession?.tableId) {
      await sendNewOrderNotification({
        restaurantId: outletId,
        orderId: orderId,
        orderNumber: orderId,
        customerName: orderSession?.username,
        tableId: orderSession?.tableId,
      });
    }

    return orderSession;
  });
  // Post-transaction tasks
  await Promise.all([
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
    redis.del(`liv-o-${outletId}-${staffId}`),
    redis.del(`${outletId}-all-items-online-and-delivery`),
    redis.del(`${outletId}-all-items`),
  ]);

  websocketManager.notifyClients(getOutlet?.id, "NEW_ORDER_SESSION_CREATED");

  return res.json({
    success: true,
    orderSessionId: result.id,
    kotNumber: orderId,
    message: "Order Created from Captain ✅",
  });
};

export const existingOrderPatchForStaff = async (
  req: Request,
  res: Response
) => {
  const { outletId, orderId } = req.params;

  const {
    staffId,
    isPaid,
    totalNetPrice,
    gstPrice,
    totalAmount,
    totalGrossProfit,
    orderItems,
    orderMode,
  } = req.body;

  // @ts-ignore
  if (staffId !== req.user?.id) {
    throw new BadRequestsException("Invalid User", ErrorCode.UNAUTHORIZED);
  }

  const findStaff = await prismaDB.staff.findFirst({
    where: {
      id: staffId,
    },
  });

  if (!findStaff?.id) {
    throw new BadRequestsException(
      "You Need to login & place the order",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!outletId) {
    throw new BadRequestsException(
      "Outlet Id is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const getOrder = await getOrderSessionById(getOutlet.id, orderId);

  if (!getOrder?.id) {
    throw new NotFoundException(
      "No Current Order to Add Items",
      ErrorCode.NOT_FOUND
    );
  }

  const generatedId = await generatedOrderId(getOutlet?.id);

  const orderStatus =
    orderMode === "KOT"
      ? "INCOMMING"
      : orderMode === "EXPRESS"
      ? "FOODREADY"
      : "SERVED";

  await prismaDB.$transaction(async (tx) => {
    await tx.orderSession.update({
      where: {
        restaurantId: getOutlet.id,
        id: getOrder.id,
      },
      data: {
        orderType: getOrder.orderType,
        isPaid: isPaid,
        restaurantId: getOutlet.id,
        orders: {
          create: {
            active: true,
            staffId: findStaff.id,
            restaurantId: getOutlet.id,
            isPaid: isPaid,
            orderStatus: orderStatus,
            totalNetPrice: totalNetPrice,
            gstPrice: gstPrice,
            totalAmount: totalAmount,
            totalGrossProfit: totalGrossProfit,
            generatedOrderId: generatedId,
            orderType: getOrder.orderType,
            createdBy: `${findStaff?.name}-(${findStaff?.role})`,
            orderItems: {
              create: orderItems?.map((item: any) => ({
                menuId: item?.menuId,
                name: item?.menuItem?.name,
                strike: false,
                isVariants: item?.menuItem?.isVariants,
                originalRate: item?.originalPrice,
                quantity: item?.quantity,
                netPrice: item?.netPrice.toString(),
                gst: item?.gst,
                grossProfit: item?.grossProfit,
                totalPrice: item?.price,
                selectedVariant: item?.sizeVariantsId
                  ? {
                      create: {
                        sizeVariantId: item?.sizeVariantsId,
                        name: item?.menuItem?.menuItemVariants?.find(
                          (variant: any) => variant?.id === item?.sizeVariantsId
                        )?.variantName,
                        type: item?.menuItem?.menuItemVariants?.find(
                          (variant: any) => variant?.id === item?.sizeVariantsId
                        )?.type,
                        price: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.price as string
                        ),
                        gst: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.gst
                        ),
                        netPrice: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.netPrice as string
                        ).toString(),
                        grossProfit: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.grossProfit
                        ),
                      },
                    }
                  : undefined,
                addOnSelected: {
                  create: item?.addOnSelected?.map((addon: any) => {
                    const groupAddOn = item?.menuItem?.menuGroupAddOns?.find(
                      (gAddon: any) => gAddon?.id === addon?.id
                    );
                    return {
                      addOnId: addon?.id,
                      name: groupAddOn?.addOnGroupName,
                      selectedAddOnVariantsId: {
                        create: addon?.selectedVariantsId?.map(
                          (addOnVariant: any) => {
                            const matchedVaraint =
                              groupAddOn?.addonVariants?.find(
                                (variant: any) =>
                                  variant?.id === addOnVariant?.id
                              );
                            return {
                              selectedAddOnVariantId: addOnVariant?.id,
                              name: matchedVaraint?.name,
                              type: matchedVaraint?.type,
                              price: Number(matchedVaraint?.price),
                            };
                          }
                        ),
                      },
                    };
                  }),
                },
              })),
            },
          },
        },
      },
    });
    // Update raw material stock if `chooseProfit` is "itemRecipe"
    await Promise.all([
      orderItems.map(async (item: any) => {
        const menuItem = await tx.menuItem.findUnique({
          where: { id: item.menuId },
          include: { itemRecipe: { include: { ingredients: true } } },
        });

        if (menuItem?.chooseProfit === "itemRecipe" && menuItem.itemRecipe) {
          await Promise.all(
            menuItem.itemRecipe.ingredients.map(async (ingredient) => {
              const rawMaterial = await tx.rawMaterial.findUnique({
                where: { id: ingredient.rawMaterialId },
              });

              if (rawMaterial) {
                let decrementStock = 0;

                // Check if the ingredient's unit matches the purchase unit or consumption unit
                if (ingredient.unitId === rawMaterial.minimumStockLevelUnit) {
                  // If MOU is linked to purchaseUnit, multiply directly with quantity
                  decrementStock =
                    Number(ingredient.quantity) * Number(item.quantity || 1);
                } else if (
                  ingredient.unitId === rawMaterial.consumptionUnitId
                ) {
                  // If MOU is linked to consumptionUnit, apply conversion factor
                  decrementStock =
                    (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                    Number(rawMaterial.conversionFactor || 1);
                } else {
                  // Default fallback if MOU doesn't match either unit
                  decrementStock =
                    (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                    Number(rawMaterial.conversionFactor || 1);
                }

                if (Number(rawMaterial.currentStock) < decrementStock) {
                  throw new BadRequestsException(
                    `Insufficient stock for raw material: ${rawMaterial.name}`,
                    ErrorCode.UNPROCESSABLE_ENTITY
                  );
                }

                await tx.rawMaterial.update({
                  where: { id: rawMaterial.id },
                  data: {
                    currentStock:
                      Number(rawMaterial.currentStock) - Number(decrementStock),
                  },
                });
              }
            })
          );
        }
      }),
      redis.del(`${outletId}-all-items-online-and-delivery`),
      redis.del(`${outletId}-all-items`),
    ]);
  });

  await prismaDB.notification.create({
    data: {
      restaurantId: getOutlet.id,
      orderId: generatedId,
      message: "You have a new Order",
      orderType:
        getOrder.orderType === "DINEIN"
          ? getOrder.table?.name
          : getOrder.orderType,
    },
  });

  if (getOrder?.orderType === "DINEIN" && getOrder?.tableId) {
    await sendNewOrderNotification({
      restaurantId: getOutlet.id,
      orderId: orderId,
      orderNumber: orderId,
      customerName: getOrder?.username,
      tableId: getOrder?.tableId,
    });
  }
  // Delete any LOW_STOCK alerts for this restaurant
  await prismaDB.alert.deleteMany({
    where: {
      restaurantId: getOutlet.id,
      type: "LOW_STOCK",
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
    },
  });

  await Promise.all([
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
    redis.del(`liv-o-${outletId}-${staffId}`),
  ]);

  websocketManager.notifyClients(getOutlet?.id, "NEW_ORDER_SESSION_UPDATED");

  return res.json({
    success: true,
    orderSessionId: orderId,
    billNo: getOrder?.billId,
    kotNumber: generatedId,
    message: "Order Added from Captain ✅",
  });
};

export const orderItemModificationByStaff = async (
  req: Request,
  res: Response
) => {
  const { orderId, outletId } = req.params;
  const { data: validateFields, error } = menuCardSchema.safeParse(req.body);
  // @ts-ignore
  const staffId = req.user?.id;

  if (!staffId) {
    throw new BadRequestsException("Invalid Staff", ErrorCode.UNAUTHORIZED);
  }

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getOrderById = await prismaDB.orderItem.findFirst({
    where: {
      id: orderId,
      order: {
        restaurantId: outletId,
        staffId: staffId,
      },
    },
    include: {
      order: {
        include: {
          orderItems: true,
          orderSession: true,
        },
      },
      menuItem: {
        include: {
          menuItemVariants: {
            include: {
              variant: true,
            },
          },
          menuGroupAddOns: {
            include: {
              addOnGroups: true,
            },
          },
          itemRecipe: {
            include: {
              ingredients: true,
            },
          },
        },
      },
      selectedVariant: true,
      addOnSelected: true,
    },
  });

  if (!getOrderById?.id) {
    throw new NotFoundException(
      "No Order Found to Update",
      ErrorCode.NOT_FOUND
    );
  }

  const txs = await prismaDB.$transaction(async (prisma) => {
    // If menuItem's chooseProfit is "itemRecipe", update raw material stock
    if (
      getOrderById.menuItem?.chooseProfit === "itemRecipe" &&
      getOrderById.menuItem.itemRecipe
    ) {
      // Calculate the difference in quantity
      const oldQuantity = getOrderById.quantity;
      const newQuantity = validateFields?.quantity;
      const quantityDiff = newQuantity - oldQuantity;

      // If quantity has changed, update raw material stock
      if (quantityDiff !== 0) {
        for (const ingredient of getOrderById.menuItem.itemRecipe.ingredients) {
          const rawMaterial = await prisma.rawMaterial.findUnique({
            where: { id: ingredient.rawMaterialId },
          });

          if (rawMaterial) {
            let stockAdjustment = 0;

            // Check if the ingredient's unit matches the purchase unit or consumption unit
            if (ingredient.unitId === rawMaterial.minimumStockLevelUnit) {
              // If MOU is linked to purchaseUnit, multiply directly with quantity difference
              stockAdjustment = Number(ingredient.quantity) * quantityDiff;
            } else if (ingredient.unitId === rawMaterial.consumptionUnitId) {
              // If MOU is linked to consumptionUnit, apply conversion factor
              stockAdjustment =
                (Number(ingredient.quantity) * quantityDiff) /
                Number(rawMaterial.conversionFactor || 1);
            } else {
              // Default fallback if MOU doesn't match either unit
              stockAdjustment =
                (Number(ingredient.quantity) * quantityDiff) /
                Number(rawMaterial.conversionFactor || 1);
            }

            // Check if the stock would go negative after adjustment
            const newStockLevel =
              Number(rawMaterial.currentStock) - Number(stockAdjustment);
            if (newStockLevel < 0) {
              throw new BadRequestsException(
                `Insufficient stock for raw material: ${
                  rawMaterial.name
                }. Current stock: ${
                  rawMaterial.currentStock
                }, Required: ${Math.abs(stockAdjustment)}`,
                ErrorCode.UNPROCESSABLE_ENTITY
              );
            }

            // If quantity increased, decrement stock; if decreased, increment stock
            await prisma.rawMaterial.update({
              where: { id: rawMaterial.id },
              data: {
                currentStock: newStockLevel,
              },
            });
          }
        }
      }
    }

    await prisma.orderItem.update({
      where: {
        id: getOrderById.id,
        order: { restaurantId: outlet.id },
      },
      data: {
        quantity: validateFields?.quantity,
        selectedVariant: validateFields.selectedVariantId
          ? {
              update: {
                where: {
                  id: getOrderById?.selectedVariant?.id,
                },
                data: {
                  sizeVariantId: validateFields?.selectedVariantId,
                  name: getOrderById?.menuItem.menuItemVariants.find(
                    (v) => v?.id === validateFields?.selectedVariantId
                  )?.variant?.name,
                  price: parseFloat(
                    getOrderById?.menuItem.menuItemVariants.find(
                      (v) => v?.id === validateFields?.selectedVariantId
                    )?.price as string
                  ),
                  gst: Number(
                    getOrderById?.menuItem.menuItemVariants.find(
                      (v) => v?.id === validateFields?.selectedVariantId
                    )?.gst
                  ),
                  netPrice: parseFloat(
                    getOrderById?.menuItem.menuItemVariants.find(
                      (v) => v?.id === validateFields?.selectedVariantId
                    )?.netPrice as string
                  ).toString(),
                  grossProfit: Number(
                    getOrderById?.menuItem.menuItemVariants.find(
                      (v) => v?.id === validateFields?.selectedVariantId
                    )?.grossProfit
                  ),
                },
              },
            }
          : undefined,
        netPrice: !getOrderById?.isVariants
          ? Number(getOrderById?.menuItem?.netPrice as string).toString()
          : Number(
              getOrderById?.menuItem.menuItemVariants.find(
                (v) => v?.id === validateFields?.selectedVariantId
              )?.netPrice as string
            ).toString(),
        originalRate: !getOrderById?.isVariants
          ? Number(getOrderById?.menuItem?.price as string)
          : Number(
              getOrderById?.menuItem.menuItemVariants.find(
                (v) => v?.id === validateFields?.selectedVariantId
              )?.price as string
            ),
        grossProfit: !getOrderById?.isVariants
          ? Number(getOrderById?.menuItem?.grossProfit)
          : Number(
              getOrderById?.menuItem.menuItemVariants.find(
                (v) => v?.id === validateFields?.selectedVariantId
              )?.grossProfit
            ),
        gst: !getOrderById?.isVariants
          ? getOrderById?.menuItem?.gst
          : getOrderById?.menuItem.menuItemVariants.find(
              (v) => v?.id === validateFields?.selectedVariantId
            )?.gst,
        totalPrice: validateFields?.totalPrice,
      },
    });

    const getOrder = await prisma.orderItem.findFirst({
      where: {
        id: orderId,
        order: {
          restaurantId: outletId,
        },
      },
      include: {
        order: {
          include: {
            orderItems: true,
            orderSession: true,
          },
        },
      },
    });

    if (!getOrder?.id) {
      throw new NotFoundException(
        "No Order Found to Update",
        ErrorCode.NOT_FOUND
      );
    }

    // Recalculate the totals for the order
    const updatedOrderItems = getOrder.order.orderItems;

    const totalGrossProfit = updatedOrderItems.reduce(
      (total, item) =>
        total +
        (Number(Number(item.grossProfit) * Number(item?.quantity)) || 0),
      0
    );
    const totalNetPrice = updatedOrderItems.reduce(
      (total, item) =>
        total +
        (Number(Number(item.netPrice as string) * Number(item?.quantity)) || 0),
      0
    );
    const gstPrice = updatedOrderItems.reduce(
      (total, item) =>
        total +
        ((Number(item.originalRate) *
          Number(item.gst) *
          Number(item.quantity)) /
          100 || 0),
      0
    );
    const totalAmount = updatedOrderItems.reduce(
      (total, item) => total + item.totalPrice,
      0
    );

    // Update the order with recalculated values
    await prisma.order.update({
      where: {
        id: getOrder.order.id,
      },
      data: {
        totalGrossProfit,
        totalNetPrice,
        gstPrice,
        totalAmount: totalAmount,
      },
    });

    // Delete any alerts linked to this order
    await prisma.alert.deleteMany({
      where: {
        restaurantId: outlet.id,
        OR: [
          {
            orderId: getOrder.order.id,
            status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
          },
          {
            type: "LOW_STOCK",
            status: { in: ["PENDING", "ACKNOWLEDGED"] },
          },
        ],
      },
    });
  });

  await Promise.all([
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
    redis.del(`liv-o-${outletId}-${staffId}`),
    redis.del(`${outletId}-all-items-online-and-delivery`),
    redis.del(`${outletId}-all-items`),
  ]);

  return res.json({
    success: true,
    message: "Order Item Updated Success By Staff ✅",
  });
};

export const getByStaffAllOrders = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  // @ts-ignore
  const staffId = req?.user?.id;

  // const redisLiveOrder = await redis.get(
  //   `all-staff-orders-${outletId}-${staffId}`
  // );

  // if (redisLiveOrder) {
  //   return res.json({
  //     success: true,
  //     orders: JSON.parse(redisLiveOrder),
  //     message: "FETCHED UP ⚡",
  //   });
  // }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const orders = await getFetchAllOrderByStaffToRedis(outlet.id, staffId);

  return res.json({
    success: true,
    orders,
    message: "Fetching ✅",
  });
};

export const orderStatusPatchByStaff = async (req: Request, res: Response) => {
  const { orderId, outletId } = req.params;
  // @ts-ignore
  const staffId = req.user?.id;

  const validTypes = Object.values(OrderStatus);
  const { orderStatus } = req.body;

  if (!validTypes.includes(orderStatus)) {
    throw new BadRequestsException(
      "OrderStatus is Invalid",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getOrderById = await getOrderByOutketId(outlet.id, orderId);

  if (!getOrderById?.id) {
    throw new NotFoundException(
      "No Order Found to Update",
      ErrorCode.NOT_FOUND
    );
  }

  await prismaDB.order.updateMany({
    where: {
      id: getOrderById.id,
      restaurantId: outlet.id,
    },
    data: {
      orderStatus: orderStatus,
    },
  });

  // Update related alerts to resolved
  await prismaDB.alert.deleteMany({
    where: {
      restaurantId: outlet.id,
      orderId: orderId,
      status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
    },
  });

  const alerts = await prismaDB.alert.findMany({
    where: {
      restaurantId: outletId,
      status: {
        in: ["PENDING"],
      },
    },
    select: {
      id: true,
      type: true,
      status: true,
      priority: true,
      href: true,
      message: true,
      createdAt: true,
    },
  });
  websocketManager.notifyClients(outletId, "NEW_ALERT");

  await redis.set(`alerts-${outletId}`, JSON.stringify(alerts));

  await Promise.all([
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
    redis.del(`liv-o-${outletId}-${staffId}`),
  ]);

  websocketManager.notifyClients(outlet?.id, "ORDER_UPDATED");

  return res.json({
    success: true,
    message: "Order Status Update Success By Staff ✅",
  });
};

//stats

export const getStaffOrderStats = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  // @ts-ignore
  const staffId = req.user?.id;
  const { period } = req.query;
  const now = new Date();
  const validPeriods: string[] = [
    "today",
    "yesterday",
    "week",
    "month",
    "year",
    "all",
  ];

  if (!validPeriods.includes(period as string)) {
    throw new BadRequestsException(
      "Invalid Period",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  let startDate;
  let endDate;

  switch (period) {
    case "today":
      startDate = new Date(now.setHours(0, 0, 0, 0)); // Start of today
      endDate = now; // Now is the end date
      break;
    case "yesterday":
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = new Date(yesterday.setHours(0, 0, 0, 0)); // Start of yesterday
      endDate = new Date(yesterday.setHours(23, 59, 59, 999)); // End of yesterday
      break;
    case "week":
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - 7);
      startDate = new Date(lastWeek.setHours(0, 0, 0, 0)); // Start of last week
      endDate = now; // Now is the end date
      break;
    case "month":
      const lastMonth = new Date(now);
      lastMonth.setMonth(now.getMonth() - 1);
      startDate = new Date(lastMonth.setHours(0, 0, 0, 0)); // Start of last month
      endDate = now; // Now is the end date
      break;
    case "year":
      const lastYear = new Date(now);
      lastYear.setFullYear(now.getFullYear() - 1);
      startDate = new Date(lastYear.setHours(0, 0, 0, 0)); // Start of last year
      endDate = now; // Now is the end date
      break;
    default:
      startDate = new Date(0); // Beginning of time for "all"
      endDate = now;
      break;
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const orders = await prismaDB.order.findMany({
    where: {
      restaurantId: outlet.id,
      orderStatus: { in: ["COMPLETED", "INCOMMING", "FOODREADY", "SERVED"] },
      staffId: staffId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const totalOrders = orders.length;
  const totalAmount = orders
    .filter((order) => order.orderStatus === "COMPLETED")
    .reduce((total, order) => total + Number(order.totalAmount), 0);

  const totalNetPrice = orders
    .filter((order) => order.orderStatus === "COMPLETED")
    .reduce((total, order) => total + Number(order.totalNetPrice), 0);

  const totalGstPrice = orders
    .filter((order) => order.orderStatus === "COMPLETED")
    .reduce((total, order) => total + Number(order.gstPrice), 0);

  const totalGrossProfit = orders
    .filter((order) => order.orderStatus === "COMPLETED")
    .reduce((total, order) => total + Number(order.totalGrossProfit), 0);

  return res.json({
    success: true,
    totalOrders,
    totalAmount,
    totalNetPrice,
    totalGstPrice,
    totalGrossProfit,
  });
};

export const getStaffOrdersRecentTenOrders = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;
  // @ts-ignore
  const staffId = req.user?.id;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const orders = await prismaDB.order.findMany({
    where: {
      restaurantId: outlet.id,
      staffId: staffId,
    },
    include: {
      orderItems: {
        include: {
          selectedVariant: true,
        },
      },
      orderSession: {
        select: {
          table: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },

    take: 10,
  });

  const formattedOrders = orders.map((order) => ({
    id: order.id,
    orderId: order.generatedOrderId,
    orderType: order.orderType,
    tablename: order.orderSession?.table?.name,
    totalAmount: order.totalAmount,
    orderStatus: order.orderStatus,
    createdAt: order.createdAt,
    isPaid: order.isPaid,
    orderItems: order.orderItems.map((item) => ({
      id: item.id,
      name: item.name,
      sizeVariant: item.selectedVariant?.name,
      quantity: item.quantity,
      price: item.totalPrice,
    })),
  }));

  return res.json({
    success: true,
    orders: formattedOrders,
  });
};

export const acceptOrderFromPrime = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { orderId } = req.body;
  // @ts-ignore
  const staffId = req.user?.id;

  if (!staffId) {
    throw new BadRequestsException(
      "Staff ID is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const order = await prismaDB.order.findFirst({
    where: {
      restaurantId: outlet.id,
      orderSession: {
        id: orderId,
      },
    },
  });

  if (!order?.id) {
    throw new NotFoundException("Order Not Found", ErrorCode.NOT_FOUND);
  }

  if (order?.staffId !== null) {
    throw new BadRequestsException(
      "Order is already accepted by Another Staff",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.order.update({
    where: { id: order.id },
    data: { staffId: staffId },
  });

  return res.json({
    success: true,
    message: "Order Accepted Successfully",
  });
};
