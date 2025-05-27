"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCode = exports.HttpException = void 0;
class HttpException extends Error {
    constructor(message, errorCode, statusCode, error) {
        super(message);
        this.message = message;
        this.errorCode = errorCode;
        this.statusCode = statusCode;
        this.errors = error;
    }
}
exports.HttpException = HttpException;
var ErrorCode;
(function (ErrorCode) {
    ErrorCode[ErrorCode["OUTLET_NOT_FOUND"] = 1001] = "OUTLET_NOT_FOUND";
    ErrorCode[ErrorCode["NOT_FOUND"] = 2001] = "NOT_FOUND";
    ErrorCode[ErrorCode["INCORRECT_PASSWORD"] = 2002] = "INCORRECT_PASSWORD";
    ErrorCode[ErrorCode["UNPROCESSABLE_ENTITY"] = 3001] = "UNPROCESSABLE_ENTITY";
    ErrorCode[ErrorCode["INTERNAL_EXCEPTION"] = 4001] = "INTERNAL_EXCEPTION";
    ErrorCode[ErrorCode["UNAUTHORIZED"] = 5001] = "UNAUTHORIZED";
    ErrorCode[ErrorCode["TOKENS_NOT_VALID"] = 6001] = "TOKENS_NOT_VALID";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
