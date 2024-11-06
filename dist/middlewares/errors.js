"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddelware = void 0;
const errorMiddelware = (error, req, res, next) => {
    res.status(error.statusCode).json({
        message: error.message,
        errorCode: error.errorCode,
        errors: error.errors,
    });
};
exports.errorMiddelware = errorMiddelware;
