export interface PhonePeConfig {
  clientId: string;
  clientSecret: string;
  environment: "SANDBOX" | "PRODUCTION";
  merchantId?: string;
}

export interface PaymentRequest {
  merchantOrderId: string;
  amount: number;
  redirectUrl: string;
  callbackUrl?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  success: boolean;
  redirectUrl?: string;
  orderId?: string;
  error?: string;
  errorCode?: string;
  amount?: number;
  merchantOrderId?: string;
  metadata?: Record<string, any>;
  responseData?: {
    merchantOrderId: string;
    transactionId?: string;
    state?: string;
  };
}

export interface StatusResponse {
  success: boolean;
  state?: string;
  orderId?: string;
  amount?: number;
  error?: string;
}
