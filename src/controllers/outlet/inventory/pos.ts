import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";

export const getVendorsForPOS = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const getOutlet = await getOutletById(outletId);
  if (!getOutlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }
  const vendors = await prismaDB.vendor.findMany({
    where: {
      restaurantId: outletId,
    },
    select: {
      id: true,
      name: true,
      isContract: true,
      contractRates: true,
    },
  });
  res.json({
    success: true,
    vendors,
  });
};
