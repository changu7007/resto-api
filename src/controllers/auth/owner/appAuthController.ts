import { Request, Response } from "express";
import crypto from "crypto";
import * as jwt from "jsonwebtoken";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../../../secrets";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { ErrorCode } from "../../../exceptions/root";
import { userSchema } from "../../../schema/staff";
import { NotFoundException } from "../../../exceptions/not-found";
import { sendToken } from "../../../services/jwt";
import { redis } from "../../../services/redis";
import {
  getFormatUserAndSendToRedis,
  getOwnerUserByEmail,
} from "../../../lib/get-users";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prismaDB } from "../../..";
import {
  generateVerificationToken,
  getDaysRemaining,
} from "../../../lib/utils";
import { v4 as uuidv4 } from "uuid";
import { differenceInDays } from "date-fns";
import { UnauthorizedException } from "../../../exceptions/unauthorized";

export type FUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: Date | null;
  phoneNo: string | null;
  image: string | null;
  role: "ADMIN";
  onboardingStatus: boolean;
  isSubscribed: boolean;
  isTwoFA: boolean;
  toRenewal: number | null;
  plan: "FREETRIAL" | "STANDARD" | "PREMIUM" | "ENTERPRISE";
  outlets: {
    id: string;
    name: string;
    image: string;
  }[];
};

export const socialAuthLogin = async (req: Request, res: Response) => {
  const { providerAccountId, name, email, image } = req.body;

  const findOwner = await prismaDB.user.findFirst({
    where: {
      providerAccountId: providerAccountId,
      email: email,
    },
    include: {
      restaurant: true,
      billings: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  const findSubscription = findOwner?.billings.find(
    (billing) => billing?.userId === findOwner.id
  );

  const renewalDay =
    findSubscription?.userId === findOwner?.id
      ? getDaysRemaining(findSubscription?.validDate as Date)
      : 0;

  const formatToSend = {
    id: findOwner?.id,
    name: findOwner?.name,
    email: findOwner?.email,
    emailVerified: findOwner?.emailVerified,
    phoneNo: findOwner?.phoneNo,
    image: findOwner?.image,
    role: findOwner?.role,
    isTwoFA: findOwner?.isTwoFactorEnabled,
    onboardingStatus: findOwner?.onboardingStatus,
    isSubscribed: renewalDay > 0 ? true : false,
    subscriptions: findOwner?.billings.map((billing) => ({
      id: billing.id,
      planName: billing.subscriptionPlan,
      paymentId: billing.paymentId,
      startDate: billing.subscribedDate,
      validDate: billing.validDate,
      amount: billing.paidAmount,
      validityDays: differenceInDays(
        new Date(billing.validDate),
        new Date(billing.subscribedDate)
      ),
      purchased: billing.paymentId ? "PURCHASED" : "NOT PURCHASED",
      status: renewalDay === 0 ? "EXPIRED" : "VALID",
    })),
    toRenewal: renewalDay,
    plan: findSubscription?.subscriptionPlan,
    outlets: findOwner?.restaurant.map((outlet) => ({
      id: outlet.id,
      name: outlet.name,
      image: outlet.imageUrl,
    })),
  };

  if (!findOwner?.id) {
    const user = await prismaDB.user.create({
      data: {
        name,
        email,
        image,
        providerAccountId: providerAccountId,
        emailVerified: new Date(),
      },
      include: {
        restaurant: true,
        billings: true,
      },
    });

    const findSubscription = user?.billings.find(
      (billing) => billing?.userId === user.id
    );

    const renewalDay =
      findSubscription?.userId === user.id
        ? getDaysRemaining(findSubscription.validDate as Date)
        : 0;

    const formatToSend = {
      id: user?.id,
      name: user?.name,
      email: user?.email,
      emailVerified: user?.emailVerified,
      phoneNo: user?.phoneNo,
      image: user?.image,
      role: user?.role,
      onboardingStatus: user?.onboardingStatus,
      isTwoFA: findOwner?.isTwoFactorEnabled,
      isSubscribed: renewalDay > 0 ? true : false,
      subscriptions: user?.billings.map((billing) => ({
        id: billing.id,
        planName: billing.subscriptionPlan,
        paymentId: billing.paymentId,
        startDate: billing.subscribedDate,
        validDate: billing.validDate,
        amount: billing.paidAmount,
        validityDays: differenceInDays(
          new Date(billing.validDate),
          new Date(billing.subscribedDate)
        ),
        purchased: billing.paymentId ? "PURCHASED" : "NOT PURCHASED",
        status: renewalDay === 0 ? "EXPIRED" : "VALID",
      })),
      toRenewal: renewalDay,
      plan: findSubscription?.subscriptionPlan,
      outlets: user?.restaurant.map((outlet) => ({
        id: outlet.id,
        name: outlet.name,
        image: outlet.imageUrl,
      })),
    };
    sendToken(formatToSend as FUser, 200, res);
  } else sendToken(formatToSend as FUser, 200, res);
};

export const OwnerLogin = async (req: Request, res: Response) => {
  userSchema.parse(req.body);

  const { email, password } = req.body;

  const findOwner = await getOwnerUserByEmail(email);

  if (!findOwner) {
    throw new NotFoundException(
      "User has not been registered",
      ErrorCode.NOT_FOUND
    );
  }

  const isPassword = await bcrypt.compare(password, findOwner.hashedPassword!);

  if (!isPassword) {
    throw new BadRequestsException(
      "Incorrect Password",
      ErrorCode.INCORRECT_PASSWORD
    );
  }

  const findSubscription = findOwner?.billings.find(
    (billing) => billing?.userId === findOwner.id
  );

  const renewalDay =
    findSubscription?.userId === findOwner.id
      ? getDaysRemaining(findSubscription.validDate as Date)
      : 0;

  const formatToSend = {
    id: findOwner?.id,
    name: findOwner?.name,
    email: findOwner?.email,
    emailVerified: findOwner?.emailVerified,
    phoneNo: findOwner?.phoneNo,
    image: findOwner?.image,
    role: findOwner?.role,
    onboardingStatus: findOwner?.onboardingStatus,
    isTwoFA: findOwner?.isTwoFactorEnabled,

    isSubscribed: renewalDay > 0 ? true : false,
    subscriptions: findOwner?.billings.map((billing) => ({
      id: billing.id,
      planName: billing.subscriptionPlan,
      paymentId: billing.paymentId,
      startDate: billing.subscribedDate,
      validDate: billing.validDate,
      amount: billing.paidAmount,
      validityDays: differenceInDays(
        new Date(billing.validDate),
        new Date(billing.subscribedDate)
      ),
      purchased: billing.paymentId ? "PURCHASED" : "NOT PURCHASED",
      status: renewalDay === 0 ? "EXPIRED" : "VALID",
    })),
    toRenewal: renewalDay,
    plan: findSubscription?.subscriptionPlan,
    outlets: findOwner?.restaurant.map((outlet) => ({
      id: outlet.id,
      name: outlet.name,
      image: outlet.imageUrl,
    })),
  };

  sendToken(formatToSend as FUser, 200, res);
};

export const OwnerUser = async (req: Request, res: Response) => {
  // @ts-ignore
  return res.json(req.user);
};

export const AppLogout = async (req: Request, res: Response) => {
  // @ts-ignore
  const deletedRedisUser = await redis.del(req.user.id);
  res.status(200).json({
    success: true,
    deletedRedisUser,
    message: "Logged out successfuly",
  });
};

export const AppUpdateAccessToken = async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization as string;
  const refresh_token = authHeader && authHeader.split(" ")[1];
  const payload = jwt.verify(refresh_token, REFRESH_TOKEN) as jwt.JwtPayload;
  if (!payload) {
    throw new NotFoundException(
      "Could Not refresh token",
      ErrorCode.TOKENS_NOT_VALID
    );
  }

  const session = await redis.get(payload.id);

  if (!session) {
    throw new NotFoundException("User Not Found", ErrorCode.NOT_FOUND);
  }

  const user = JSON.parse(session);

  const accessToken = jwt.sign({ id: user.id }, ACCESS_TOKEN, {
    expiresIn: "5m",
  });

  const refreshToken = jwt.sign({ id: user?.id }, REFRESH_TOKEN, {
    expiresIn: "7d",
  });

  res.status(200).json({
    success: true,
    tokens: {
      accessToken,
      refreshToken,
    },
  });
};

export const registerOwner = async (req: Request, res: Response) => {
  const { email, name, password, phoneNo } = req.body;

  const user = await prismaDB.user.findUnique({
    where: {
      email,
    },
  });

  if (!user?.id) {
    const hashedPassword = await bcrypt.hash(password, 12);
    await prismaDB.user.create({
      data: {
        email,
        name,
        phoneNo,
        role: UserRole.ADMIN,
        hashedPassword,
      },
    });

    const verificationToken = await generateVerificationToken(email);

    return res.json({
      success: true,
      token: verificationToken.token,
      email: verificationToken.email,
      message: "User Create Successfully",
    });
  } else {
    throw new BadRequestsException(
      "This Email already Exist & registered",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
};

export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const ruser = await redis.get(id);

  if (ruser) {
    return res.json({
      success: true,
      user: JSON.parse(ruser),
    });
  }

  const user = await prismaDB.user.findFirst({
    where: {
      id,
    },
  });

  if (!user?.id) {
    throw new NotFoundException("User Not Found", ErrorCode.NOT_FOUND);
  }

  const formatToSend = await getFormatUserAndSendToRedis(user?.id);

  return res.json({
    success: true,
    user: formatToSend,
    message: "Fetched User",
  });
};

export const getUserByEmail = async (req: Request, res: Response) => {
  const { email } = req.params;

  const user = await prismaDB.user.findFirst({
    where: {
      email,
    },
  });
  return res.json({
    success: true,
    user,
    message: "Fetched User",
  });
};

export const getVerificationToken = async (req: Request, res: Response) => {
  const { email } = req.params;
  const verificationToken = await generateVerificationToken(email);
  return res.json({
    success: true,
    verificationToken,
    message: "Verification Generated Token Success ✅",
  });
};

export const getUserByIdAndVerifyEmail = async (
  req: Request,
  res: Response
) => {
  const { id } = req.body;

  const user = await prismaDB.user.findFirst({
    where: {
      id,
    },
  });

  if (user?.id) {
    await prismaDB.user.update({
      where: {
        id: user.id,
      },
      data: { emailVerified: new Date() },
    });
  }

  return res.json({
    success: true,
    user,
    message: "Verified User",
  });
};

export const get2FAConfirmationUser = async (req: Request, res: Response) => {
  const { userId } = req.params;
  console.log("UserId", userId);

  const twoFactorConfirmation = await prismaDB.twoFactorConfirmation.findUnique(
    {
      where: { userId: userId },
    }
  );

  console.log("twoFactorConfirmation", twoFactorConfirmation);
  return res.json({
    success: true,
    twoFactorConfirmation,
  });
};

export const delete2FAConfirmation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const twoFAConfirmation = await prismaDB.twoFactorConfirmation.delete({
    where: {
      id: id,
    },
  });
  return res.json({
    success: true,
    twoFAConfirmation,
  });
};

export const get2FATokenByEmail = async (req: Request, res: Response) => {
  const { email } = req.params;
  const token = await prismaDB.twoFactorToken.findFirst({
    where: { email },
  });
  return res.json({ success: true, token });
};

export const getTwoFactorTokenByToken = async (req: Request, res: Response) => {
  const { token } = req.params;

  const twoFactorToken = await prismaDB.twoFactorToken.findFirst({
    where: { token },
  });
  return res.json({ success: true, twoFactorToken });
};

export const twoFactorTokenDelete = async (req: Request, res: Response) => {
  const { id } = req.params;

  const deleteTwoFactorToken = await prismaDB.twoFactorToken.delete({
    where: { id: id },
  });
  return res.json({ success: true, deleteTwoFactorToken });
};

export const createTwoFactorConfirmation = async (
  req: Request,
  res: Response
) => {
  const { userId } = req.body;
  await prismaDB.twoFactorConfirmation.create({
    data: {
      userId: userId,
    },
  });
  return res.json({
    success: true,
    message: "2FA Confirmation Created",
  });
};

export const generateTwoFactorToken = async (req: Request, res: Response) => {
  const { email } = req.body;
  const token = crypto.randomInt(100000, 1000000).toString();
  const expires = new Date(new Date().getTime() + 5 + 60 * 1000);

  const twoFactorToken = await prismaDB.twoFactorToken.create({
    data: {
      email,
      token,
      expires,
    },
  });
  return res.json({
    success: true,
    message: "Token Generated",
    twoFactorToken,
  });
};

export const getUserInfo = async (req: Request, res: Response) => {
  // @ts-ignore
  const userId = req.user?.id;

  const findOwner = await prismaDB.user.findFirst({
    where: {
      id: userId,
    },
    include: {
      restaurant: true,
      billings: true,
    },
  });

  if (!findOwner?.id) {
    throw new NotFoundException("User not found", ErrorCode.UNAUTHORIZED);
  }

  const formatToSend = await getFormatUserAndSendToRedis(findOwner?.id);

  return res.json({
    success: true,
    users: formatToSend,
  });
};

export const getPasswordResetTokenByToken = async (
  req: Request,
  res: Response
) => {
  const { token } = req.body;
  const passwordResetToken = await prismaDB.passwordResetToken.findFirst({
    where: { token },
  });

  return res.json({
    success: true,
    passwordResetToken,
  });
};

export const getPasswordResetTokenByEmail = async (
  req: Request,
  res: Response
) => {
  const { email } = req.body;

  const passwordResetToken = await prismaDB.passwordResetToken.findFirst({
    where: { email },
  });
  return res.json({
    success: true,
    passwordResetToken,
  });
};

export const updatePassword = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { hashedPassword } = req.body;
  await prismaDB.user.update({
    where: {
      id: id,
    },
    data: {
      hashedPassword: hashedPassword,
    },
  });
  return res.json({
    success: true,
  });
};

export const deletePasswordResetToken = async (req: Request, res: Response) => {
  const { id } = req.params;

  await prismaDB.passwordResetToken.delete({
    where: { id: id },
  });
  return res.json({
    success: true,
    mesage: "Password Reset Token Deleted",
  });
};

export const generatePasswordResetToken = async (
  req: Request,
  res: Response
) => {
  const { email } = req.body;
  const token = uuidv4();
  const expires = new Date(new Date().getTime() + 3600 * 1000);

  const passwordResetToken = await prismaDB.passwordResetToken.create({
    data: {
      email,
      token,
      expires,
    },
  });

  return res.json({ success: true, passwordResetToken });
};

export const updateUserProfileDetails = async (req: Request, res: Response) => {
  const { userId } = req.params;
  // @ts-ignore
  const reqUserId = req.user?.id;

  const { name, phoneNo, isTwoFA, imageUrl } = req.body;

  if (userId !== reqUserId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findUser = await prismaDB.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!findUser?.id) {
    throw new NotFoundException("User Not Found", ErrorCode.NOT_FOUND);
  }

  if (findUser.phoneNo !== phoneNo) {
    const uniqueNo = await prismaDB.user.findFirst({
      where: {
        phoneNo: phoneNo,
      },
    });

    if (uniqueNo?.id) {
      throw new BadRequestsException(
        "This Phone No. is already assigned to different USer",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  }

  const updateUSer = await prismaDB.user.update({
    where: {
      id: findUser?.id,
    },
    data: {
      name: name,
      image: imageUrl,
      phoneNo: phoneNo,
      isTwoFactorEnabled: isTwoFA,
    },
  });

  await getFormatUserAndSendToRedis(updateUSer?.id);

  return res.json({
    success: true,
    message: "Update Profile Success ✅",
  });
};
