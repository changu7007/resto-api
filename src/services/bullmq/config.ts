import { Redis } from "ioredis";
import { REDIS_QUEUE_URL } from "../../secrets";

export interface BillQueueData {
  invoiceData: any;
  outletId: string;
  phoneNumber?: string;
  whatsappData?: any;
  ownerPhone: string;
  paymentData: any;
}

export const QUEUE_NAME = "bill-processing";

const redisClient = () => {
  if (REDIS_QUEUE_URL) {
    console.log("Redis Connected for Queue");
    return REDIS_QUEUE_URL;
  }
  throw new Error("Redis Queue connection failed");
};

export const connection = new Redis(redisClient(), {
  maxRetriesPerRequest: null,
});

export const defaultJobOptions = {
  attempts: 3,

  backoff: {
    type: "exponential" as const,
    delay: 1000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};
