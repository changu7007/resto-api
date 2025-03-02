import { Request, Response } from "express";
import {
  getFormatUserAndSendToRedis,
  getOwnerById,
} from "../../../lib/get-users";
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

  if (!body.type) {
    throw new BadRequestsException(
      "Please Select neccessary Outlet Type",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.$transaction(async (prisma) => {
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        pan: body.pan,
        address: body?.isAddress ? body?.legalAddress : body.address,
      },
    });

    const findRestaurant = await prisma.restaurant.findFirst({
      where: {
        adminId: userId,
      },
    });

    if (findRestaurant?.id) {
      const outlet = await prisma.restaurant.update({
        where: {
          id: findRestaurant.id,
          adminId: userId,
        },
        data: {
          name: body.appName,
          address: body.address,
          restaurantName: body.name,
          pincode: body.pincode,
          GSTIN: body.gstin,
          city: body.city,
          fssai: body.fssai,
          businessType: body?.businessType,
          state: body.state,
          country: body.country,
          outletType: body.type,
        },
      });

      await getFormatUserAndSendToRedis(userId);
      return res.json({
        success: true,
        outletId: outlet.id,
        message: "Outlet Created",
      });
    } else {
      const outlet = await prisma.restaurant.create({
        data: {
          name: body.appName,
          restaurantName: body.name,
          adminId: userId,
          address: body.address,
          pincode: body.pincode,
          GSTIN: body.gstin,
          city: body.city,
          fssai: body.fssai,
          state: body.state,
          businessType: body?.businessType,
          country: body.country,
          outletType: body.type,
        },
      });

      await prisma.integration.create({
        data: {
          name: "RAZORAPY",
          description: "Integrate your own payment for receiveing the Order",
          logo: "https://s3.ap-south-1.amazonaws.com/dr.sync/66710f2af99f1affa13031a5/menu/95513bb1836068b2b6776b6678b37991135335e4830540728f69b12f11df3c78",
          connected: false,
          status: true,
          restaurantId: outlet.id,
        },
      });

      await prisma.integration.create({
        data: {
          name: "ZOMATO",
          connected: false,
          description: "Manage your Zomato Orders through our portal",
          logo: "https://s3.ap-south-1.amazonaws.com/dr.sync/66710f2af99f1affa13031a5/menu/96cbea8b97fe457801b3519df3d1fca2691aa8e59c962535920476f04781068f",
          status: false,
          restaurantId: outlet.id,
        },
      });

      await prisma.integration.create({
        data: {
          name: "SWIGGY",
          connected: false,
          description: "Manage your Swiggy Orders through our portal",
          logo: "https://s3.ap-south-1.amazonaws.com/dr.sync/66710f2af99f1affa13031a5/menu/fea654c0a9447f453c5142377b23e594b73c29dc435822363627e3743e7f0dc3",
          status: false,
          restaurantId: outlet.id,
        },
      });

      await prismaDB.invoice.create({
        data: {
          restaurantId: outlet.id,
          isGSTEnabled: true,
          isPrefix: false,
          invoiceNo: 1,
          prefix: "",
        },
      });

      await getFormatUserAndSendToRedis(userId);

      return res.json({
        success: true,
        outletId: outlet.id,
        message: "Outlet Created",
      });
    }
  });
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

  await getFormatUserAndSendToRedis(updatedUser?.id);

  return res.json({
    success: true,
    message: "Update Success",
  });
};
