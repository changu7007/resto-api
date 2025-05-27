import { Redis } from "ioredis";
import { REDIS_QUEUE_URL } from "../../secrets";
import { OrderStatus, OrderType } from "@prisma/client";

export interface BillQueueData {
  invoiceData: any;
  outletId: string;
  phoneNumber?: string;
  whatsappData?: any;
  ownerPhone: string;
  paymentData: any;
}

export const QUEUE_NAME = "bill-processing";
export const ORDER_QUEUE_NAME = "order-processing";

export interface OrderQueueData {
  id: string;
  outletId: string;
  orderId: string;
  orderStatus: OrderStatus;
  orderType: OrderType;
  staffId: string;
  username: string;
  customerId?: string;
  isPaid: boolean;
  cashRegisterId?: string;
  isValid: boolean;
  phoneNo?: string;
  totalNetPrice: number;
  gstPrice: number;
  totalAmount: number;
  totalGrossProfit: number;
  orderItems: Array<{
    menuId: string;
    menuItem: any;
    quantity: number;
    netPrice: string;
    gst: number;
    grossProfit: number;
    price: number;
    originalPrice: number;
    sizeVariantsId?: string;
    addOnSelected?: Array<{
      id: string;
      selectedVariantsId: Array<{
        id: string;
      }>;
    }>;
  }>;
  tableId?: string;
  paymentMethod?: string;
  orderMode: string;
  isSplitPayment?: boolean;
  splitPayments?: Array<{
    method: string;
    amount: number;
  }>;
  receivedAmount?: number;
  changeAmount?: number;
}

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
