"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAZORPAY_KEY_SECRET = exports.RAZORPAY_KEY_ID = exports.CHROMIUM_EXECUTABLE_PATH = exports.PUPPETEER_EXECUTABLE_PATH = exports.REFRESH_TOKEN_EXPIRE = exports.ACCESS_TOKEN_EXPIRE = exports.REFRESH_TOKEN = exports.ACCESS_TOKEN = exports.REDIS_URL = exports.JWT_SECRET = exports.PORT = exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: ".env" });
exports.ENV = process.env.ENV;
exports.PORT = process.env.PORT || 8000;
exports.JWT_SECRET = process.env.JWT_SECRET;
exports.REDIS_URL = exports.ENV === "development" ? process.env.REDIS_URL : process.env.PROD_REDIS_URL;
exports.ACCESS_TOKEN = process.env.PRIVATE_ACCESS_TOKEN;
exports.REFRESH_TOKEN = process.env.PRIVATE_REFRESH_TOKEN;
exports.ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE;
exports.REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE;
exports.PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH;
exports.CHROMIUM_EXECUTABLE_PATH = "https://github.com/Sparticuz/chromium/releases/download/v122.0.0/chromium-v122.0.0-pack.tar";
exports.RAZORPAY_KEY_ID = exports.ENV === "development"
    ? process.env.RAZORPAY_KEY_ID
    : process.env.PROD_RAZORPAY_KEY_ID;
exports.RAZORPAY_KEY_SECRET = exports.ENV === "development"
    ? process.env.RAZORPAY_KEY_SECRET
    : process.env.PROD_RAZORPAY_KEY_SECRET;
