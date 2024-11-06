import { Request, Response } from "express";
import { getOrderSessionById, getOutletById } from "../../../../lib/outlet";
import { NotFoundException } from "../../../../exceptions/not-found";
import { ErrorCode } from "../../../../exceptions/root";
import { PaymentMethod } from "@prisma/client";
import { BadRequestsException } from "../../../../exceptions/bad-request";
import { prismaDB } from "../../../..";
import { redis } from "../../../../services/redis";
import { websocketManager } from "../../../../services/ws";
import {
  getFetchActiveOrderSessionToRedis,
  getFetchAllOrderSessionToRedis,
  getFetchAllOrdersToRedis,
  getFetchAllStaffOrderSessionToRedis,
  getFetchLiveOrderToRedis,
} from "../../../../lib/outlet/get-order";
import {
  getFetchAllAreastoRedis,
  getFetchAllTablesToRedis,
} from "../../../../lib/outlet/get-tables";
import { NotificationService } from "../../../../services/firebase";

export const billingOrderSession = async (req: Request, res: Response) => {
  const { orderSessionId, outletId } = req.params;

  const { subTotal, paymentMethod } = req.body;

  if (
    typeof subTotal !== "number" ||
    !Object.values(PaymentMethod).includes(paymentMethod)
  ) {
    throw new BadRequestsException(
      "Invalid total or Choose Payment method",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const orderSession = await getOrderSessionById(outlet.id, orderSessionId);

  if (!orderSession?.id) {
    throw new NotFoundException("Order Session not Found", ErrorCode.NOT_FOUND);
  }

  const updatedOrderSession = await prismaDB.orderSession.update({
    where: {
      id: orderSession.id,
      restaurantId: outlet.id,
    },
    data: {
      active: false,
      isPaid: true,
      paymentMethod: paymentMethod,
      subTotal: String(subTotal),
      sessionStatus: "COMPLETED",
      orders: {
        updateMany: {
          where: {
            orderStatus: "SERVED",
          },
          data: {
            active: false,
            isPaid: true,
            orderStatus: "COMPLETED",
          },
        },
      },
    },
    include: {
      orders: true,
    },
  });

  if (!updatedOrderSession) {
    throw new BadRequestsException(
      "Something went wrong while recieveing the bill",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }

  if (updatedOrderSession.orderType === "DINEIN") {
    const findTable = await prismaDB.table.findFirst({
      where: {
        restaurantId: outlet.id,
        currentOrderSessionId: orderSession.id,
      },
    });

    if (!findTable) {
      throw new BadRequestsException(
        "Could not find the table bill your looking for",
        ErrorCode.INTERNAL_EXCEPTION
      );
    }

    const updateTable = await prismaDB.table.update({
      where: {
        id: findTable?.id,
        restaurantId: outlet.id,
      },
      data: {
        occupied: false,
        currentOrderSessionId: null,
        customerId: null,
      },
    });

    if (!updateTable) {
      throw new BadRequestsException(
        "Could not remove the table session",
        ErrorCode.INTERNAL_EXCEPTION
      );
    }
    await getFetchLiveOrderToRedis(outletId);
    await getFetchAllTablesToRedis(outletId);
    await getFetchAllAreastoRedis(outletId);
  }

  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
    redis.del(`all-order-staff-${outletId}`),
  ]);

  await NotificationService.sendNotification(
    outlet?.fcmToken!,
    "Bill Recieved",
    `${subTotal}`
  );

  websocketManager.notifyClients(
    JSON.stringify({
      type: "BILL_UPDATED",
    })
  );

  return res.json({
    success: true,
    message: "Bill Recieved & Saved Success ✅",
  });
};
