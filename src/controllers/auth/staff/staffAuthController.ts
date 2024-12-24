import { NextFunction, Request, Response } from "express";
import { prismaDB } from "../../..";
import * as jwt from "jsonwebtoken";
import { ACCESS_TOKEN, JWT_SECRET, REFRESH_TOKEN } from "../../../secrets";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { ErrorCode } from "../../../exceptions/root";
import { staffSchema } from "../../../schema/staff";
import { NotFoundException } from "../../../exceptions/not-found";
import { sendToken } from "../../../services/jwt";
import { redis } from "../../../services/redis";
import { Staff } from "@prisma/client";
import { FStaff, getFormatStaffAndSendToRedis } from "../../../lib/get-users";

export const StaffLogin = async (req: Request, res: Response) => {
  staffSchema.parse(req.body);
  const { email, password } = req.body;

  const checkStaff = await prismaDB.staff.findFirst({
    where: {
      email: email,
    },
  });

  if (!checkStaff?.id) {
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
  }

  if (checkStaff.password !== password) {
    throw new BadRequestsException(
      "Incorrect Password",
      ErrorCode.INCORRECT_PASSWORD
    );
  }

  const formattedStaff = await getFormatStaffAndSendToRedis(checkStaff.id);

  sendToken(formattedStaff as FStaff, 200, res);
};

export const GetStaff = async (req: Request, res: Response) => {
  // @ts-ignore
  return res.json(req.user);
};

export const StaffLogout = async (req: Request, res: Response) => {
  // @ts-ignore
  const deletedRedisStaff = await redis.del(req.staff.id);
  res.status(200).json({
    success: true,
    deletedRedisStaff,
    message: "Logged out successfuly",
  });
};

export const StaffUpdateAccessToken = async (req: Request, res: Response) => {
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
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
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
