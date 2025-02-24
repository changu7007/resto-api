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
exports.isAuthMiddelware = void 0;
const unauthorized_1 = require("../exceptions/unauthorized");
const root_1 = require("../exceptions/root");
const jwt = __importStar(require("jsonwebtoken"));
const secrets_1 = require("../secrets");
const not_found_1 = require("../exceptions/not-found");
const redis_1 = require("../services/redis");
const isAuthMiddelware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
        next(new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED));
    }
    try {
        const payload = jwt.verify(token, secrets_1.ACCESS_TOKEN);
        if (!payload) {
            throw next(new not_found_1.NotFoundException("Access Token is not valid", root_1.ErrorCode.TOKENS_NOT_VALID));
        }
        // Try to get regular user first
        const user = yield redis_1.redis.get(payload.id);
        if (user) {
            // @ts-ignore
            req.user = JSON.parse(user);
            return next();
        }
        // If no regular user, try to get POS user
        const posUser = yield redis_1.redis.get(`pos-${payload.id}`);
        if (posUser) {
            // @ts-ignore
            req.user = JSON.parse(posUser);
            return next();
        }
        // If neither user type is found
        throw new not_found_1.NotFoundException("No user found for this token", root_1.ErrorCode.NOT_FOUND);
    }
    catch (error) {
        next(new unauthorized_1.UnauthorizedException("Something Went Wrong", root_1.ErrorCode.UNAUTHORIZED, error));
    }
});
exports.isAuthMiddelware = isAuthMiddelware;
