import { NextFunction, Request, Response } from "express";
import {
  activeRequestsGauge,
  httpRequestDurationMicroseconds,
  requestCounter,
} from "./requestCount";

export const cleanupMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  activeRequestsGauge.inc();

  res.on("finish", function () {
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Increment request counter
    requestCounter.inc({
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    });

    httpRequestDurationMicroseconds.observe(
      {
        method: req.method,
        route: req.route ? req.route.path : req.path,
        code: res.statusCode,
      },
      duration
    );

    activeRequestsGauge.dec();
  });
  next();
};