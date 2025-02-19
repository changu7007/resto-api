import { Request, Response } from "express";
import { prismaDB } from "../../..";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import {
  FormattedPOSStaff,
  FStaff,
  getFormatStaffPOSAndSendToRedis,
} from "../../../lib/get-users";
import { sendToken } from "../../../services/jwt";
import { redis } from "../../../services/redis";

export const StaffPOSLogin = async (req: Request, res: Response) => {
  // staffSchema.parse(req.body);
  // const { email, password } = req.body;

  const { email, password } = req.body;

  console.log(req.body);

  const checkStaff = await prismaDB.staff.findFirst({
    where: {
      email: email,
      password: password,
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

  const formattedStaff = await getFormatStaffPOSAndSendToRedis(checkStaff.id);

  sendToken(formattedStaff as FormattedPOSStaff, 200, res);
};

export const StaffPOSLogout = async (req: Request, res: Response) => {
  // @ts-ignore
  const id = req?.user?.id;

  await redis.del(`pos-${id}`);

  return res.json({
    success: true,
    message: "Logged out successfully",
  });
};

export const GetPOSUser = async (req: Request, res: Response) => {
  // @ts-ignore
  const id = req?.user?.id;

  const user = await redis.get(`pos-${id}`);

  if (user) {
    return res.json({ success: true, user: JSON.parse(user) });
  }

  const GetPOSUser = await getFormatStaffPOSAndSendToRedis(id);

  return res.json({ success: true, user: GetPOSUser });
};
