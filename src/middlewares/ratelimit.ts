import { NextFunction, Request, Response } from "express";

export function rateLimit(options: { windowMs: number; max: number }) {
  const requests = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const windowStart = now - options.windowMs;

    // Get existing requests for this IP
    const requestTimes = requests.get(req.ip || "") || [];

    // Filter out old requests
    const recentRequests = requestTimes.filter((time) => time > windowStart);

    if (recentRequests.length >= options.max) {
      return res.status(429).json({
        error: "Too many requests",
      });
    }

    // Add current request
    recentRequests.push(now);
    requests.set(req.ip || "", recentRequests);

    next();
  };
}
