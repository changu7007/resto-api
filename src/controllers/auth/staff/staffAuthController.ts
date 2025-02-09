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

import { FStaff, getFormatStaffAndSendToRedis } from "../../../lib/get-users";
import { UnauthorizedException } from "../../../exceptions/unauthorized";
import { format } from "date-fns";

export const StaffLogin = async (req: Request, res: Response) => {
  // staffSchema.parse(req.body);
  // const { email, password } = req.body;

  const { role, phone } = req.body;

  console.log(req.body);

  const checkStaff = await prismaDB.staff.findFirst({
    where: {
      // email: email,
      role: role,
      phoneNo: phone,
    },
  });

  if (!checkStaff?.id) {
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
  }

  // if (checkStaff.password !== password) {
  //   throw new BadRequestsException(
  //     "Incorrect Password",
  //     ErrorCode.INCORRECT_PASSWORD
  //   );
  // }

  const formattedStaff = await getFormatStaffAndSendToRedis(checkStaff.id);

  sendToken(formattedStaff as FStaff, 200, res);
};

export const GetStaff = async (req: Request, res: Response) => {
  // @ts-ignore
  const staffId = req?.user?.id;
  const formattedStaff = await getFormatStaffAndSendToRedis(staffId);

  return res.json({
    success: true,
    message: "Staff Fetched Successfully",
    staff: formattedStaff,
  });
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

export const staffCheckIn = async (req: Request, res: Response) => {
  // @ts-ignore
  const id = req.user?.id;

  const { staffId } = req.body;

  if (id !== staffId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findStaff = await prismaDB.staff.findFirst({
    where: {
      id: staffId,
    },
  });

  if (!findStaff) {
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
  }

  const staffCheckIn = await prismaDB.checkInRecord.create({
    data: {
      staffId: id,
      checkInTime: new Date(),
    },
  });

  const formattedStaff = await getFormatStaffAndSendToRedis(findStaff.id);

  return res.json({
    success: true,
    message: "Check In Successfully",
    staffCheckIn,
    staff: formattedStaff,
  });
};

export const staffCheckOut = async (req: Request, res: Response) => {
  // @ts-ignore
  const id = req.user?.id;

  const { staffId } = req.body;

  if (id !== staffId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findStaff = await prismaDB.staff.findFirst({
    where: {
      id: staffId,
    },
    include: {
      checkIns: {
        orderBy: {
          checkInTime: "desc",
        },
      },
    },
  });

  if (!findStaff) {
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
  }

  const staffCheckOut = await prismaDB.checkInRecord.update({
    where: {
      id: findStaff.checkIns[0].id,
    },
    data: {
      checkOutTime: new Date(),
    },
  });
  const formattedStaff = await getFormatStaffAndSendToRedis(findStaff.id);

  return res.json({
    success: true,
    message: "Check Out Successfully",
    staffCheckOut,
    staff: formattedStaff,
  });
};

export const getLatestRecordByStaffId = async (req: Request, res: Response) => {
  // @ts-ignore
  const staffId = req.user?.id;

  const { id } = req.params;

  if (id !== staffId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  if (!id) {
    throw new BadRequestsException(
      "Staff Id is required",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }

  const findCheckIns = await prismaDB.checkInRecord.findFirst({
    where: {
      staffId: id,
    },
    orderBy: {
      checkInTime: "desc",
    },
  });

  if (!findCheckIns) {
    throw new NotFoundException(
      "Check In Record Not Found",
      ErrorCode.NOT_FOUND
    );
  }

  const formattedCheckInTime = findCheckIns?.checkInTime
    ? format(findCheckIns?.checkInTime, "hh:mm a")
    : undefined;
  await getFormatStaffAndSendToRedis(id);

  return res.json({
    success: true,
    message: "Latest Check In",
    ...findCheckIns,
    checkInTime: formattedCheckInTime,
  });
};
