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
          logo: "https://app-restobytes.s3.ap-south-1.amazonaws.com/66710f2af99f1affa13031a5/menu/e9aecb204a19b3ff05a920ecc002e9a9a9d385dfe676a8ef5ff85dcf083165af",
          connected: false,
          status: true,
          restaurantId: outlet.id,
        },
      });

      await prisma.integration.create({
        data: {
          name: "PHONEPE",
          description: "Integrate phonePe for taking payment from customers",
          logo: "https://app-restobytes.s3.ap-south-1.amazonaws.com/66710f2af99f1affa13031a5/menu/e9aecb204a19b3ff05a920ecc002e9a9a9d385dfe676a8ef5ff85dcf083165af",
          link: "https://business.phonepe.com/register?referral-code=RF2505191803179405044688",
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
          logo: "https://app-restobytes.s3.ap-south-1.amazonaws.com/66710f2af99f1affa13031a5/menu/6d11d26fb03ca31b3d71090afee2d3d6fc6705c4b0cc46279b094c85c1575c2a",
          status: false,
          restaurantId: outlet.id,
        },
      });

      await prisma.integration.create({
        data: {
          name: "SWIGGY",
          connected: false,
          description: "Manage your Swiggy Orders through our portal",
          logo: "https://app-restobytes.s3.ap-south-1.amazonaws.com/66710f2af99f1affa13031a5/menu/0f334bb9850c0e913c5a969f5a464cf26ca55df63fe269121dae04ad802dd8bc",
          status: false,
          restaurantId: outlet.id,
        },
      });

      await prisma.integration.create({
        data: {
          name: "PHONEPE",
          connected: false,
          description:
            "To start receving payment integrate your client ID and client Secret",
          logo: "https://app-restobytes.s3.ap-south-1.amazonaws.com/66710f2af99f1affa13031a5/menu/dac84bca0161c7e447ef9b4aff8f9b5a38632aead75e146b9911da862aa10abf",
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
