import {
  MenuItem,
  OrderSessionStatus,
  OrderStatus,
  OrderType,
  PaymentMethod,
} from "@prisma/client";
import { prismaDB } from "../../..";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import {
  generateBillNo,
  generatedOrderId,
  getOrderByOutketId,
  getOrderSessionById,
  getOutletById,
} from "../../../lib/outlet";
import { Request, Response } from "express";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { getStaffById } from "../../../lib/get-users";
import { redis } from "../../../services/redis";
import { websocketManager } from "../../../services/ws";
import {
  getFetchActiveOrderSessionToRedis,
  getFetchAllOrderSessionToRedis,
  getFetchAllOrdersToRedis,
  getFetchAllStaffOrderSessionToRedis,
  getFetchLiveOrderToRedis,
} from "../../../lib/outlet/get-order";
import {
  getFetchAllAreastoRedis,
  getFetchAllTablesToRedis,
} from "../../../lib/outlet/get-tables";
import { NotificationService } from "../../../services/firebase";
import { getFetchAllNotificationToRedis } from "../../../lib/outlet/get-items";
import {
  calculateTotals,
  calculateTotalsForTakewayAndDelivery,
} from "./orderSession/orderSessionController";
import { getYear } from "date-fns";
import { UnauthorizedException } from "../../../exceptions/unauthorized";
import { getfetchOutletStocksToRedis } from "../../../lib/outlet/get-inventory";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
} from "../../../schema/staff";
import { z } from "zod";

export const getLiveOrders = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const redisLiveOrder = await redis.get(`liv-o-${outletId}`);

  if (redisLiveOrder) {
    return res.json({
      success: true,
      liveOrders: JSON.parse(redisLiveOrder),
      message: "FETCHED UP ⚡",
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const liveOrders = await getFetchLiveOrderToRedis(outlet.id);

  return res.json({
    success: true,
    liveOrders,
    message: "Fetching ✅",
  });
};

export const getAllActiveSessionOrders = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const redisOrderActiveSession = await redis.get(`active-os-${outletId}`);

  if (redisOrderActiveSession) {
    return res.json({
      success: true,
      activeOrders: JSON.parse(redisOrderActiveSession),
      message: "FETCHED UP ⚡",
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const activeOrders = await getFetchActiveOrderSessionToRedis(outlet.id);

  return res.json({
    success: true,
    activeOrders: activeOrders,
    message: "Fetched ✅",
  });
};

export const getAllSessionOrders = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const redisAllOrderSession = await redis.get(`all-os-${outletId}`);

  if (redisAllOrderSession) {
    return res.json({
      success: true,
      activeOrders: JSON.parse(redisAllOrderSession),
      message: "Fetched ✅",
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const activeOrders = await getFetchAllOrderSessionToRedis(outlet.id);

  return res.json({
    success: true,
    activeOrders,
    message: "Fetched ✅",
  });
};

export const getTableAllSessionOrders = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.orderSession.count({
    where: {
      restaurantId: outletId,
      OR: [{ billId: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });
  // Fetch counts for specific payment methods and order types
  const [paymentMethodCounts, orderTypeCounts] = await Promise.all([
    prismaDB.orderSession.groupBy({
      by: ["paymentMethod"],
      where: {
        restaurantId: outletId,
        OR: [{ billId: { contains: search, mode: "insensitive" } }],
        AND: filterConditions,
        paymentMethod: { in: ["UPI", "CASH", "DEBIT", "CREDIT"] },
      },
      _count: {
        paymentMethod: true,
      },
      // _sum: {
      //   subTotal: true, // Calculate total revenue per payment method
      // },
    }),
    prismaDB.orderSession.groupBy({
      by: ["orderType"],
      where: {
        restaurantId: outletId,
        OR: [{ billId: { contains: search, mode: "insensitive" } }],
        AND: filterConditions,
        orderType: { in: ["DINEIN", "EXPRESS", "DELIVERY", "TAKEAWAY"] },
      },
      _count: {
        orderType: true,
      },
    }),
  ]);

  const activeOrders = await prismaDB.orderSession.findMany({
    take,
    skip,
    where: {
      restaurantId: outletId,
      OR: [
        { billId: { contains: (search as string) ?? "" } },
        { username: { contains: (search as string) ?? "" } },
      ],
      AND: filterConditions, // Apply filters dynamically
    },
    select: {
      id: true,
      billId: true,
      username: true,
      phoneNo: true,
      isPaid: true,
      active: true,
      invoiceUrl: true,
      paymentMethod: true,
      subTotal: true,
      sessionStatus: true,
      orderType: true,
      createdAt: true,
      updatedAt: true,
      table: {
        select: {
          name: true,
        },
      },
      orders: {
        select: {
          id: true,
          generatedOrderId: true,
          orderStatus: true,
          orderType: true,
          createdAt: true,
          totalAmount: true,
          orderItems: {
            select: {
              id: true,
              name: true,
              quantity: true,
              totalPrice: true,
            },
          },
        },
      },
    },
    orderBy,
  });

  const data = {
    totalCount: totalCount,
    paymentMethodStats: paymentMethodCounts.map((item) => ({
      paymentMethod: item.paymentMethod,
      count: item._count.paymentMethod,
      // revenue: parseFloat(item._sum.subTotal) || 0, // Revenue for each payment method
    })),
    orderTypeCounts: orderTypeCounts.map((item) => ({
      orderType: item.orderType,
      count: item._count.orderType,
    })),
    activeOrders: activeOrders?.map((order) => ({
      id: order.id,
      billId: order.billId,
      userName: order.username,
      isPaid: order.isPaid,
      active: order.active,
      invoiceUrl: order.invoiceUrl,
      paymentMethod: order.paymentMethod,
      subTotal: order.subTotal,
      status: order.sessionStatus,
      orderType: order.orderType === "DINEIN" ? order.table : order.orderType,
      date: order.createdAt,
      modified: order?.updatedAt,
      viewOrders: [
        {
          name: order.username,
          phoneNo: order.phoneNo,
          orderItems: order.orders.map((o) => ({
            id: o.id,
            generatedOrderId: o.generatedOrderId,
            orderStatus: o.orderStatus,
            total: o.totalAmount,
            items: o.orderItems.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              totalPrice: item.totalPrice,
            })),
            mode: o.orderType,
            date: o.createdAt,
          })),
        },
      ], // Make sure viewOrders is an array
    })),
  };

  return res.json({
    success: true,
    activeOrders: data,
    message: "Fetched ✅",
  });
};

export const getTableAllOrders = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.order.count({
    where: {
      restaurantId: outletId,
      OR: [{ generatedOrderId: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });
  // Fetch counts for specific payment methods and order types
  // const [paymentMethodCounts, orderTypeCounts] = await Promise.all([
  //   prismaDB.order.groupBy({
  //     by: ["paymentMethod"],
  //     where: {
  //       restaurantId: outletId,
  //       OR: [{ billId: { contains: search, mode: "insensitive" } }],
  //       AND: filterConditions,
  //       paymentMethod: { in: ["UPI", "CASH", "DEBIT", "CREDIT"] },
  //     },
  //     _count: {
  //       paymentMethod: true,
  //     },
  //     // _sum: {
  //     //   subTotal: true, // Calculate total revenue per payment method
  //     // },
  //   }),
  //   prismaDB.orderSession.groupBy({
  //     by: ["orderType"],
  //     where: {
  //       restaurantId: outletId,
  //       OR: [{ billId: { contains: search, mode: "insensitive" } }],
  //       AND: filterConditions,
  //       orderType: { in: ["DINEIN", "EXPRESS", "DELIVERY", "TAKEAWAY"] },
  //     },
  //     _count: {
  //       orderType: true,
  //     },
  //   }),
  // ]);

  const tableOrders = await prismaDB.order.findMany({
    take,
    skip,
    where: {
      restaurantId: outletId,
      OR: [{ generatedOrderId: { contains: (search as string) ?? "" } }],
      AND: filterConditions, // Apply filters dynamically
    },
    include: {
      orderSession: true,
      orderItems: {
        include: {
          selectedVariant: true,
          addOnSelected: {
            include: {
              selectedAddOnVariantsId: true,
            },
          },
          menuItem: {
            include: {
              category: true,
              images: true,
              menuItemVariants: {
                include: {
                  variant: true,
                },
              },
              menuGroupAddOns: {
                include: {
                  addOnGroups: {
                    include: {
                      addOnVariants: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy,
  });

  const data = {
    totalCount: totalCount,
    // paymentMethodStats: paymentMethodCounts.map((item) => ({
    //   paymentMethod: item.paymentMethod,
    //   count: item._count.paymentMethod,
    //   // revenue: parseFloat(item._sum.subTotal) || 0, // Revenue for each payment method
    // })),
    // orderTypeCounts: orderTypeCounts.map((item) => ({
    //   orderType: item.orderType,
    //   count: item._count.orderType,
    // })),
    orders: tableOrders?.map((order) => ({
      id: order.id,
      generatedOrderId: order.generatedOrderId,
      name: order.orderSession?.username,
      orderType: order.orderType,
      orderItems: order.orderItems.map((item) => ({
        id: item.id,
        menuItem: {
          id: item.menuItem.id,
          name: item.menuItem.name,
          shortCode: item.menuItem.shortCode,
          categoryId: item.menuItem.category?.id,
          categoryName: item.menuItem.category?.name,
          type: item.menuItem.type,
          price: item.menuItem.price,
          isVariants: item.menuItem.isVariants,
          isAddOns: item.menuItem.isAddons,
          images: item.menuItem.images.map((image) => ({
            id: image.id,
            url: image.url,
          })),
          menuItemVariants: item.menuItem.menuItemVariants.map((variant) => ({
            id: variant.id,
            variantName: variant.variant.name,
            price: variant.price,
            type: variant.price,
          })),
          menuGroupAddOns: item.menuItem.menuGroupAddOns.map((groupAddOn) => ({
            id: groupAddOn.id,
            addOnGroupName: groupAddOn.addOnGroups.title,
            description: groupAddOn.addOnGroups.description,
            addonVariants: groupAddOn.addOnGroups.addOnVariants.map(
              (addOnVariant) => ({
                id: addOnVariant.id,
                name: addOnVariant.name,
                price: addOnVariant.price,
                type: addOnVariant.type,
              })
            ),
          })),
        },
        name: item.name,
        quantity: item.quantity,
        netPrice: item.netPrice,
        gst: item.gst,
        gstPrice:
          (Number(item.originalRate) - parseFloat(item.netPrice || "0")) *
          Number(item.quantity),
        grossProfit: item.grossProfit,
        originalRate: item.originalRate,
        isVariants: item.isVariants,
        totalPrice: item.totalPrice,
        selectedVariant: item.selectedVariant,
        addOnSelected: item.addOnSelected,
      })),
      orderStatus: order.orderStatus,
      paid: order.isPaid,
      total: Number(order.totalAmount),
      createdAt: order.createdAt,
      date: order.createdAt, // Make sure viewOrders is an array
    })),
  };

  return res.json({
    success: true,
    activeOrders: data,
    message: "Fetched ✅",
  });
};

export const getAllOrders = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const redisAllOrder = await redis.get(`all-orders-${outletId}`);

  if (redisAllOrder) {
    return res.json({
      success: true,
      orders: JSON.parse(redisAllOrder),
      message: "Fetched UP ⚡",
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getOrders = await getFetchAllOrdersToRedis(outlet.id);

  return res.json({
    success: true,
    orders: getOrders,
    message: "Fetched ✅",
  });
};

export const getTodayOrdersCount = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const getOrdersCount = await prismaDB.order.findMany({
    where: {
      restaurantId: outlet?.id,
      createdAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
  });

  const length = getOrdersCount.length;

  return res.status(200).json({
    success: true,
    length,
    message: "Fetched Successfully",
  });
};

export const postOrderForOwner = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const validTypes = Object.values(OrderType);

  const {
    adminId,
    username,
    isPaid,
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
  } = req.body;

  if (isValid === true && !phoneNo) {
    throw new BadRequestsException(
      "please provide Phone No",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Authorization and basic validation
  // @ts-ignore
  if (adminId !== req.user?.id) {
    throw new BadRequestsException("Invalid User", ErrorCode.UNAUTHORIZED);
  }

  if (isPaid === true && !paymentMethod) {
    throw new BadRequestsException(
      "Please Select Payment Mode",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const [findUser, getOutlet] = await Promise.all([
    prismaDB.user.findFirst({ where: { id: adminId } }),
    getOutletById(outletId),
  ]);

  if (!findUser?.id || !getOutlet?.id) {
    throw new NotFoundException(
      "Unauthorized Access for this operation",
      ErrorCode.NOT_FOUND
    );
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
      : "FOODREADY";

  const result = await prismaDB.$transaction(async (prisma) => {
    let customer;
    if (isValid) {
      customer = await prisma.customer.findFirst({
        where: {
          phoneNo: phoneNo,
          restaurantId: getOutlet.id,
        },
      });
      if (customer) {
        customer = await prisma.customer.update({
          where: {
            id: customer.id,
          },
          data: {
            restaurantId: getOutlet?.id,
            name: username,
          },
        });
      } else {
        customer = await prisma.customer.create({
          data: {
            name: username,
            phoneNo: phoneNo,
            restaurantId: getOutlet.id,
          },
        });
      }
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
        username: username ?? findUser.name,
        phoneNo: phoneNo ?? null,
        adminId: findUser.id,
        customerId: isValid === true ? customer?.id : null,
        paymentMethod: isPaid ? paymentMethod : null,
        tableId: tableId,
        isPaid: isPaid,
        restaurantId: getOutlet.id,
        createdBy: `${findUser?.name} (${findUser?.role})`,
        subTotal: isPaid ? totalAmount.toString() : null,
        orders: {
          create: {
            restaurantId: getOutlet.id,
            createdBy: `${findUser?.name} (${findUser?.role})`,
            isPaid: isPaid,
            active: true,
            orderStatus:
              isPaid === true && orderStatus === "COMPLETED"
                ? orderStatus
                : "FOODREADY",
            totalNetPrice: totalNetPrice,
            gstPrice: gstPrice,
            totalAmount: totalAmount.toString(),
            totalGrossProfit: totalGrossProfit,
            generatedOrderId: orderId,
            orderType: orderType,
            orderItems: {
              create: orderItems?.map((item: any) => ({
                menuId: item?.menuId,
                name: item?.menuItem?.name,
                strike: false,
                isVariants: item?.menuItem?.isVariants,
                originalRate: item?.originalPrice,
                quantity: item?.quantity.toString(),
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
                        price:
                          Number(
                            item?.menuItem.menuItemVariants.find(
                              (v: any) => v?.id === item?.sizeVariantsId
                            )?.price as string
                          ) * item?.quantity,
                        gst: Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.gst
                        ),
                        netPrice: (
                          Number(
                            item?.menuItem.menuItemVariants.find(
                              (v: any) => v?.id === item?.sizeVariantsId
                            )?.netPrice as string
                          ) * item?.quantity
                        ).toString(),
                        grossProfit:
                          Number(
                            item?.menuItem.menuItemVariants.find(
                              (v: any) => v?.id === item?.sizeVariantsId
                            )?.grossProfit
                          ) * item?.quantity,
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
    await Promise.all(
      orderItems.map(async (item: any) => {
        const menuItem = await prisma.menuItem.findUnique({
          where: { id: item.menuId },
          include: { itemRecipe: { include: { ingredients: true } } },
        });

        if (menuItem?.chooseProfit === "itemRecipe" && menuItem.itemRecipe) {
          await Promise.all(
            menuItem.itemRecipe.ingredients.map(async (ingredient) => {
              const rawMaterial = await prisma.rawMaterial.findUnique({
                where: { id: ingredient.rawMaterialId },
              });

              if (rawMaterial) {
                const decrementStock =
                  (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                  Number(rawMaterial.conversionFactor);

                if (Number(rawMaterial.currentStock) < decrementStock) {
                  throw new BadRequestsException(
                    `Insufficient stock for raw material: ${rawMaterial.name}`,
                    ErrorCode.UNPROCESSABLE_ENTITY
                  );
                }

                await prisma.rawMaterial.update({
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

    return orderSession;
  });
  // Post-transaction tasks
  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
    getFetchAllNotificationToRedis(outletId),
    getfetchOutletStocksToRedis(outletId),
  ]);

  websocketManager.notifyClients(getOutlet?.id, "NEW_ORDER_SESSION_CREATED");

  return res.json({
    success: true,
    orderSessionId: result.id,
    message: "Order Created from Admin ✅",
  });
};

export const postOrderForStaf = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const validTypes = Object.values(OrderType);

  const {
    billerId,
    username,
    isPaid,
    phoneNo,
    orderType,
    totalAmount,
    orderItems,
    tableId,
    orderMode,
  } = req.body;

  // @ts-ignore
  if (billerId !== req.user?.id) {
    throw new BadRequestsException("Invalid User", ErrorCode.UNAUTHORIZED);
  }

  const findBiller = await prismaDB.staff.findFirst({
    where: {
      id: billerId,
    },
  });

  if (!findBiller?.id) {
    throw new BadRequestsException(
      "You Need to login & place the order",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (orderType === "DINEIN" && !tableId) {
    throw new BadRequestsException(
      "Please Assign the table , if you have choose order type has DINEIN",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!validTypes.includes(orderType)) {
    throw new BadRequestsException(
      "Please Select Order Type",
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

  const orderId = await generatedOrderId(getOutlet?.id);

  const billNo = await generateBillNo(getOutlet.id);

  const orderStatus =
    orderMode === "KOT"
      ? "INCOMMING"
      : orderMode === "EXPRESS"
      ? "FOODREADY"
      : "SERVED";

  const orderSession = await prismaDB.orderSession.create({
    data: {
      billId: billNo,
      orderType: orderType,
      username: username ?? findBiller.name,
      phoneNo: phoneNo ?? null,
      staffId: findBiller.id,
      tableId: tableId,
      isPaid: isPaid,
      restaurantId: getOutlet.id,
      orders: {
        create: {
          staffId: findBiller.id,
          restaurantId: getOutlet.id,
          isPaid: isPaid,
          active: true,
          orderStatus: orderStatus,
          totalAmount: totalAmount.toString(),
          generatedOrderId: orderId,
          orderType: orderType,
          orderItems: {
            create: orderItems?.map((item: any) => ({
              menuId: item?.menuId,
              name: item?.menuItem?.name,
              strike: false,
              isVariants: item?.menuItem?.isVariants,
              originalRate: item?.originalPrice,
              quantity: item?.quantity.toString(),
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
                        item?.menuItem?.menuItemVariants?.find(
                          (variant: any) => variant?.id === item?.sizeVariantsId
                        )?.price
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
                              (variant: any) => variant?.id === addOnVariant?.id
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

  if (tableId) {
    const findTable = await prismaDB.table.findFirst({
      where: {
        id: tableId,
        restaurantId: getOutlet.id,
      },
    });
    if (!findTable?.id) {
      throw new NotFoundException("No Table found", ErrorCode.NOT_FOUND);
    } else {
      await prismaDB.table.update({
        where: {
          id: findTable.id,
          restaurantId: getOutlet.id,
        },
        data: {
          occupied: true,
          currentOrderSessionId: orderSession.id,
        },
      });
      await prismaDB.notification.create({
        data: {
          restaurantId: getOutlet.id,
          orderId: orderId,
          message: "You have a new Order",
          orderType: findTable.name,
        },
      });
      await Promise.all([
        getFetchActiveOrderSessionToRedis(outletId),
        getFetchAllOrderSessionToRedis(outletId),
        getFetchAllOrdersToRedis(outletId),
        getFetchLiveOrderToRedis(outletId),
        getFetchAllStaffOrderSessionToRedis(outletId, findBiller.id),
        getFetchAllTablesToRedis(outletId),
        getFetchAllAreastoRedis(outletId),
        getFetchAllNotificationToRedis(outletId),
      ]);

      websocketManager.notifyClients(
        getOutlet?.id,
        "NEW_ORDER_SESSION_CREATED"
      );

      return res.json({
        success: true,
        orderSessionId: orderSession.id,
        message: "Order Created from Biller ✅",
      });
    }
  } else {
    await prismaDB.notification.create({
      data: {
        restaurantId: getOutlet.id,
        orderId: orderId,
        message: "You have a new Order",
        orderType: orderType,
      },
    });
    await Promise.all([
      getFetchActiveOrderSessionToRedis(outletId),
      getFetchAllOrderSessionToRedis(outletId),
      getFetchAllOrdersToRedis(outletId),
      getFetchLiveOrderToRedis(outletId),
      getFetchAllStaffOrderSessionToRedis(outletId, findBiller.id),
      getFetchAllTablesToRedis(outletId),
      getFetchAllAreastoRedis(outletId),
      getFetchAllNotificationToRedis(outletId),
    ]);

    websocketManager.notifyClients(getOutlet?.id, "NEW_ORDER_SESSION_CREATED");

    return res.json({
      success: true,
      orderSessionId: orderSession.id,
      message: "Order Created from Biller ✅",
    });
  }
};

export const postOrderForUser = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const validTypes = Object.values(OrderType);

  const {
    customerId,
    isPaid,
    orderType,
    totalAmount,
    orderItems,
    tableId,
    paymentId,
  } = req.body;

  // @ts-ignore
  if (customerId !== req.user?.id) {
    throw new BadRequestsException("Invalid User", ErrorCode.UNAUTHORIZED);
  }

  const validCustomer = await prismaDB.customer.findFirst({
    where: {
      id: customerId,
    },
  });

  if (!validCustomer?.id) {
    throw new BadRequestsException(
      "You Need to login & place the order",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (orderType === "DINEIN" && !tableId) {
    throw new BadRequestsException(
      "Please logout & Scan the QR code again to place the order",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!validTypes.includes(orderType)) {
    throw new BadRequestsException(
      "You Need to choose either HOME DELIVERY / TAKEAWAY ",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!outletId) {
    throw new BadRequestsException(
      "Outlet Id is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  const calculate = calculateTotalsForTakewayAndDelivery(orderItems);

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const orderId = await generatedOrderId(getOutlet?.id);

  const billNo = await generateBillNo(getOutlet.id);

  let orderSession;

  // Helper function to create order data
  const createOrderData = (
    restaurantId: string,
    isPaid: boolean,
    orderId: string,
    orderType: OrderType,
    totalAmount: number,
    orderStatus: OrderStatus,
    orderItems: any[]
  ) => {
    return {
      active: true,
      restaurantId: restaurantId,
      isPaid: isPaid,
      generatedOrderId: orderId,
      orderType: orderType,
      totalAmount: totalAmount.toString(),
      orderStatus: orderStatus,
      orderItems: {
        create: orderItems?.map((item: any) => ({
          menuId: item?.menuId,
          name: item?.menuItem?.name,
          strike: false,
          isVariants: item?.menuItem?.isVariants,
          originalRate: item?.originalPrice,
          quantity: item?.quantity.toString(),
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
                    item?.menuItem?.menuItemVariants?.find(
                      (variant: any) => variant?.id === item?.sizeVariantsId
                    )?.price
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
                      const matchedVaraint = groupAddOn?.addonVariants?.find(
                        (variant: any) => variant?.id === addOnVariant?.id
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
    };
  };

  if (orderType === OrderType.DINEIN) {
    if (!tableId) {
      throw new BadRequestsException(
        "Table ID is required for DINEIN orders",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    const checkTable = await prismaDB.table.findFirst({
      where: { id: tableId, occupied: true },
    });

    if (!checkTable) {
      throw new BadRequestsException(
        "You Need to scan the Qr Code again to place Order",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    // Check if there's an existing order session for DINEIN
    if (checkTable.currentOrderSessionId) {
      // If there's an existing session, add the order to it
      orderSession = await prismaDB.orderSession.update({
        where: { id: checkTable.currentOrderSessionId },
        data: {
          orders: {
            create: createOrderData(
              getOutlet.id,
              isPaid,
              orderId,
              orderType,
              totalAmount,
              "INCOMMING",
              orderItems
            ),
          },
        },
      });
    } else {
      // If there's no existing session, create a new one
      orderSession = await prismaDB.orderSession.create({
        data: {
          billId: billNo,
          username: validCustomer.name,
          phoneNo: validCustomer.phoneNo,
          customerId: validCustomer.id,
          tableId: tableId,
          restaurantId: getOutlet.id,
          orderType: orderType,
          orders: {
            create: createOrderData(
              getOutlet.id,
              isPaid,
              orderId,
              orderType,
              totalAmount,
              "INCOMMING",
              orderItems
            ),
          },
        },
      });

      // Update the table with the new orderSessionId
      await prismaDB.table.update({
        where: { id: tableId },
        data: { currentOrderSessionId: orderSession.id },
      });
    }
    await NotificationService.sendNotification(
      getOutlet.fcmToken!,
      `You have got new Order from ${checkTable.name}`,
      `Order: ${orderItems?.length}`
    );
  } else {
    // For TAKEAWAY or DELIVERY, always create a new order session
    orderSession = await prismaDB.orderSession.create({
      data: {
        billId: billNo,
        orderType: orderType,
        username: validCustomer.name,
        phoneNo: validCustomer?.phoneNo,
        customerId: validCustomer.id,
        restaurantId: getOutlet.id,
        isPaid: true,
        paymentMethod: paymentId.length ? "UPI" : "CASH",
        subTotal: calculate.roundedTotal.toString(),
        orders: {
          create: createOrderData(
            getOutlet.id,
            isPaid,
            orderId,
            orderType,
            totalAmount,
            "INCOMMING",
            orderItems
          ),
        },
      },
    });
    await NotificationService.sendNotification(
      getOutlet.fcmToken!,
      `${orderType}: You have got new Order from ${validCustomer?.name}`,
      `Order: ${orderItems?.length}`
    );
  }

  await prismaDB.notification.create({
    data: {
      restaurantId: getOutlet.id,
      orderId: orderId,
      message: "You have a new Order",
      orderType: orderType,
    },
  });

  websocketManager.notifyClients(getOutlet?.id, "NEW_ORDER_SESSION_CREATED");

  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
    getFetchAllNotificationToRedis(outletId),
  ]);

  return res.json({
    success: true,
    sessionId: orderSession.id,
    message: "Order Created by Customer ✅",
  });
};

export const existingOrderPatch = async (req: Request, res: Response) => {
  const { outletId, orderId } = req.params;

  const { billerId, isPaid, totalAmount, orderItems, orderMode } = req.body;

  // @ts-ignore
  if (billerId !== req.user?.id) {
    throw new BadRequestsException("Invalid User", ErrorCode.UNAUTHORIZED);
  }

  const findBiller = await prismaDB.staff.findFirst({
    where: {
      id: billerId,
    },
  });

  if (!findBiller?.id) {
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

  const orderSession = await prismaDB.orderSession.update({
    where: {
      restaurantId: getOutlet.id,
      id: getOrder.id,
    },
    data: {
      orderType: getOrder.orderType,
      staffId: findBiller.id,
      isPaid: isPaid,
      restaurantId: getOutlet.id,
      orders: {
        create: {
          active: true,
          staffId: findBiller.id,
          restaurantId: getOutlet.id,
          isPaid: isPaid,
          orderStatus: orderStatus,
          totalAmount: totalAmount.toString(),
          generatedOrderId: generatedId,
          orderType: getOrder.orderType,
          orderItems: {
            create: orderItems?.map((item: any) => ({
              menuId: item?.menuId,
              name: item?.menuItem?.name,
              strike: false,
              isVariants: item?.menuItem?.isVariants,
              originalRate: item?.originalPrice,
              quantity: item?.quantity.toString(),
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
                      price:
                        Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.price as string
                        ) * item?.quantity,
                      gst: Number(
                        item?.menuItem.menuItemVariants.find(
                          (v: any) => v?.id === item?.sizeVariantsId
                        )?.gst
                      ),
                      netPrice: (
                        Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.netPrice as string
                        ) * item?.quantity
                      ).toString(),
                      grossProfit:
                        Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.grossProfit
                        ) * item?.quantity,
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
                              (variant: any) => variant?.id === addOnVariant?.id
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
  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllStaffOrderSessionToRedis(outletId, findBiller.id),
    getFetchAllAreastoRedis(outletId),
    getFetchAllNotificationToRedis(outletId),
  ]);

  websocketManager.notifyClients(getOutlet?.id, "NEW_ORDER_SESSION_UPDATED");

  return res.json({
    success: true,
    orderSessionId: orderSession.id,
    message: "Order Added from Biller ✅",
  });
};

export const existingOrderPatchApp = async (req: Request, res: Response) => {
  const { outletId, orderId } = req.params;

  const {
    billerId,
    isPaid,
    totalNetPrice,
    gstPrice,
    totalAmount,
    totalGrossProfit,
    orderItems,
    orderMode,
  } = req.body;

  // @ts-ignore
  if (billerId !== req.user?.id) {
    throw new BadRequestsException("Invalid User", ErrorCode.UNAUTHORIZED);
  }

  const [findBiller, getOutlet] = await Promise.all([
    prismaDB.user.findFirst({ where: { id: billerId } }),
    getOutletById(outletId),
  ]);

  if (!findBiller?.id || !getOutlet?.id) {
    throw new NotFoundException(
      "User or Outlet Not Found",
      ErrorCode.NOT_FOUND
    );
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

  const orderSession = await prismaDB.orderSession.update({
    where: {
      restaurantId: getOutlet.id,
      id: getOrder.id,
    },
    data: {
      orderType: getOrder.orderType,
      adminId: findBiller.id,
      isPaid: isPaid,
      restaurantId: getOutlet.id,
      createdBy: findBiller?.name,
      orders: {
        create: {
          active: true,
          restaurantId: getOutlet.id,
          isPaid: isPaid,
          orderStatus: orderStatus,
          totalNetPrice: totalNetPrice,
          gstPrice: gstPrice,
          totalAmount: totalAmount.toString(),
          totalGrossProfit: totalGrossProfit,
          generatedOrderId: generatedId,
          orderType: getOrder.orderType,
          createdBy: findBiller?.name,
          orderItems: {
            create: orderItems?.map((item: any) => ({
              menuId: item?.menuId,
              name: item?.menuItem?.name,
              strike: false,
              isVariants: item?.menuItem?.isVariants,
              originalRate: item?.originalPrice,
              quantity: item?.quantity.toString(),
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
                      price:
                        Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.price as string
                        ) * item?.quantity,
                      gst: Number(
                        item?.menuItem.menuItemVariants.find(
                          (v: any) => v?.id === item?.sizeVariantsId
                        )?.gst
                      ),
                      netPrice: (
                        Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.netPrice as string
                        ) * item?.quantity
                      ).toString(),
                      grossProfit:
                        Number(
                          item?.menuItem.menuItemVariants.find(
                            (v: any) => v?.id === item?.sizeVariantsId
                          )?.grossProfit
                        ) * item?.quantity,
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
                              (variant: any) => variant?.id === addOnVariant?.id
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
  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
    getFetchAllNotificationToRedis(outletId),
  ]);

  websocketManager.notifyClients(outletId, "NEW_ORDER_SESSION_UPDATED");

  return res.json({
    success: true,
    orderSessionId: orderSession.id,
    message: "Order Added from Admin App ✅",
  });
};

export const orderessionPaymentModePatch = async (
  req: Request,
  res: Response
) => {
  const { id, outletId } = req.params;
  const validTypes = Object.values(PaymentMethod);
  const { paymentMethod } = req.body;

  if (!validTypes.includes(paymentMethod)) {
    throw new BadRequestsException(
      "Payment Mode is Invalid",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getOrderById = await getOrderSessionById(outlet.id, id);

  if (!getOrderById?.id) {
    throw new NotFoundException(
      "No Order Found to Update",
      ErrorCode.NOT_FOUND
    );
  }

  await prismaDB.orderSession.update({
    where: {
      id: getOrderById.id,
      restaurantId: outlet.id,
    },
    data: {
      paymentMethod: paymentMethod,
    },
  });
  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
  ]);

  websocketManager.notifyClients(outlet?.id, "ORDER_UPDATED");

  return res.json({
    success: true,
    message: "Payment Mode Updated ✅",
  });
};

export const orderessionNamePatch = async (req: Request, res: Response) => {
  const { id, outletId } = req.params;
  const { name } = req.body;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getOrderById = await getOrderSessionById(outlet.id, id);

  if (!getOrderById?.id) {
    throw new NotFoundException(
      "No Order Found to Update",
      ErrorCode.NOT_FOUND
    );
  }

  await prismaDB.orderSession.update({
    where: {
      id: getOrderById.id,
      restaurantId: outlet.id,
    },
    data: {
      username: name,
    },
  });
  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
  ]);

  websocketManager.notifyClients(outlet?.id, "ORDER_UPDATED");

  return res.json({
    success: true,
    message: "UserName Updated ✅",
  });
};

export const orderessionCancelPatch = async (req: Request, res: Response) => {
  const { id, outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getOrderById = await getOrderSessionById(outlet.id, id);

  if (!getOrderById?.id) {
    throw new NotFoundException(
      "No Order Found to Update",
      ErrorCode.NOT_FOUND
    );
  }

  // Perform updates within a transaction
  await prismaDB.$transaction(async (tx) => {
    // Update the `orderSession` status to "CANCELLED"
    await tx.orderSession.update({
      where: {
        id: getOrderById.id,
      },
      data: {
        sessionStatus: "CANCELLED",
        active: false,
      },
    });

    // Update all related orders' status to "CANCELLED"
    await tx.order.updateMany({
      where: {
        orderSessionId: getOrderById.id,
        restaurantId: outletId,
      },
      data: {
        orderStatus: "CANCELLED",
      },
    });
  });

  // Refresh Redis cache
  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
  ]);

  websocketManager.notifyClients(outlet?.id, "ORDER_UPDATED");

  return res.json({
    success: true,
    message: "Order Transaction Cancelled✅",
  });
};

export const orderessionDeleteById = async (req: Request, res: Response) => {
  const { id, outletId } = req.params;
  // @ts-ignore
  const userId = req?.user?.id;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const getOrderById = await getOrderSessionById(outlet?.id, id);

  if (!getOrderById?.id) {
    throw new NotFoundException(
      "No Order Session Found to Delete",
      ErrorCode.NOT_FOUND
    );
  }

  await prismaDB.orderSession.delete({
    where: {
      id: getOrderById.id,
      restaurantId: outlet.id,
    },
  });
  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
  ]);

  return res.json({
    success: true,
    message: "Order Transactiion Deleted ✅",
  });
};

export const orderessionBatchDelete = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { selectedId } = req.body;
  // @ts-ignore
  const userId = req?.user?.id;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  // Validate input
  if (!Array.isArray(selectedId) || selectedId?.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please select neccessarry Order Transaction",
    });
  }

  // Perform status update within a transaction
  await prismaDB.$transaction(async (tx) => {
    // Update related orders' statuses to "CANCELLED"
    await tx.order.updateMany({
      where: {
        orderSessionId: {
          in: selectedId,
        },
        restaurantId: outlet.id,
      },
      data: {
        orderStatus: "CANCELLED",
      },
    });

    // Update `orderSession` statuses to "CANCELLED"
    await tx.orderSession.updateMany({
      where: {
        restaurantId: outlet.id,
        id: {
          in: selectedId,
        },
      },
      data: {
        sessionStatus: "CANCELLED",
        active: false,
      },
    });
  });

  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
  ]);

  return res.json({
    success: true,
    message: "Select Order Transaction Deleted ✅",
  });
};

export const orderStatusPatch = async (req: Request, res: Response) => {
  const { orderId, outletId } = req.params;
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
  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
  ]);

  websocketManager.notifyClients(outlet?.id, "ORDER_UPDATED");

  return res.json({
    success: true,
    message: "Order Status Update Success ✅",
  });
};

export const getAllOrderByStaff = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const redisOrderByStaff = await redis.get(`all-order-staff-${outletId}`);

  if (redisOrderByStaff) {
    return res.json({
      success: true,
      orders: JSON.parse(redisOrderByStaff),
      message: "Fetched Up ⚡",
    });
  }
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  // @ts-ignore
  const staff = await getStaffById(outletId, req.user?.id);

  if (!staff?.id) {
    throw new NotFoundException("Unauthorized Access", ErrorCode.UNAUTHORIZED);
  }

  const getAllOrders = await getFetchAllStaffOrderSessionToRedis(
    outlet.id,
    staff.id
  );

  return res.json({
    success: true,
    orders: getAllOrders,
    message: "Fetched ✅",
  });
};

const menuCardSchema = z.object({
  quantity: z.number().min(1, "Quantity must be at least 1"),
  selectedVariantId: z.string().optional(),
  addOnSelected: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      selectedAddOnVariantsId: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          price: z.number(),
        })
      ),
    })
  ),
  totalPrice: z.number().min(1, "Invalid Total"),
});

export const orderItemModification = async (req: Request, res: Response) => {
  const { orderId, outletId } = req.params;
  const { data: validateFields, error } = menuCardSchema.safeParse(req.body);

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
    await prisma.orderItem.update({
      where: {
        id: getOrderById.id,
        order: { restaurantId: outlet.id },
      },
      data: {
        quantity: validateFields?.quantity.toString(),
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
                  price:
                    parseFloat(
                      getOrderById?.menuItem.menuItemVariants.find(
                        (v) => v?.id === validateFields?.selectedVariantId
                      )?.price as string
                    ) * validateFields?.quantity,
                  gst: Number(
                    getOrderById?.menuItem.menuItemVariants.find(
                      (v) => v?.id === validateFields?.selectedVariantId
                    )?.gst
                  ),
                  netPrice: (
                    parseFloat(
                      getOrderById?.menuItem.menuItemVariants.find(
                        (v) => v?.id === validateFields?.selectedVariantId
                      )?.netPrice as string
                    ) * validateFields?.quantity
                  ).toString(),
                  grossProfit:
                    Number(
                      getOrderById?.menuItem.menuItemVariants.find(
                        (v) => v?.id === validateFields?.selectedVariantId
                      )?.grossProfit
                    ) * validateFields?.quantity,
                },
              },
            }
          : undefined,
        // addOnSelected: {
        //   set: [],
        //   create: validateFields.addOnSelected.map((addOn) => ({
        //     id: addOn.id,
        //     name: addOn.name,
        //     selectedAddOnVariantsId: {
        //       create: addOn.selectedAddOnVariantsId.map((subVariant) => ({
        //         id: subVariant.id,
        //         name: subVariant.name,
        //         price: subVariant.price,
        //       })),
        //     },
        //   })),
        // },
        netPrice: !getOrderById?.isVariants
          ? (
              Number(getOrderById?.menuItem?.netPrice as string) *
              validateFields?.quantity
            ).toString()
          : (
              Number(
                getOrderById?.menuItem.menuItemVariants.find(
                  (v) => v?.id === validateFields?.selectedVariantId
                )?.netPrice as string
              ) * validateFields?.quantity
            ).toString(),
        originalRate: !getOrderById?.isVariants
          ? Number(getOrderById?.menuItem?.price as string)
          : Number(
              getOrderById?.menuItem.menuItemVariants.find(
                (v) => v?.id === validateFields?.selectedVariantId
              )?.price as string
            ),
        grossProfit: !getOrderById?.isVariants
          ? Number(getOrderById?.menuItem?.grossProfit) *
            validateFields?.quantity
          : Number(
              getOrderById?.menuItem.menuItemVariants.find(
                (v) => v?.id === validateFields?.selectedVariantId
              )?.grossProfit
            ) * validateFields?.quantity,
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
      (total, item) => total + (Number(item.grossProfit) || 0),
      0
    );
    const totalNetPrice = updatedOrderItems.reduce(
      (total, item) => total + (Number(item.netPrice as string) || 0),
      0
    );
    const gstPrice = updatedOrderItems.reduce(
      (total, item) =>
        total +
        ((Number(item.netPrice as string) * Number(item.gst)) / 100 || 0),
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
        totalAmount: totalAmount.toString(),
      },
    });
  });

  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
  ]);

  return res.json({
    success: true,
    message: "Order Item Updated Success ✅",
  });
};

export const deleteOrderItem = async (req: Request, res: Response) => {
  const { orderItemId, outletId } = req.params;

  // Validate outlet
  const outlet = await getOutletById(outletId);
  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Fetch the OrderItem and its parent Order
  const orderItem = await prismaDB.orderItem.findFirst({
    where: {
      id: orderItemId,
      order: {
        restaurantId: outletId,
      },
    },
    include: {
      order: {
        include: {
          orderItems: true, // Include all order items for recalculation
        },
      },
    },
  });

  if (!orderItem?.id) {
    throw new NotFoundException("OrderItem Not Found", ErrorCode.NOT_FOUND);
  }

  // Use Prisma transaction for atomic operation
  await prismaDB.$transaction(async (tx) => {
    // Delete the OrderItem
    await tx.orderItem.delete({
      where: {
        id: orderItem.id,
      },
    });

    const remainingOrderItems = orderItem.order.orderItems.filter(
      (item) => item.id !== orderItem.id
    );

    // If no order items remain, delete the order
    if (remainingOrderItems.length === 0) {
      await tx.order.delete({
        where: {
          id: orderItem.order.id,
        },
      });
    } else {
      // Recalculate Order totals
      const totalGrossProfit = remainingOrderItems.reduce(
        (total, item) =>
          total + (Number(item.grossProfit) * parseFloat(item.quantity) || 0),
        0
      );
      const totalNetPrice = remainingOrderItems.reduce(
        (total, item) =>
          total +
          (parseFloat(item.netPrice as string) * parseFloat(item.quantity) ||
            0),
        0
      );
      const gstPrice = remainingOrderItems.reduce(
        (total, item) =>
          total + (Number(item.gst) * parseFloat(item.quantity) || 0),
        0
      );
      const totalAmount = remainingOrderItems.reduce(
        (total, item) => total + item.totalPrice,
        0
      );

      // Update the Order
      await tx.order.update({
        where: {
          id: orderItem.order.id,
        },
        data: {
          totalGrossProfit,
          totalNetPrice,
          gstPrice,
          totalAmount: totalAmount.toString(),
        },
      });
    }
  });

  // Refresh caches after successful transaction
  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
  ]);

  return res.json({
    success: true,
    message: "Order Item Deleted",
  });
};

export const inviteCode = () => {
  let code = "";
  const MAX_LENGTH = 5;
  const alphabets = "ABCDEFGHIHJKLMNOPQRSTUVWXYZ0123456789";

  for (let i = 0; i < MAX_LENGTH; i++) {
    code += alphabets[Math.floor(Math.random() * alphabets.length)];
  }

  return code;
};
