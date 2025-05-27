"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultJobOptions = exports.connection = exports.ORDER_QUEUE_NAME = exports.QUEUE_NAME = void 0;
const ioredis_1 = require("ioredis");
const secrets_1 = require("../../secrets");
exports.QUEUE_NAME = "bill-processing";
exports.ORDER_QUEUE_NAME = "order-processing";
const redisClient = () => {
    if (secrets_1.REDIS_QUEUE_URL) {
        console.log("Redis Connected for Queue");
        return secrets_1.REDIS_QUEUE_URL;
    }
    throw new Error("Redis Queue connection failed");
};
exports.connection = new ioredis_1.Redis(redisClient(), {
    maxRetriesPerRequest: null,
});
exports.defaultJobOptions = {
    attempts: 3,
    backoff: {
        type: "exponential",
        delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
};
