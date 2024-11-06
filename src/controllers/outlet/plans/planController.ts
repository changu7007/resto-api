import { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { NotFoundException } from "../../../exceptions/not-found";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID as string,
  key_secret: process.env.RAZORPAY_KEY_SECRET as string,
});

export async function CreateRazorPayOrder(req: Request, res: Response) {
  const { amount } = req.body;
  const order = await razorpay.orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: "receipt_" + Math.random().toString(36).substring(7),
  });

  return res.json({
    success: true,
    orderId: order.id,
  });
}

export const paymentRazorpayVerification = async (
  req: Request,
  res: Response
) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const body = razorpayOrderId + "|" + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET as string)
    .update(body.toString())
    .digest("hex");

  const isAuthentic = expectedSignature === razorpaySignature;
  if (isAuthentic) {
    console.log(razorpayPaymentId);
    res.json({ success: true, message: "Payment Successfull" });
  } else {
    res.status(400).json({
      success: false,
    });
  }
};

export const buyPlan = async (req: Request, res: Response) => {
  const { paymentId, subscriptionId } = req.body;
  // @ts-ignore
  const userId = req.user?.id;

  if (!paymentId || !subscriptionId) {
    throw new BadRequestsException(
      "Payment ID not Verfied",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const findOwner = await prismaDB.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!findOwner?.id) {
    throw new NotFoundException("User Not Found", ErrorCode.NOT_FOUND);
  }

  const findSubscription = await prismaDB.subsciption.findFirst({
    where: {
      id: subscriptionId,
    },
  });

  if (!findSubscription) {
    throw new BadRequestsException(
      "No Subscription Found",
      ErrorCode.NOT_FOUND
    );
  }

  let validDate = new Date();

  if (findSubscription.planType === "MONTHLY") {
    validDate.setMonth(validDate.getMonth() + 1);
  } else if (findSubscription.planType === "ANNUALLY") {
    validDate.setFullYear(validDate.getFullYear() + 1);
  }

  await prismaDB.subscriptionBilling.create({
    data: {
      userId: findOwner.id,
      isSubscription: true,
      paymentId: paymentId,
      subscribedDate: new Date(),
      planType: findSubscription.planType,
      subscriptionPlan: findSubscription.subscriptionPlan,
      validDate: validDate,
    },
  });

  await prismaDB.user.update({
    where: {
      id: findOwner.id,
    },
    data: {
      isSubscribed: true,
      subscribedDate: new Date(),
    },
  });

  return res.json({
    success: true,
    message: "Your Subscription is now Active",
  });
};

export const getAllPlans = async (req: Request, res: Response) => {
  const plans = await prismaDB.subsciption.findMany();
  return res.json({
    success: true,
    plans,
  });
};
