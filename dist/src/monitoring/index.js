"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupMiddleware = void 0;
const requestCount_1 = require("./requestCount");
const cleanupMiddleware = (req, res, next) => {
    const startTime = Date.now();
    requestCount_1.activeRequestsGauge.inc();
    res.on("finish", function () {
        const endTime = Date.now();
        const duration = endTime - startTime;
        requestCount_1.histogram.observe({}, duration);
        // Increment request counter
        requestCount_1.requestCounter.inc({
            method: req.method,
            route: req.route ? req.route.path : req.path,
            status_code: res.statusCode,
        });
        requestCount_1.httpRequestDurationMicroseconds.observe({
            method: req.method,
            route: req.route ? req.route.path : req.path,
            code: res.statusCode,
        }, duration);
        requestCount_1.activeRequestsGauge.dec();
    });
    next();
};
exports.cleanupMiddleware = cleanupMiddleware;
