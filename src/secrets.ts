import dotenv from "dotenv";

dotenv.config({ path: ".env" });

export const PORT = process.env.PORT || 8000;
export const JWT_SECRET = process.env.JWT_SECRET!;
export const REDIS_URL = process.env.REDIS_URL;
export const ACCESS_TOKEN = process.env.PRIVATE_ACCESS_TOKEN as string;
export const REFRESH_TOKEN = process.env.PRIVATE_REFRESH_TOKEN as string;
export const ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE!;
export const REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE!;
