import { OrderStatus, OrderType } from "@prisma/client";
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
    phoneNo,
    orderType,
    totalAmount,
    orderItems,
    tableId,
    orderMode,
  } = req.body;

  // @ts-ignore
  if (adminId !== req.user?.id) {
    throw new BadRequestsException("Invalid User", ErrorCode.UNAUTHORIZED);
  }

  const findUser = await prismaDB.user.findFirst({
    where: {
      id: adminId,
    },
  });

  if (!findUser?.id) {
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
      username: username ?? findUser.name,
      phoneNo: phoneNo ?? null,
      adminId: findUser.id,
      tableId: tableId,
      isPaid: isPaid,
      restaurantId: getOutlet.id,
      orders: {
        create: {
          restaurantId: getOutlet.id,
          isPaid: isPaid,
          active: true,
          orderStatus: orderStatus,
          totalAmount: totalAmount.toString(),
          generatedOrderId: orderId,
          orderType: orderType,
          orderItems: {
            create: orderItems.map((item: any) => ({
              menuId: item.menuId,
              quantity: item.quantity.toString(),
              sizeVariantsId: item.sizeVariantsId,
              addOnSelected: {
                create: item.addOnSelected.map((addon: any) => ({
                  addOnId: addon.id,
                  selectedAddOnVariantsId: {
                    create: addon.selectedVariantsId.map((variant: any) => ({
                      selectedAddOnVariantId: variant.id,
                    })),
                  },
                })),
              },
              price: item.price.toString(),
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
          inviteCode: inviteCode(),
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
        getFetchAllTablesToRedis(outletId),
        getFetchAllAreastoRedis(outletId),
      ]);

      websocketManager.notifyClients(
        JSON.stringify({
          type: "NEW_ORDER_SESSION_CREATED",
          orderId: orderSession.id,
        })
      );

      return res.json({
        success: true,
        orderSessionId: orderSession.id,
        message: "Order Created from Admin ✅",
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
      getFetchAllTablesToRedis(outletId),
      getFetchAllAreastoRedis(outletId),
    ]);

    websocketManager.notifyClients(
      JSON.stringify({
        type: "NEW_ORDER_SESSION_CREATED",
        orderId: orderSession.id,
      })
    );

    return res.json({
      success: true,
      orderSessionId: orderSession.id,
      message: "Order Created from Admin ✅",
    });
  }
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
            create: orderItems.map((item: any) => ({
              menuId: item.menuId,
              quantity: item.quantity.toString(),
              sizeVariantsId: item.sizeVariantsId,
              addOnSelected: {
                create: item.addOnSelected.map((addon: any) => ({
                  addOnId: addon.id,
                  selectedAddOnVariantsId: {
                    create: addon.selectedVariantsId.map((variant: any) => ({
                      selectedAddOnVariantId: variant.id,
                    })),
                  },
                })),
              },
              price: item.price.toString(),
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
      ]);

      websocketManager.notifyClients(
        JSON.stringify({
          type: "NEW_ORDER_SESSION_CREATED",
          orderId: orderSession.id,
        })
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
    ]);

    websocketManager.notifyClients(
      JSON.stringify({
        type: "NEW_ORDER_SESSION_CREATED",
        orderId: orderSession.id,
      })
    );

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

  const { customerId, isPaid, orderType, totalAmount, orderItems, tableId } =
    req.body;

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
        create: orderItems.map((item: any) => ({
          menuId: item.menuId,
          quantity: item.quantity.toString(),
          sizeVariantsId: item.sizeVariantsId,
          addOnSelected: {
            create: item.addOnSelected.map((addon: any) => ({
              addOnId: addon.id,
              selectedAddOnVariantsId: {
                create: addon.selectedVariantsId.map((variant: any) => ({
                  selectedAddOnVariantId: variant.id,
                })),
              },
            })),
          },
          price: item.price.toString(),
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
            create: orderItems.map((item: any) => ({
              menuId: item.menuId,
              quantity: item.quantity.toString(),
              sizeVariantsId: item.sizeVariantsId,
              addOnSelected: {
                create: item.addOnSelected.map((addon: any) => ({
                  addOnId: addon.id,
                  selectedAddOnVariantsId: {
                    create: addon.selectedVariantsId.map((variant: any) => ({
                      selectedAddOnVariantId: variant.id,
                    })),
                  },
                })),
              },
              price: item.price.toString(),
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
  ]);

  websocketManager.notifyClients(
    JSON.stringify({
      type: "NEW_ORDER_SESSION_UPDATED",
      orderId: orderSession.id,
    })
  );

  return res.json({
    success: true,
    orderSessionId: orderSession.id,
    message: "Order Added from Biller ✅",
  });
};

export const existingOrderPatchApp = async (req: Request, res: Response) => {
  const { outletId, orderId } = req.params;

  const { billerId, isPaid, totalAmount, orderItems, orderMode } = req.body;

  // @ts-ignore
  if (billerId !== req.user?.id) {
    throw new BadRequestsException("Invalid User", ErrorCode.UNAUTHORIZED);
  }

  const findBiller = await prismaDB.user.findFirst({
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
      adminId: findBiller.id,
      isPaid: isPaid,
      restaurantId: getOutlet.id,
      orders: {
        create: {
          active: true,
          restaurantId: getOutlet.id,
          isPaid: isPaid,
          orderStatus: orderStatus,
          totalAmount: totalAmount.toString(),
          generatedOrderId: generatedId,
          orderType: getOrder.orderType,
          orderItems: {
            create: orderItems.map((item: any) => ({
              menuId: item.menuId,
              quantity: item.quantity.toString(),
              sizeVariantsId: item.sizeVariantsId,
              addOnSelected: {
                create: item.addOnSelected.map((addon: any) => ({
                  addOnId: addon.id,
                  selectedAddOnVariantsId: {
                    create: addon.selectedVariantsId.map((variant: any) => ({
                      selectedAddOnVariantId: variant.id,
                    })),
                  },
                })),
              },
              price: item.price.toString(),
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
  ]);

  websocketManager.notifyClients(
    JSON.stringify({
      type: "NEW_ORDER_SESSION_UPDATED",
      orderId: orderSession.id,
    })
  );

  return res.json({
    success: true,
    orderSessionId: orderSession.id,
    message: "Order Added from Admin App ✅",
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

  websocketManager.notifyClients(
    JSON.stringify({
      type: "ORDER_UPDATED",
    })
  );

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

export const inviteCode = () => {
  let code = "";
  const MAX_LENGTH = 5;
  const alphabets = "ABCDEFGHIHJKLMNOPQRSTUVWXYZ0123456789";

  for (let i = 0; i < MAX_LENGTH; i++) {
    code += alphabets[Math.floor(Math.random() * alphabets.length)];
  }

  return code;
};