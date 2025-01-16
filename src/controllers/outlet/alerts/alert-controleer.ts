import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { redis } from "../../../services/redis";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";

export const getAlerts = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const redisAlerts = await redis.get(`alerts-${outletId}`);

  if (redisAlerts) {
    return res.json({
      success: true,
      alerts: JSON.parse(redisAlerts),
    });
  }

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

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
      message: true,
      createdAt: true,
    },
  });

  await redis.set(`alerts-${outletId}`, JSON.stringify(alerts));
  return res.json({
    success: true,
    alerts: alerts,
    message: "Alerts",
  });
};

export const acknowledgeAlert = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const { id } = req.body;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }
  const findalerts = await prismaDB.alert.findFirst({
    where: {
      restaurantId: outletId,
      id,
    },
  });

  if (!findalerts?.id) {
    throw new NotFoundException("Alert Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.alert.update({
    where: {
      id: findalerts?.id,
      restaurantId: outletId,
    },
    data: {
      status: "ACKNOWLEDGED",
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
      message: true,
      createdAt: true,
    },
  });

  await redis.set(`alerts-${outletId}`, JSON.stringify(alerts));
  return res.json({
    success: true,
    message: "Alert Acknowledged ✅",
  });
};
