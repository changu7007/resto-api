"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHROMIUM_EXECUTABLE_PATH = exports.ENV = exports.REFRESH_TOKEN_EXPIRE = exports.ACCESS_TOKEN_EXPIRE = exports.REFRESH_TOKEN = exports.ACCESS_TOKEN = exports.REDIS_URL = exports.JWT_SECRET = exports.PORT = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: ".env" });
exports.PORT = process.env.PORT || 8000;
exports.JWT_SECRET = process.env.JWT_SECRET;
exports.REDIS_URL = process.env.REDIS_URL;
exports.ACCESS_TOKEN = process.env.PRIVATE_ACCESS_TOKEN;
exports.REFRESH_TOKEN = process.env.PRIVATE_REFRESH_TOKEN;
exports.ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE;
exports.REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE;
exports.ENV = process.env.ENV;
exports.CHROMIUM_EXECUTABLE_PATH = "https://github.com/Sparticuz/chromium/releases/download/v122.0.0/chromium-v122.0.0-pack.tar";
