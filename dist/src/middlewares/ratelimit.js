"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = void 0;
function rateLimit(options) {
    const requests = new Map();
    return (req, res, next) => {
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
exports.rateLimit = rateLimit;
