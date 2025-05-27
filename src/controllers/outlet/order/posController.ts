import { Request, Response } from "express";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
} from "../../../schema/staff";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";

import { prismaDB } from "../../..";
import { ErrorCode } from "../../../exceptions/root";

export const getPOSTableAllSessionOrders = async (
  req: Request,
  res: Response
) => {
  // @ts-ignore
  const { id: staffId } = req.user;
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
      staffId: staffId,
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
          staffId: staffId,
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
          subTotal: true, // Calculate total revenue per payment method
        },
      }),
      prismaDB.orderSession.groupBy({
        by: ["paymentMethod"],
        where: {
          restaurantId: outletId,
          staffId: staffId,
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
          staffId: staffId,
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
      staffId: staffId,
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

export const getPOSTableAllOrders = async (req: Request, res: Response) => {
  // @ts-ignore
  const { id: staffId } = req.user;
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
      staffId: staffId,
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
      staffId: staffId,
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
