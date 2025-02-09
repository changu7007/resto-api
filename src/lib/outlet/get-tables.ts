import { prismaDB } from "../..";
import { redis } from "../../services/redis";

export const getFetchAllTablesToRedis = async (outletId: string) => {
  const tables = await prismaDB.table.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      orderSession: {
        include: {
          orders: {
            include: { orderItems: true },
          },
        },
      },
      areas: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  await redis.set(`tables-${outletId}`, JSON.stringify(tables));

  return tables;
};

export const getFetchAllAreastoRedis = async (outletId: string) => {
  const allAreas = await prismaDB.areas.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      table: {
        include: {
          orderSession: {
            include: {
              orders: {
                include: {
                  orderItems: {
                    include: {
                      selectedVariant: true,
                      addOnSelected: true,
                      menuItem: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const filteredAreas = allAreas.map((area) => ({
    id: area.id,
    restaurantId: area.restaurantId,
    name: area.name,
    createdAt: area.createdAt,
    updatedAt: area.updatedAt,
    table: area.table.map((tab) => ({
      id: tab.id,
      restaurantId: tab.restaurantId,
      name: tab.name,
      shortCode: tab.shortCode,
      capacity: tab.capacity,
      uniqueId: tab.uniqueId,
      inviteCode: tab.inviteCode,
      qrcode: tab.qrcode,
      areaId: tab.areaId,
      currentOrderSessionId: tab.currentOrderSessionId,
      staffId: tab.staffId,
      customerId: tab.customerId,
      createdAt: tab.createdAt,
      occupied: tab.occupied,
      orderSession: tab.orderSession.map((orderSess) => ({
        id: orderSess.id,
        name: orderSess.username,
        billNo: orderSess.billId,
        phoneNo: orderSess.phoneNo,
        sessionStatus: orderSess.sessionStatus,
        isPaid: orderSess.isPaid,
        paymentmethod: orderSess.paymentMethod,
        active: orderSess.active,
        orderMode: orderSess.orderType,
        table: orderSess.tableId,
        subTotal: orderSess.subTotal,
        createdBy: orderSess.createdBy,
        orders: orderSess.orders.map((order) => ({
          id: order.id,
          generatedOrderId: order.generatedOrderId,
          mode: order.orderType,
          orderStatus: order.orderStatus,
          paid: order.isPaid,
          totalAmount: order.totalAmount,
          totalNetPrice: order?.totalNetPrice,
          gstPrice: order?.gstPrice,
          totalGrossProfit: order?.totalGrossProfit,
          createdAt: order.createdAt,
          date: order.createdAt,
          orderItems: order.orderItems.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            netPrice: item.netPrice,
            gst: item.gst,
            gstPrice:
              (item.originalRate! - parseFloat(item.netPrice!)) *
              Number(item.quantity),
            grossProfit: item.grossProfit,
            totalPrice: item.totalPrice,
          })),
          updatedAt: order.updatedAt,
        })),
        date: orderSess.createdAt,
      })),
    })),
  }));

  await redis.set(`a-${outletId}`, JSON.stringify(filteredAreas));

  return allAreas;
};
