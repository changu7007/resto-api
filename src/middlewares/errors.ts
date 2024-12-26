import { NextFunction, Request, Response } from "express";
import { HttpException } from "../exceptions/root";
import { logger } from "..";

export const errorMiddelware = (
  error: HttpException,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";
  logger.error({
    message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    statusCode,
  });
  res.status(error.statusCode).json({
    message: error.message,
    errorCode: error.errorCode,
    errors: error.errors,
  });
};
