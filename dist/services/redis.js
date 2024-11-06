"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = require("ioredis");
const secrets_1 = require("../secrets");
const redisClient = () => {
    if (secrets_1.REDIS_URL) {
        console.log("Redis Connected");
        return secrets_1.REDIS_URL;
    }
    throw new Error("Redis connection failed");
};
exports.redis = new ioredis_1.Redis(redisClient());
