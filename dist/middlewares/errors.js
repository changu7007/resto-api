"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddelware = void 0;
const __1 = require("..");
const errorMiddelware = (error, req, res, next) => {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    __1.logger.error({
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
exports.errorMiddelware = errorMiddelware;
