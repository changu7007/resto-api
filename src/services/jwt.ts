import { Staff, User } from "@prisma/client";
import * as jwt from "jsonwebtoken";
import {
  ACCESS_TOKEN,
  ACCESS_TOKEN_EXPIRE,
  REFRESH_TOKEN,
  REFRESH_TOKEN_EXPIRE,
} from "../secrets";
import { Response } from "express";
import { redis } from "./redis";
import { FUser } from "../controllers/auth/owner/appAuthController";
import { Customer } from "../controllers/auth/prime/authControl";
import { FormattedPOSStaff, FStaff } from "../lib/get-users";

interface ITokenOptions {
  expires: Date;
  maxAge: number;
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none" | undefined;
  secure?: boolean;
}

const accessTokenExpire = parseInt(ACCESS_TOKEN_EXPIRE || "300", 10);
const refreshTokenExpire = parseInt(REFRESH_TOKEN_EXPIRE || "1200", 10);

export const accessTokenOptions: ITokenOptions = {
  expires: new Date(Date.now() + accessTokenExpire * 60 * 60 * 1000),
  maxAge: accessTokenExpire * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "lax",
};

export const refreshTokenOptions: ITokenOptions = {
  expires: new Date(Date.now() + refreshTokenExpire * 24 * 60 * 60 * 1000),
  maxAge: refreshTokenExpire * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "lax",
};

export const sendToken = async (
  user: FStaff | FUser | Customer | FormattedPOSStaff,
  statusCode: number,
  res: Response
) => {
  const accessToken = jwt.sign({ id: user?.id }, ACCESS_TOKEN, {
    expiresIn: "1h",
  });

  const refreshToken = jwt.sign({ id: user?.id }, REFRESH_TOKEN, {
    expiresIn: "7d",
  });

  if (user as FormattedPOSStaff) {
    await redis.set(`pos-${user.id}`, JSON.stringify(user), "EX", 3 * 60 * 60);
  } else {
    await redis.set(user.id, JSON.stringify(user));
  }

  if (process.env.NODE_ENV === "production") {
    accessTokenOptions.secure = true;
  }

  res
    // .cookie("refreshToken", refreshToken, refreshTokenOptions)
    .status(200)
    .json({
      success: true,
      user,
      tokens: {
        accessToken,
        refreshToken,
      },
    });
};
