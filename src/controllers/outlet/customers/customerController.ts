import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { redis } from "../../../services/redis";

export const getAllCustomer = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const redisCustomers = await redis.get(`customers-${outletId}`);

  if (redisCustomers) {
    return res.json({
      success: true,
      customers: JSON.parse(redisCustomers),
      message: "Powered In",
    });
  }

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const customers = await prismaDB.customer.findMany({
    where: {
      restaurantId: getOutlet.id,
    },
    include: {
      orderSession: {
        include: {
          orders: true,
        },
      },
    },
  });

  await redis.set(`customers-${getOutlet.id}`, JSON.stringify(customers));

  return res.json({
    success: true,
    customers: customers,
  });
};
