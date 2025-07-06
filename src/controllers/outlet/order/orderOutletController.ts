import {
  CashRegister,
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
  getFetchAllStaffOrderSessionToRedis,
  getFetchLiveOnlineOrderToRedis,
  getFetchLiveOrderToRedis,
  getFetchStaffActiveOrderSessionToRedis,
} from "../../../lib/outlet/get-order";
import { calculateTotalsForTakewayAndDelivery } from "./orderSession/orderSessionController";
import { getYear } from "date-fns";
import { UnauthorizedException } from "../../../exceptions/unauthorized";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
} from "../../../schema/staff";

import { z } from "zod";
import { sendNewOrderNotification } from "../../../services/expo-notifications";

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

export const getLiveOnlineOrders = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const redisLiveOrder = await redis.get(`liv-online-${outletId}`);

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

  const liveOrders = await getFetchLiveOnlineOrderToRedis(outlet.id);

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

export const getAllActiveStaffSessionOrders = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;
  // @ts-ignore
  const { id } = req.user;

  const redisOrderActiveSession = await redis.get(
    `active-staff-os-${id}-${outletId}`
  );

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

  const activeOrders = await getFetchStaffActiveOrderSessionToRedis(
    outlet.id,
    id
  );

  return res.json({
    success: true,
    activeOrders: activeOrders,
    message: "Fetched ✅",
  });
};

export const getTableAllSessionOrders = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];
  const dateRange: { from: string; to: string } | undefined =
    req.body.dateRange;
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
      ...(dateRange && {
        createdAt: {
          gt: new Date(dateRange.from),
          lt: new Date(dateRange.to),
        },
      }),
    },
  });
  // Fetch counts for specific payment methods and order types
  const [sessionStatusCounts, paymentMethodCounts, orderTypeCounts] =
    await Promise.all([
      prismaDB.orderSession.groupBy({
        by: ["sessionStatus"],
        where: {
          restaurantId: outletId,
          OR: [{ billId: { contains: search, mode: "insensitive" } }],
          AND: filterConditions,
          ...(dateRange && {
            createdAt: {
              gt: new Date(dateRange.from),
              lt: new Date(dateRange.to),
            },
          }),
          sessionStatus: { in: ["COMPLETED", "CANCELLED", "ONPROGRESS"] },
        },
        _count: {
          sessionStatus: true,
        },
        _sum: {
          subTotal: true,
          // Calculate total revenue per payment method
        },
      }),
      prismaDB.orderSession.groupBy({
        by: ["paymentMethod"],
        where: {
          restaurantId: outletId,
          OR: [{ billId: { contains: search, mode: "insensitive" } }],
          AND: filterConditions,
          ...(dateRange && {
            createdAt: {
              gt: new Date(dateRange.from),
              lt: new Date(dateRange.to),
            },
          }),
          paymentMethod: { in: ["UPI", "CASH", "DEBIT", "CREDIT"] },
        },
        _count: {
          paymentMethod: true,
        },
        _sum: {
          subTotal: true, // Calculate total revenue per payment method
        },
      }),
      prismaDB.orderSession.groupBy({
        by: ["orderType"],
        where: {
          restaurantId: outletId,
          OR: [{ billId: { contains: search, mode: "insensitive" } }],
          AND: filterConditions,
          ...(dateRange && {
            createdAt: {
              gt: new Date(dateRange.from),
              lt: new Date(dateRange.to),
            },
          }),
        },
        _count: {
          orderType: true,
        },
        _sum: {
          subTotal: true,
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
      ...(dateRange && {
        createdAt: {
          gt: new Date(dateRange.from),
          lt: new Date(dateRange.to),
        },
      }),
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
      loyaltRedeemPoints: true,
      discount: true,
      discountAmount: true,
      gstAmount: true,
      amountReceived: true,
      paymentMode: true,
      packingFee: true,
      deliveryFee: true,
      customer: {
        select: {
          customer: {
            select: {
              name: true,
              phoneNo: true,
            },
          },
        },
      },
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
    sessionStatusStats: sessionStatusCounts?.map((item) => ({
      status: item.sessionStatus,
      count: item._count.sessionStatus,
      revenue: item._sum.subTotal || 0, // Revenue for each payment method
    })),
    paymentMethodStats: paymentMethodCounts?.map((item) => ({
      paymentMethod: item.paymentMethod,
      count: item._count.paymentMethod,
      revenue: item._sum.subTotal || 0, // Revenue for each payment method
    })),
    orderTypeCounts: orderTypeCounts?.map((item) => ({
      orderType: item.orderType,
      count: item._count.orderType,
    })),
    activeOrders: activeOrders?.map((order) => ({
      id: order?.id,
      billId: order?.billId,
      userName: order?.username
        ? order?.username
        : order?.customer?.customer?.name,
      phoneNo: order?.phoneNo
        ? order?.phoneNo
        : order?.customer?.customer?.phoneNo,
      isPaid: order?.isPaid,
      active: order?.active,
      invoiceUrl: order?.invoiceUrl,
      paymentMethod: order?.paymentMethod,
      subTotal: order?.subTotal,
      status: order?.sessionStatus,
      orderType:
        order?.orderType === "DINEIN" ? order?.table?.name : order?.orderType,
      date: order?.createdAt,
      modified: order?.updatedAt,
      discount: order?.discount,
      discountAmount: order?.discountAmount,
      gstAmount: order?.gstAmount,
      loyaltyDiscount: order?.loyaltRedeemPoints,
      amountReceived: order?.amountReceived,
      deliveryFee: order?.deliveryFee,
      packingFee: order?.packingFee,
      paymentMode: order?.paymentMode,
      viewOrders: order?.orders?.map((o) => ({
        id: o?.id,
        generatedOrderId: o?.generatedOrderId,
        orderStatus: o?.orderStatus,
        total: o?.totalAmount,
        items: o?.orderItems?.map((item) => ({
          id: item?.id,
          name: item?.name,
          quantity: item?.quantity,
          totalPrice: item?.totalPrice,
        })),
        mode: o?.orderType,
        date: o?.createdAt,
      })),
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
  const dateRange: { from: string; to: string } | undefined =
    req.body.dateRange;

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
      ...(dateRange && {
        createdAt: {
          gt: new Date(dateRange.from),
          lt: new Date(dateRange.to),
        },
      }),
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
      ...(dateRange && {
        createdAt: {
          gt: new Date(dateRange.from),
          lt: new Date(dateRange.to),
        },
      }),
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
      deliveryFee: order?.orderSession?.deliveryFee,
      packingFee: order?.orderSession?.packingFee,
      paymentMode: order?.orderSession?.paymentMode,
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
    cashRegisterId,
    username,
    isPaid,
    isValid,
    phoneNo,
    orderType,
    totalNetPrice,
    gstPrice,
    totalAmount,
    customerId,
    totalGrossProfit,
    orderItems,
    tableId,
    paymentMethod,
    note,
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
  if (adminId !== req.user?.id) {
    throw new BadRequestsException("Invalid User", ErrorCode.UNAUTHORIZED);
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

  if (isPaid === true && paymentMethod) {
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
      : orderMode === "SERVED"
      ? "SERVED"
      : "FOODREADY";

  const result = await prismaDB.$transaction(async (prisma) => {
    await Promise.all([
      redis.del(`liv-online-${outletId}`),
      redis.del(`active-os-${outletId}`),
      redis.del(`liv-o-${outletId}`),
      redis.del(`tables-${outletId}`),
      redis.del(`a-${outletId}`),
      redis.del(`o-n-${outletId}`),
      redis.del(`${outletId}-stocks`),
      redis.del(`${outletId}-all-items-online-and-delivery`),
      redis.del(`${outletId}-all-items`),
    ]);
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
        username: username ?? findUser.name,
        phoneNo: phoneNo ?? null,
        adminId: findUser.id,
        customerId: isValid === true ? customer?.id : null,
        paymentMethod: isPaid && !isSplitPayment ? paymentMethod : "SPLIT",
        tableId: tableId,
        isPaid: isPaid,
        restaurantId: getOutlet.id,
        createdBy: `${findUser?.name}-(${findUser?.role})`,
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
                  createdBy: `${findUser?.name} (${findUser?.role})`,
                })),
              }
            : undefined,
        orders: {
          create: {
            restaurantId: getOutlet.id,
            createdBy: `${findUser?.name}-(${findUser?.role})`,
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
            paymentMethod: isPaid && !isSplitPayment ? paymentMethod : "SPLIT",
            generatedOrderId: orderId,
            orderType: orderType,
            note: note,
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

    // Send push notifications for new dine-in orders
    if (orderType === "DINEIN") {
      await sendNewOrderNotification({
        restaurantId: getOutlet.id,
        orderId: orderId,
        orderNumber: billNo,
        customerName: username ?? findUser.name,
        tableId: tableId, // This will be updated when staff is assigned
      });
    }

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
                performedBy: findUser.id,
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
            amount: paymentMethod === "CASH" ? receivedAmount : totalAmount,
            type: "CASH_IN",
            source: "ORDER",
            description: `Order Sales - #${orderSession.billId} - ${orderSession.orderType} - ${orderItems?.length} x Items`,
            paymentMethod: paymentMethod,
            performedBy: findUser.id,
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

    return orderSession;
  });
  // Post-transaction tasks

  websocketManager.notifyClients(getOutlet?.id, "NEW_ORDER_SESSION_CREATED");
  await redis.publish("orderUpdated", JSON.stringify({ outletId }));
  return res.json({
    success: true,
    orderSessionId: result.id,
    kotNumber: orderId,
    message: "Order Created from Admin ✅",
  });
};

export const postOrderForUser = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const validTypes = Object.values(OrderType);

  const {
    customerId,
    isPaid,
    orderType,
    totalNetPrice,
    gstPrice,
    totalAmount,
    totalGrossProfit,
    orderItems,
    tableId,
    note,
    paymentId,
    paymentMode,
    deliveryArea,
    deliveryAreaAddress,
    deliveryAreaLandmark,
    deliveryAreaLat,
    deliveryAreaLong,
  } = req.body;

  // @ts-ignore
  if (customerId !== req.user?.id) {
    throw new BadRequestsException("Invalid User", ErrorCode.UNAUTHORIZED);
  }

  if (orderType === "DINEIN" && !tableId) {
    throw new BadRequestsException(
      "Please logout & Scan the QR code again to place the order",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!validTypes.includes(orderType)) {
    throw new BadRequestsException(
      "You Need to choose either HOME DELIVERY / TAKEAWAY",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (orderType === "DELIVERY") {
    if (
      !deliveryArea ||
      !deliveryAreaAddress ||
      !deliveryAreaLandmark ||
      !deliveryAreaLat ||
      !deliveryAreaLong
    ) {
      throw new BadRequestsException(
        "Please check your delivery address, delivery mode / area and landmark is filled",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  }

  if (!outletId) {
    throw new BadRequestsException(
      "Outlet Id is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Get outlet
  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  // Generate order and bill numbers
  const [orderId, billNo] = await Promise.all([
    generatedOrderId(getOutlet.id),
    generateBillNo(getOutlet.id),
  ]);

  // Validate customer and access
  const validCustomer = await prismaDB.customerRestaurantAccess.findFirst({
    where: { customerId: customerId, restaurantId: outletId },
    include: { customer: true },
  });

  if (!validCustomer?.id) {
    throw new BadRequestsException(
      "You Need to logout & login again to place the order",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Calculate totals for takeaway/delivery
  const calculate = calculateTotalsForTakewayAndDelivery(
    orderItems,
    Number(getOutlet?.deliveryFee || 0),
    Number(getOutlet?.packagingFee || 0),
    orderType
  );

  const result = await prismaDB.$transaction(async (tx) => {
    // Create base order data
    const baseOrderData = {
      active: true,
      restaurantId: getOutlet.id,
      createdBy: `${validCustomer.customer.name}-(${validCustomer.customer.role})`,
      isPaid: paymentId ? true : false,
      generatedOrderId: orderId,
      orderType,
      totalNetPrice,
      gstPrice,
      totalAmount: totalAmount,
      totalGrossProfit,
      note,
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
                    )?.price
                  ),
                  gst: Number(
                    item?.menuItem.menuItemVariants.find(
                      (v: any) => v?.id === item?.sizeVariantsId
                    )?.gst
                  ),
                  netPrice: Number(
                    item?.menuItem.menuItemVariants.find(
                      (v: any) => v?.id === item?.sizeVariantsId
                    )?.netPrice
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
            create: item?.addOnSelected?.map((addon: any) => ({
              addOnId: addon?.id,
              name: item?.menuItem?.menuGroupAddOns?.find(
                (gAddon: any) => gAddon?.id === addon?.id
              )?.addOnGroupName,
              selectedAddOnVariantsId: {
                create: addon?.selectedVariantsId?.map((addOnVariant: any) => {
                  const matchedVaraint = item?.menuItem?.menuGroupAddOns
                    ?.find((gAddon: any) => gAddon?.id === addon?.id)
                    ?.addonVariants?.find(
                      (variant: any) => variant?.id === addOnVariant?.id
                    );
                  return {
                    selectedAddOnVariantId: addOnVariant?.id,
                    name: matchedVaraint?.name,
                    type: matchedVaraint?.type,
                    price: Number(matchedVaraint?.price),
                  };
                }),
              },
            })),
          },
        })),
      },
    };

    let orderSession;

    if (orderType === OrderType.DINEIN) {
      // Handle DINEIN order
      const checkTable = await tx.table.findFirst({
        where: { id: tableId, occupied: true },
      });

      //alloted table for staff
      const staffTables = await tx.staff.findFirst({
        where: {
          restaurantId: getOutlet.id,
          role: "WAITER",
          assignedTables: {
            has: tableId,
          },
        },
      });

      console.log(`Staff Assigned-${staffTables?.name}`);

      if (!checkTable) {
        throw new BadRequestsException(
          "You Need to scan the Qr Code again to place Order",
          ErrorCode.UNPROCESSABLE_ENTITY
        );
      }

      // Create or update order session for DINEIN
      orderSession = checkTable.currentOrderSessionId
        ? await tx.orderSession.update({
            where: { id: checkTable.currentOrderSessionId },
            data: {
              orders: {
                create: {
                  ...baseOrderData,
                  staffId: staffTables?.id,
                  orderStatus: "ONHOLD",
                },
              },
            },
            include: {
              orders: {
                include: {
                  orderItems: true,
                },
              },
              table: true,
            },
          })
        : await tx.orderSession.create({
            data: {
              billId: getOutlet?.invoice?.isGSTEnabled
                ? `${getOutlet?.invoice?.prefix}${
                    getOutlet?.invoice?.invoiceNo
                  }/${getYear(new Date())}`
                : billNo,
              username: validCustomer?.customer?.name,
              phoneNo: validCustomer?.customer?.phoneNo,
              customerId: validCustomer?.id,
              staffId: staffTables?.id,
              tableId,
              platform: "ONLINE",
              restaurantId: getOutlet.id,
              orderType,

              orders: {
                create: {
                  ...baseOrderData,
                  staffId: staffTables?.id,
                  orderStatus: "ONHOLD",
                },
              },
            },
            include: {
              orders: {
                include: {
                  orderItems: true,
                },
              },
              table: true,
            },
          });

      // Update table if new session
      if (!checkTable.currentOrderSessionId) {
        await tx.table.update({
          where: { id: tableId },
          data: { currentOrderSessionId: orderSession.id },
        });
        if (getOutlet?.invoice?.id) {
          await tx.invoice.update({
            where: {
              restaurantId: getOutlet.id,
            },
            data: {
              invoiceNo: { increment: 1 },
            },
          });
        }
      }
    } else {
      // Handle TAKEAWAY or DELIVERY order
      orderSession = await tx.orderSession.create({
        data: {
          billId: getOutlet?.invoice?.isGSTEnabled
            ? `${getOutlet?.invoice?.prefix}${
                getOutlet?.invoice?.invoiceNo
              }/${getYear(new Date())}`
            : billNo,
          orderType,
          username: validCustomer?.customer?.name,
          phoneNo: validCustomer?.customer?.phoneNo,
          customerId: validCustomer?.id,
          restaurantId: getOutlet?.id,
          platform: "ONLINE",
          transactionId: paymentId,
          paymentMode: paymentMode,
          isPaid: true,
          paymentMethod: paymentId ? "UPI" : "CASH",
          subTotal: calculate.roundedTotal,
          deliveryFee: calculate?.deliveryFee,
          packingFee: calculate?.packingFee,
          deliveryArea,
          deliveryAreaAddress,
          deliveryAreaLandmark,
          deliveryAreaLat,
          deliveryAreaLong,
          orders: { create: { ...baseOrderData, orderStatus: "ONHOLD" } },
        },
        include: {
          orders: {
            include: {
              orderItems: true,
            },
          },
          table: true,
        },
      });

      if (getOutlet?.invoice?.id) {
        await tx.invoice.update({
          where: {
            restaurantId: getOutlet.id,
          },
          data: {
            invoiceNo: { increment: 1 },
          },
        });
      }
      // Update customer access stats
      await tx.customerRestaurantAccess.update({
        where: {
          id: validCustomer?.id,
          restaurantId: outletId,
        },
        data: {
          lastVisit: new Date(),
          totalOrders: { increment: 1 },
          totalSpent: { increment: Number(totalAmount) },
        },
      });
    }

    // Update raw material stock if `chooseProfit` is "itemRecipe"
    await Promise.all(
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
      })
    );

    // Send notification
    // await NotificationService.sendNotification(
    //   getOutlet.fcmToken!,
    //   `${orderType === "DINEIN" ? `Table ${checkTable?.name}` : orderType}: New Order from ${
    //     validCustomer.customer.name
    //   }`,
    //   `Order: ${orderItems?.length}`
    // );

    // Delete any LOW_STOCK alerts for this restaurant
    await tx.alert.deleteMany({
      where: {
        restaurantId: getOutlet.id,
        type: "LOW_STOCK",
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
      },
    });

    const orderData = {
      id: orderSession.id,
      billId: orderSession.billId,
      active: orderSession.active,
      orderType: orderSession.orderType,
      status: orderSession.sessionStatus,
      isPaid: orderSession.isPaid,
      subTotal: orderSession.subTotal,
      paymentMethod: orderSession.paymentMethod,
      orders: orderSession.orders.map((order) => ({
        id: order.id,
        orderStatus: order.orderStatus,
        totalAmount: order.totalAmount,
        orderItems: order.orderItems.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          total: Number(item.totalPrice),
          originalRate: Number(item.originalRate),
        })),
      })),
      customerInfo: {
        name: orderSession.username,
        phoneNo: orderSession.phoneNo,
      },
      tableInfo: orderSession.tableId
        ? {
            name: `${orderSession.table?.name}`,
            area: "Main Area",
          }
        : undefined,
    };

    if (orderType === "DINEIN" && orderSession?.tableId) {
      await sendNewOrderNotification({
        restaurantId: getOutlet.id,
        orderId: orderId,
        orderNumber: orderId,
        customerName: orderData?.customerInfo?.name,
        tableId: orderSession?.tableId,
      });
    }

    return orderSession;
  });

  // Create notification
  await prismaDB.notification.create({
    data: {
      restaurantId: getOutlet.id,
      orderId,
      message: "You have a new Order",
      orderType,
    },
  });
  await Promise.all([
    redis.del(`liv-online-${outletId}`),
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
    redis.del(`${outletId}-all-items-online-and-delivery`),
    redis.del(`${outletId}-all-items`),
  ]);
  await redis.publish("orderUpdated", JSON.stringify({ outletId }));
  // Notify clients and update Redis
  websocketManager.notifyClients(getOutlet.id, "CUSTOMER_ONLINE");
  return res.json({
    success: true,
    sessionId: result.id,
    kotNumber: orderId,
    message: "Order Created by Customer ✅",
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

  await prismaDB.$transaction(async (tx) => {
    await tx.orderSession.update({
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
            totalAmount: totalAmount,
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

    await Promise.all(
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
      })
    );

    // Delete any LOW_STOCK alerts for this restaurant
    await tx.alert.deleteMany({
      where: {
        restaurantId: getOutlet.id,
        type: "LOW_STOCK",
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
      },
    });
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

  await Promise.all([
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
    redis.del(`${outletId}-all-items-online-and-delivery`),
    redis.del(`${outletId}-all-items`),
  ]);
  await redis.publish("orderUpdated", JSON.stringify({ outletId }));
  websocketManager.notifyClients(outletId, "NEW_ORDER_SESSION_UPDATED");

  return res.json({
    success: true,
    orderSessionId: orderId,
    kotNumber: generatedId,
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
      updatedAt: getOrderById?.updatedAt,
    },
  });

  const transaction = await prismaDB.cashTransaction.findFirst({
    where: {
      orderId: getOrderById.id,
      register: {
        restaurantId: outletId,
      },
    },
  });

  await prismaDB.cashTransaction.update({
    where: {
      id: transaction?.id,
    },
    data: {
      paymentMethod: paymentMethod,
      updatedAt: transaction?.updatedAt,
    },
  });

  await Promise.all([
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
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
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
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
    // Refresh Redis cache
    await Promise.all([
      redis.del(`active-os-${outletId}`),
      redis.del(`liv-o-${outletId}`),
      redis.del(`tables-${outletId}`),
      redis.del(`a-${outletId}`),
      redis.del(`o-n-${outletId}`),
      redis.del(`${outletId}-stocks`),
      redis.del(`${outletId}-all-items-online-and-delivery`),
      redis.del(`${outletId}-all-items`),
    ]);

    //if order is dineIn then update the table status to unoccupied
    if (getOrderById.orderType === "DINEIN") {
      //find table
      const table = await tx.table.findFirst({
        where: {
          id: getOrderById?.tableId!,
          restaurantId: outletId,
        },
      });

      if (!table?.id) {
        throw new NotFoundException("Table Not Found", ErrorCode.NOT_FOUND);
      }

      await tx.table.update({
        where: {
          id: table.id,
          restaurantId: outletId,
        },
        data: { occupied: false, currentOrderSessionId: null },
      });
    }

    // Get all orders in this order session with their order items
    const orders = await tx.order.findMany({
      where: {
        orderSessionId: getOrderById.id,
        restaurantId: outletId,
      },
      include: {
        orderItems: {
          include: {
            menuItem: {
              include: {
                itemRecipe: {
                  include: {
                    ingredients: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Restore raw material stock for each order item if menuItem's chooseProfit is "itemRecipe"
    for (const order of orders) {
      for (const item of order.orderItems) {
        if (
          item.menuItem?.chooseProfit === "itemRecipe" &&
          item.menuItem.itemRecipe
        ) {
          for (const ingredient of item.menuItem.itemRecipe.ingredients) {
            const rawMaterial = await tx.rawMaterial.findUnique({
              where: { id: ingredient.rawMaterialId },
            });

            if (rawMaterial) {
              let incrementStock = 0;

              // Check if the ingredient's unit matches the purchase unit or consumption unit
              if (ingredient.unitId === rawMaterial.minimumStockLevelUnit) {
                // If MOU is linked to purchaseUnit, multiply directly with quantity
                incrementStock =
                  Number(ingredient.quantity) * Number(item.quantity || 1);
              } else if (ingredient.unitId === rawMaterial.consumptionUnitId) {
                // If MOU is linked to consumptionUnit, apply conversion factor
                incrementStock =
                  (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                  Number(rawMaterial.conversionFactor || 1);
              } else {
                // Default fallback if MOU doesn't match either unit
                incrementStock =
                  (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                  Number(rawMaterial.conversionFactor || 1);
              }

              // Calculate the new stock level after incrementing
              const newStockLevel =
                Number(rawMaterial.currentStock) + Number(incrementStock);

              // Check if the new stock level would be negative
              if (newStockLevel < 0) {
                throw new BadRequestsException(
                  `Cannot delete order item: Stock for ${
                    rawMaterial.name
                  } would go negative. Current stock: ${rawMaterial.currentStock?.toFixed(
                    2
                  )}, Required stock: ${incrementStock}`,
                  ErrorCode.UNPROCESSABLE_ENTITY
                );
              }

              // Update the raw material stock
              await tx.rawMaterial.update({
                where: { id: rawMaterial.id },
                data: {
                  currentStock: newStockLevel,
                },
              });
            }
          }
        }
      }
    }

    // Update the `orderSession` status to "CANCELLED"
    await tx.orderSession.update({
      where: {
        id: getOrderById.id,
      },
      data: {
        sessionStatus: "CANCELLED",
        active: false,
        updatedAt: getOrderById?.updatedAt,
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
        updatedAt: getOrderById?.updatedAt,
      },
    });

    // Delete all alerts linked to any order in this order session
    if (orders.length > 0) {
      const orderIds = orders.map((order) => order.id);
      await tx.alert.deleteMany({
        where: {
          restaurantId: outlet.id,
          OR: [
            {
              orderId: {
                in: orderIds,
              },
              status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
            },
            {
              type: "LOW_STOCK",
              status: { in: ["PENDING", "ACKNOWLEDGED"] },
            },
          ],
        },
      });
    } else {
      // If no orders, just delete LOW_STOCK alerts
      await tx.alert.deleteMany({
        where: {
          restaurantId: outletId,
          type: "LOW_STOCK",
          status: { in: ["PENDING", "ACKNOWLEDGED"] },
        },
      });
    }
  });

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

  // Get all orders in this order session with their order items before deletion
  const orders = await prismaDB.order.findMany({
    where: {
      orderSessionId: getOrderById.id,
      restaurantId: outlet.id,
    },
    include: {
      orderItems: {
        include: {
          menuItem: {
            include: {
              itemRecipe: {
                include: {
                  ingredients: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Restore raw material stock for each order item if menuItem's chooseProfit is "itemRecipe"
  for (const order of orders) {
    for (const item of order.orderItems) {
      if (
        item.menuItem?.chooseProfit === "itemRecipe" &&
        item.menuItem.itemRecipe
      ) {
        for (const ingredient of item.menuItem.itemRecipe.ingredients) {
          const rawMaterial = await prismaDB.rawMaterial.findUnique({
            where: { id: ingredient.rawMaterialId },
          });

          if (rawMaterial) {
            let incrementStock = 0;

            // Check if the ingredient's unit matches the purchase unit or consumption unit
            if (ingredient.unitId === rawMaterial.minimumStockLevelUnit) {
              // If MOU is linked to purchaseUnit, multiply directly with quantity
              incrementStock =
                Number(ingredient.quantity) * Number(item.quantity || 1);
            } else if (ingredient.unitId === rawMaterial.consumptionUnitId) {
              // If MOU is linked to consumptionUnit, apply conversion factor
              incrementStock =
                (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                Number(rawMaterial.conversionFactor || 1);
            } else {
              // Default fallback if MOU doesn't match either unit
              incrementStock =
                (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                Number(rawMaterial.conversionFactor || 1);
            }

            await prismaDB.rawMaterial.update({
              where: { id: rawMaterial.id },
              data: {
                currentStock:
                  Number(rawMaterial.currentStock) + Number(incrementStock),
              },
            });
          }
        }
      }
    }
  }

  // Delete any LOW_STOCK alerts for this restaurant
  await prismaDB.alert.deleteMany({
    where: {
      restaurantId: outletId,
      type: "LOW_STOCK",
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
    },
  });

  await prismaDB.orderSession.delete({
    where: {
      id: getOrderById.id,
      restaurantId: outlet.id,
    },
  });
  await Promise.all([
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
    redis.del(`${outletId}-all-items-online-and-delivery`),
    redis.del(`${outletId}-all-items`),
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
    await Promise.all([
      redis.del(`active-os-${outletId}`),
      redis.del(`liv-o-${outletId}`),
      redis.del(`tables-${outletId}`),
      redis.del(`a-${outletId}`),
      redis.del(`o-n-${outletId}`),
      redis.del(`${outletId}-stocks`),
      redis.del(`${outletId}-all-items-online-and-delivery`),
      redis.del(`${outletId}-all-items`),
    ]);

    // Get all orders in these order sessions with their order items
    const orders = await tx.order.findMany({
      where: {
        orderSessionId: {
          in: selectedId,
        },
        restaurantId: outlet.id,
      },
      include: {
        orderItems: {
          include: {
            menuItem: {
              include: {
                itemRecipe: {
                  include: {
                    ingredients: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Restore raw material stock for each order item if menuItem's chooseProfit is "itemRecipe"
    for (const order of orders) {
      for (const item of order.orderItems) {
        if (
          item.menuItem?.chooseProfit === "itemRecipe" &&
          item.menuItem.itemRecipe
        ) {
          for (const ingredient of item.menuItem.itemRecipe.ingredients) {
            const rawMaterial = await tx.rawMaterial.findUnique({
              where: { id: ingredient.rawMaterialId },
            });

            if (rawMaterial) {
              let incrementStock = 0;

              // Check if the ingredient's unit matches the purchase unit or consumption unit
              if (ingredient.unitId === rawMaterial.minimumStockLevelUnit) {
                // If MOU is linked to purchaseUnit, multiply directly with quantity
                incrementStock =
                  Number(ingredient.quantity) * Number(item.quantity || 1);
              } else if (ingredient.unitId === rawMaterial.consumptionUnitId) {
                // If MOU is linked to consumptionUnit, apply conversion factor
                incrementStock =
                  (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                  Number(rawMaterial.conversionFactor || 1);
              } else {
                // Default fallback if MOU doesn't match either unit
                incrementStock =
                  (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                  Number(rawMaterial.conversionFactor || 1);
              }

              await tx.rawMaterial.update({
                where: { id: rawMaterial.id },
                data: {
                  currentStock:
                    Number(rawMaterial.currentStock) + Number(incrementStock),
                },
              });
            }
          }
        }
      }
    }

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

    // Delete all alerts linked to any order in these order sessions
    if (orders.length > 0) {
      const orderIds = orders.map((order) => order.id);
      await tx.alert.deleteMany({
        where: {
          restaurantId: outlet.id,
          OR: [
            {
              orderId: {
                in: orderIds,
              },
              status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
            },
            {
              type: "LOW_STOCK",
              status: { in: ["PENDING", "ACKNOWLEDGED"] },
            },
          ],
        },
      });
    } else {
      // If no orders, just delete LOW_STOCK alerts
      await tx.alert.deleteMany({
        where: {
          restaurantId: outletId,
          type: "LOW_STOCK",
          status: { in: ["PENDING", "ACKNOWLEDGED"] },
        },
      });
    }
  });

  return res.json({
    success: true,
    message: "Select Order Transaction Deleted ✅",
  });
};

export const orderStatusOnlinePatch = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const validTypes = Object.values(OrderStatus);
  const { orderId, preparationTime, orderStatus } = req.body;
  console.log(req.body);
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
      preparationTime,
      orderStatus: "PREPARING",
      updatedAt: getOrderById?.updatedAt,
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

  await Promise.all([
    redis.del(`liv-online-${outletId}`),
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
    redis.del(`alerts-${outletId}`),
  ]);

  websocketManager.notifyClients(outletId, "NEW_ALERT");
  websocketManager.notifyClients(outlet?.id, "ORDER_UPDATED");

  return res.json({
    success: true,
    message: "Order Accepted ✅",
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
      updatedAt: getOrderById?.updatedAt,
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

  await Promise.all([
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
    redis.del(`alerts-${outletId}`),
  ]);

  websocketManager.notifyClients(outletId, "NEW_ALERT");
  websocketManager.notifyClients(outlet?.id, "ORDER_UPDATED");

  return res.json({
    success: true,
    message: "Order Status Update Success ✅",
  });
};

export const getAllOrderByStaff = async (req: Request, res: Response) => {
  const { outletId } = req.params;

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

export const menuCardSchema = z.object({
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
                }. Current stock: ${rawMaterial.currentStock?.toFixed(2)} ${
                  rawMaterial?.purchasedUnit
                }, Required: ${Math.abs(stockAdjustment)} ${
                  rawMaterial?.purchasedUnit
                }`,
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

    // Update related alerts to resolved
    await prisma.alert.deleteMany({
      where: {
        restaurantId: outlet.id,
        orderId: getOrder?.order?.id,
        status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
      },
    });

    // Delete any LOW_STOCK alerts for this restaurant
    await prisma.alert.deleteMany({
      where: {
        restaurantId: outletId,
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
      redis.del(`alerts-${outletId}`),
      redis.del(`${outletId}-all-items-online-and-delivery`),
      redis.del(`${outletId}-all-items`),
    ]);
  });

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
          orderSession: {
            include: {
              orders: true,
            },
          },
        },
      },
      menuItem: {
        include: {
          itemRecipe: {
            include: {
              ingredients: true,
            },
          },
        },
      },
    },
  });

  if (!orderItem?.id) {
    throw new NotFoundException("OrderItem Not Found", ErrorCode.NOT_FOUND);
  }

  const parentOrder = await prismaDB.order.findFirst({
    where: {
      id: orderItem.orderId,
      restaurantId: outletId,
    },
    include: {
      orderSession: {
        include: {
          table: true,
          orders: true,
        },
      },
    },
  });

  if (!parentOrder?.id) {
    throw new NotFoundException("Order Not Found", ErrorCode.NOT_FOUND);
  }

  const orderSession = parentOrder.orderSession;

  // Use Prisma transaction for atomic operation
  await prismaDB.$transaction(async (tx) => {
    // Refresh caches after successful transaction
    await Promise.all([
      redis.del(`active-os-${outletId}`),
      redis.del(`liv-o-${outletId}`),
      redis.del(`tables-${outletId}`),
      redis.del(`a-${outletId}`),
      redis.del(`o-n-${outletId}`),
      redis.del(`${outletId}-stocks`),
      redis.del(`${outletId}-all-items-online-and-delivery`),
      redis.del(`${outletId}-all-items`),
    ]);

    // If menuItem's chooseProfit is "itemRecipe", restore raw material stock
    if (
      orderItem.menuItem?.chooseProfit === "itemRecipe" &&
      orderItem.menuItem.itemRecipe
    ) {
      for (const ingredient of orderItem.menuItem.itemRecipe.ingredients) {
        const rawMaterial = await tx.rawMaterial.findUnique({
          where: { id: ingredient.rawMaterialId },
        });

        if (rawMaterial) {
          let incrementStock = 0;

          // Check if the ingredient's unit matches the purchase unit or consumption unit
          if (ingredient.unitId === rawMaterial.minimumStockLevelUnit) {
            // If MOU is linked to purchaseUnit, multiply directly with quantity
            incrementStock =
              Number(ingredient.quantity) * Number(orderItem.quantity || 1);
          } else if (ingredient.unitId === rawMaterial.consumptionUnitId) {
            // If MOU is linked to consumptionUnit, apply conversion factor
            incrementStock =
              (Number(ingredient.quantity) * Number(orderItem.quantity || 1)) /
              Number(rawMaterial.conversionFactor || 1);
          } else {
            // Default fallback if MOU doesn't match either unit
            incrementStock =
              (Number(ingredient.quantity) * Number(orderItem.quantity || 1)) /
              Number(rawMaterial.conversionFactor || 1);
          }

          // Calculate the new stock level after incrementing
          const newStockLevel =
            Number(rawMaterial.currentStock) + Number(incrementStock);

          // Check if the new stock level would be negative
          if (newStockLevel < 0) {
            throw new BadRequestsException(
              `Cannot delete order item: Stock for ${rawMaterial.name} would go negative. Current stock: ${rawMaterial.currentStock}, Required amount: ${incrementStock}`,
              ErrorCode.UNPROCESSABLE_ENTITY
            );
          }

          // Update the raw material stock
          await tx.rawMaterial.update({
            where: { id: rawMaterial.id },
            data: {
              currentStock: newStockLevel,
            },
          });
        }
      }
    }

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

      // Check if there are other orders in the orderSession
      const remainingOrders = orderSession.orders.filter(
        (o) => o.id !== parentOrder.id
      );

      if (remainingOrders.length === 0) {
        // No orders left in orderSession, mark as CANCELLED
        // dont cancel if the orderType is DINEIN
        if (orderSession.orderType !== "DINEIN") {
          await tx.orderSession.update({
            where: { id: orderSession.id },
            data: { sessionStatus: "CANCELLED", active: false },
          });
        }
      }
    } else {
      // Recalculate Order totals
      const totalGrossProfit = remainingOrderItems.reduce(
        (total, item) =>
          total + (Number(item.grossProfit) * Number(item.quantity) || 0),
        0
      );
      const totalNetPrice = remainingOrderItems.reduce(
        (total, item) =>
          total +
          (parseFloat(item.netPrice as string) * Number(item.quantity) || 0),
        0
      );
      const gstPrice = remainingOrderItems.reduce(
        (total, item) =>
          total + (Number(item.gst) * Number(item.quantity) || 0),
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
          totalAmount: totalAmount,
        },
      });
    }

    // Update related alerts to resolved
    await tx.alert.deleteMany({
      where: {
        restaurantId: outlet.id,
        orderId: parentOrder?.id,
        status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
      },
    });

    // Delete any LOW_STOCK alerts for this restaurant
    await tx.alert.deleteMany({
      where: {
        restaurantId: outletId,
        type: "LOW_STOCK",
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
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
    redis.del(`alerts-${outletId}`),
  ]);

  websocketManager.notifyClients(outletId, "NEW_ORDER_SESSION_UPDATED");

  return res.json({
    success: true,
    message: "Order Item Deleted",
    data: {
      orderId: parentOrder?.id,
      generatedOrderId: parentOrder?.generatedOrderId,
      name: parentOrder?.orderSession.username,
      mode: parentOrder?.orderSession.orderType,
      table: parentOrder?.orderSession.table?.name,
    },
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

export const getParentOrder = async (req: Request, res: Response) => {
  const { orderItemId, outletId } = req.params;

  const outlet = await getOutletById(outletId);
  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const orderItem = await prismaDB.orderItem.findFirst({
    where: { id: orderItemId, order: { restaurantId: outletId } },
  });

  if (!orderItem?.id) {
    throw new NotFoundException("OrderItem Not Found", ErrorCode.NOT_FOUND);
  }

  const parentOrder = await prismaDB.order.findFirst({
    where: { id: orderItem.orderId },
    include: {
      orderSession: {
        include: {
          table: true,
        },
      },
    },
  });

  return res.json({
    success: true,
    data: {
      orderId: parentOrder?.id,
      generatedOrderId: parentOrder?.generatedOrderId,
      name: parentOrder?.orderSession.username,
      mode: parentOrder?.orderSession.orderType,
      table: parentOrder?.orderSession.table?.name,
    },
  });
};
