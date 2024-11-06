import { Request, Response } from "express";
import { getOwnerById } from "../../../lib/get-users";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { redis } from "../../../services/redis";

export const getOnBoarding = async (req: Request, res: Response) => {
  // @ts-ignore
  const user = await getOwnerById(req?.user?.id);
  if (!user?.id) {
    throw new BadRequestsException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }
  const onboarding = await prismaDB.onboardingStatus.findFirst({
    where: { userId: user.id },
  });

  return res.json({
    success: true,
    onboarding: onboarding,
    message: "Fetched Onboarding",
  });
};

export const saveOnBoarding = async (req: Request, res: Response) => {
  console.log("reqbody", req.body);
  const { userId, step, data } = req.body;
  console.log("UserId", "step", "data", userId, step, data);
  // @ts-ignore
  if (userId !== req.user?.id) {
    throw new BadRequestsException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }
  await prismaDB.onboardingStatus.upsert({
    where: { userId },
    update: { currentStep: step, restaurantData: data },
    create: { userId, currentStep: step, restaurantData: data },
  });

  return res.json({
    success: true,
    message: "Saved Onboarding",
  });
};

export const createOutlet = async (req: Request, res: Response) => {
  const { userId, body } = req.body;

  // @ts-ignore
  if (userId !== req.user?.id) {
    throw new BadRequestsException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  if (!body.appName) {
    throw new BadRequestsException(
      "Outlet Short Name Is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!body.type || !body.planType) {
    throw new BadRequestsException(
      "Please Select neccessary plan & Outlet Type",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const findRestaurant = await prismaDB.restaurant.findFirst({
    where: {
      adminId: userId,
    },
  });

  if (findRestaurant?.id) {
    const outlet = await prismaDB.restaurant.update({
      where: {
        id: findRestaurant.id,
        adminId: userId,
      },
      data: {
        name: body.appName,
        address: body.address,
        pincode: body.pincode,
        GSTIN: body.gstin,
        // isSubscription: true,
        outletType: body.type,
        // subscriptionPlan: body.planType,
      },
    });

    return res.json({
      success: true,
      outletId: outlet.id,
      message: "Outlet Created",
    });
  } else {
    const outlet = await prismaDB.restaurant.create({
      data: {
        name: body.appName,
        adminId: userId,
        address: body.address,
        pincode: body.pincode,
        GSTIN: body.gstin,
        // isSubscription: true,
        outletType: body.type,
        // subscriptionPlan: body.planType,
      },
    });

    return res.json({
      success: true,
      outletId: outlet.id,
      message: "Outlet Created",
    });
  }
};

export const updateOnboardingStatus = async (req: Request, res: Response) => {
  console.log(req.body);
  const { userId } = req.body;

  // @ts-ignore
  if (userId !== req.user?.id) {
    throw new BadRequestsException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const updatedUser = await prismaDB.user.update({
    where: {
      id: userId,
    },
    data: {
      onboardingStatus: true,
    },
  });

  redis.set(updatedUser.id, JSON.stringify(updatedUser));

  return res.json({
    success: true,
    message: "Update Success",
  });
};
