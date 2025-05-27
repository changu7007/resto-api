import { Request, Response } from "express";
import { prismaDB } from "../../..";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import {
  FormattedPOSStaff,
  getFormatStaffPOSAndSendToRedis,
} from "../../../lib/get-users";
import { sendToken } from "../../../services/jwt";
import { redis } from "../../../services/redis";
import * as jwt from "jsonwebtoken";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../../../secrets";
import { UnauthorizedException } from "../../../exceptions/unauthorized";
import { BadRequestsException } from "../../../exceptions/bad-request";

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

// Cookie options
// const refreshTokenOptions = {
//   httpOnly: true,
//   sameSite: "lax" as const,
//   secure: process.env.NODE_ENV === "production",
//   maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
// };

// export const POSUpdateAccessToken = async (req: Request, res: Response) => {
//   const refresh_token = req.cookies.refreshToken;

//   if (!refresh_token) {
//     throw new UnauthorizedException(
//       "No refresh token provided",
//       ErrorCode.UNAUTHORIZED
//     );
//   }
//   const payload = jwt.verify(refresh_token, REFRESH_TOKEN) as jwt.JwtPayload;
//   if (!payload) {
//     throw new NotFoundException(
//       "Could Not refresh token",
//       ErrorCode.TOKENS_NOT_VALID
//     );
//   }

//   const session = await redis.get(`pos-${payload.id}`);

//   if (!session) {
//     const user = await prismaDB.staff.findUnique({
//       where: {
//         id: payload.id,
//       },
//     });

//     if (!user) {
//       throw new UnauthorizedException(
//         "Session expired, please login again",
//         ErrorCode.UNAUTHORIZED
//       );
//     }

//     await getFormatStaffPOSAndSendToRedis(user?.id);

//     const accessToken = jwt.sign({ id: user.id }, ACCESS_TOKEN, {
//       expiresIn: "5m",
//     });

//     const refreshToken = jwt.sign({ id: user?.id }, REFRESH_TOKEN, {
//       expiresIn: "7d",
//     });

//     res
//       .cookie("refreshToken", refreshToken, refreshTokenOptions)
//       .status(200)
//       .json({
//         success: true,
//         tokens: {
//           accessToken,
//         },
//       });
//   } else {
//     const user = JSON.parse(session);

//     const accessToken = jwt.sign({ id: user.id }, ACCESS_TOKEN, {
//       expiresIn: "5m",
//     });

//     const refreshToken = jwt.sign({ id: user?.id }, REFRESH_TOKEN, {
//       expiresIn: "7d",
//     });

//     res
//       .cookie("refreshToken", refreshToken, refreshTokenOptions)
//       .status(200)
//       .json({
//         success: true,
//         tokens: {
//           accessToken,
//         },
//       });
//   }
// };

export const POSUpdateAccessToken = async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization as string;
  const refresh_token = authHeader && authHeader.split(" ")[1];
  const payload = jwt.verify(refresh_token, REFRESH_TOKEN) as jwt.JwtPayload;
  if (!payload) {
    throw new NotFoundException(
      "Could Not refresh token",
      ErrorCode.TOKENS_NOT_VALID
    );
  }

  const session = await redis.get(`pos-${payload.id}`);

  if (!session) {
    const user = await prismaDB.staff.findUnique({
      where: {
        id: payload.id,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        "Session expired, please login again",
        ErrorCode.UNAUTHORIZED
      );
    }

    await getFormatStaffPOSAndSendToRedis(user?.id);

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
  } else {
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
  }
};

export const POSUserCheck = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const checkStaff = await prismaDB.staff.findFirst({
    where: { email },
    select: {
      id: true,
      password: true,
      posAccess: true,
    },
  });

  if (!checkStaff?.id) {
    throw new NotFoundException("Staff Not Found", ErrorCode.NOT_FOUND);
  }

  if (checkStaff?.password !== password) {
    throw new BadRequestsException(
      "Incorrect Password",
      ErrorCode.INCORRECT_PASSWORD
    );
  }

  if (checkStaff?.posAccess === false) {
    throw new BadRequestsException(
      "You Don't Have Access To POS",
      ErrorCode.INCORRECT_PASSWORD
    );
  }

  return res.json({ success: true });
};
