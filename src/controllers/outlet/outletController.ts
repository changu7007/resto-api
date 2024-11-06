import { Request, Response } from "express";
import {
  getOutletByAdminId,
  getOutletById,
  getOutletByIdForStaff,
} from "../../lib/outlet";
import { NotFoundException } from "../../exceptions/not-found";
import { ErrorCode } from "../../exceptions/root";
import { redis } from "../../services/redis";
import { prismaDB } from "../..";
import { BadRequestsException } from "../../exceptions/bad-request";

export const getStaffOutlet = async (req: Request, res: Response) => {
  //@ts-ignore
  const getOutlet = await redis.get(`O-${req?.user?.restaurantId}`);

  if (getOutlet) {
    return res.status(200).json({
      success: true,
      outlet: JSON.parse(getOutlet),
      message: "Fetched Successfully from Redis",
    });
  }

  //@ts-ignore
  const outlet = await getOutletByIdForStaff(req?.user?.restaurantId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await redis.set(`O-${outlet.id}`, JSON.stringify(outlet));

  return res.status(200).json({
    success: true,
    outlet,
    message: "Fetched Successfully from DB",
  });
};

export const getByOutletId = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const getOutlet = await prismaDB.restaurant.findFirst({
    where: {
      // @ts-ignore
      adminId: req.user?.id,
      id: outletId,
    },
  });

  return res.json({ success: true, outlet: getOutlet });
};

export const getAllNotifications = async (req: Request, res: Response) => {
  // @ts-ignore
  const { outletId } = req.params;

  const rNotifications = await redis.get(`o-n-${outletId}`);

  if (rNotifications) {
    return res.json({
      success: true,
      notifications: JSON.parse(rNotifications),
      message: "Powered up ⚡",
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const notifications = await prismaDB.notification.findMany({
    where: {
      restaurantId: outlet.id,
      status: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await redis.set(`o-n-${outlet.id}`, JSON.stringify(notifications));

  return res.json({
    success: true,
    notifications: notifications,
    message: "Powering UP",
  });
};

export const getMainOutlet = async (req: Request, res: Response) => {
  const { userId } = req.params;

  //@ts-ignore
  if (userId !== req.user?.id) {
    throw new BadRequestsException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }
  //@ts-ignore
  const getOutlet = await redis.get(`O-${req?.user?.restaurantId}`);

  if (getOutlet) {
    console.log("Redis");
    return res.status(200).json({
      success: true,
      outlet: JSON.parse(getOutlet),
      message: "Fetched Successfully from Redis",
    });
  }

  const outlet = await getOutletByAdminId(
    //@ts-ignore
    req?.user?.restaurantId,
    //@ts-ignore
    req?.user?.id
  );

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await redis.set(`O-${outlet.id}`, JSON.stringify(outlet));

  return res.status(200).json({
    success: true,
    outlet,
    message: "Fetched Successfully from DB",
  });
};

export const patchOutletDetails = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const {
    name,
    imageurl,
    restaurantName,
    phoneNo,
    email,
    address,
    city,
    pincode,
  } = req.body;

  const getOutlet = await prismaDB.restaurant.findFirst({
    where: {
      // @ts-ignore
      adminId: req.user?.id,
      id: outletId,
    },
  });

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.restaurant.updateMany({
    where: {
      id: getOutlet.id,
    },
    data: {
      name: name ?? getOutlet.name,
      restaurantName: restaurantName ?? getOutlet.restaurantName,
      phoneNo: phoneNo ?? getOutlet.phoneNo,
      email: email ?? getOutlet.email,
      imageUrl: imageurl ?? getOutlet.imageUrl,
      address: address ?? getOutlet.address,
      city: city ?? getOutlet.city,
      pincode: pincode ?? getOutlet.pincode,
    },
  });
  return res.json({ success: true, message: "Updated Success" });
};

export const addFMCTokenToOutlet = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { token } = req.body;

  const getOutlet = await getOutletById(outletId);

  const updateOutlet = await prismaDB.restaurant.update({
    where: {
      id: getOutlet?.id,
    },
    data: {
      fcmToken: token,
    },
  });

  await redis.set(`O-${getOutlet?.id}`, JSON.stringify(updateOutlet));

  return res.json({
    success: true,
    message: "FMC TOKEN ADDED SUCCESFULLY",
  });
};
