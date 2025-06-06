"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHONE_PE_MERCHANT_ID = exports.ENCRYPT_KEY = exports.PHONE_PE_CLIENT_SECRET = exports.PHONE_PE_CLIENT_ID = exports.GEMINI_API_KEY = exports.TWILIO_PHONE_NUMBER = exports.TWILIO_AUTH_TOKEN = exports.TWILIO_ACCOUNT_SID = exports.REDIS_QUEUE_URL = exports.RAZORPAY_KEY_SECRET = exports.RAZORPAY_KEY_ID = exports.CHROMIUM_EXECUTABLE_PATH = exports.PUPPETEER_EXECUTABLE_PATH = exports.REFRESH_TOKEN_EXPIRE = exports.ACCESS_TOKEN_EXPIRE = exports.REFRESH_TOKEN = exports.ACCESS_TOKEN = exports.ANTHROPIC_API_KEY = exports.OPENAI_API_KEY = exports.REDIS_URL = exports.JWT_SECRET = exports.PORT = exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: ".env" });
exports.ENV = process.env.ENV;
exports.PORT = process.env.PORT || 8000;
exports.JWT_SECRET = process.env.JWT_SECRET;
exports.REDIS_URL = process.env.REDIS_URL;
exports.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
exports.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
exports.ACCESS_TOKEN = process.env.PRIVATE_ACCESS_TOKEN;
exports.REFRESH_TOKEN = process.env.PRIVATE_REFRESH_TOKEN;
exports.ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE;
exports.REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE;
exports.PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH;
exports.CHROMIUM_EXECUTABLE_PATH = "https://github.com/Sparticuz/chromium/releases/download/v122.0.0/chromium-v122.0.0-pack.tar";
exports.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
exports.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
exports.REDIS_QUEUE_URL = process.env.REDIS_QUEUE_URL;
exports.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
exports.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
exports.TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
exports.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
exports.PHONE_PE_CLIENT_ID = process.env.PHONE_PE_CLIENT_ID;
exports.PHONE_PE_CLIENT_SECRET = process.env
    .PHONE_PE_CLIENT_SECRET;
exports.ENCRYPT_KEY = process.env.ENCRYPT_KEY;
exports.PHONE_PE_MERCHANT_ID = process.env.PHONE_PE_MERCHANT_ID;
