import dotenv from "dotenv";

dotenv.config({ path: ".env" });

export const PORT = process.env.PORT || 8000;
export const JWT_SECRET = process.env.JWT_SECRET!;
export const REDIS_URL = process.env.REDIS_URL;
export const ACCESS_TOKEN = process.env.PRIVATE_ACCESS_TOKEN as string;
export const REFRESH_TOKEN = process.env.PRIVATE_REFRESH_TOKEN as string;
export const ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE!;
export const REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE!;
export const ENV = process.env.ENV as "development" | "production";
export const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH;
export const CHROMIUM_EXECUTABLE_PATH =
  "https://github.com/Sparticuz/chromium/releases/download/v122.0.0/chromium-v122.0.0-pack.tar";
export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID as string;
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET as string;
