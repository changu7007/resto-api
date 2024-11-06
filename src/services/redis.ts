import { Redis } from "ioredis";
import { REDIS_URL } from "../secrets";

const redisClient = () => {
  if (REDIS_URL) {
    console.log("Redis Connected");
    return REDIS_URL;
  }
  throw new Error("Redis connection failed");
};

export const redis = new Redis(redisClient());
