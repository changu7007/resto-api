import { NextFunction, Request, Response } from "express";
import { UnauthorizedException } from "../exceptions/unauthorized";
import { ErrorCode } from "../exceptions/root";
import * as jwt from "jsonwebtoken";
import { ACCESS_TOKEN } from "../secrets";
import { NotFoundException } from "../exceptions/not-found";
import { redis } from "../services/redis";

export const isAuthMiddelware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization as string;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    next(
      new UnauthorizedException("Unauthorized Access", ErrorCode.UNAUTHORIZED)
    );
  }

  try {
    const payload = jwt.verify(token, ACCESS_TOKEN) as jwt.JwtPayload;
    if (!payload) {
      throw next(
        new NotFoundException(
          "Access Token is not valid",
          ErrorCode.TOKENS_NOT_VALID
        )
      );
    }

    // Try to get regular user first
    const user = await redis.get(payload.id);
    if (user) {
      // @ts-ignore
      req.user = JSON.parse(user);
      return next();
    }

    // If no regular user, try to get POS user
    const posUser = await redis.get(`pos-${payload.id}`);
    if (posUser) {
      // @ts-ignore
      req.user = JSON.parse(posUser);
      return next();
    }

    // If neither user type is found
    throw new NotFoundException(
      "No user found for this token",
      ErrorCode.NOT_FOUND
    );
  } catch (error) {
    next(
      new UnauthorizedException(
        "Something Went Wrong",
        ErrorCode.UNAUTHORIZED,
        error
      )
    );
  }
};
