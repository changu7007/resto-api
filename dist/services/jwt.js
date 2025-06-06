"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToken = exports.refreshTokenOptions = exports.accessTokenOptions = void 0;
const jwt = __importStar(require("jsonwebtoken"));
const secrets_1 = require("../secrets");
const redis_1 = require("./redis");
const accessTokenExpire = parseInt(secrets_1.ACCESS_TOKEN_EXPIRE || "300", 10);
const refreshTokenExpire = parseInt(secrets_1.REFRESH_TOKEN_EXPIRE || "1200", 10);
exports.accessTokenOptions = {
    expires: new Date(Date.now() + accessTokenExpire * 60 * 60 * 1000),
    maxAge: accessTokenExpire * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
};
exports.refreshTokenOptions = {
    expires: new Date(Date.now() + refreshTokenExpire * 24 * 60 * 60 * 1000),
    maxAge: refreshTokenExpire * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
};
const sendToken = (user, statusCode, res) => __awaiter(void 0, void 0, void 0, function* () {
    const accessToken = jwt.sign({ id: user === null || user === void 0 ? void 0 : user.id }, secrets_1.ACCESS_TOKEN, {
        expiresIn: "1h",
    });
    const refreshToken = jwt.sign({ id: user === null || user === void 0 ? void 0 : user.id }, secrets_1.REFRESH_TOKEN, {
        expiresIn: "7d",
    });
    if (user) {
        yield redis_1.redis.set(`pos-${user.id}`, JSON.stringify(user), "EX", 3 * 60 * 60);
    }
    else {
        yield redis_1.redis.set(user.id, JSON.stringify(user), "EX", 3 * 60 * 60);
    }
    if (process.env.NODE_ENV === "production") {
        exports.accessTokenOptions.secure = true;
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
});
exports.sendToken = sendToken;
