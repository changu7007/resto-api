import crypto from "crypto";
import axios, { AxiosInstance } from "axios";
import {
  PaymentRequest,
  PhonePeConfig,
  PaymentResponse,
  StatusResponse,
} from "../../types/phonepe.types";

export class PhonePeClient {
  private config: PhonePeConfig;
  private httpClient: AxiosInstance;
  private baseUrl: string;
  private authToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(config: PhonePeConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === "SANDBOX"
        ? "https://api-preprod.phonepe.com/apis/pg-sandbox"
        : "https://api.phonepe.com/apis/pg";

    console.log("PhonePe Client Configuration:", {
      environment: config.environment,
      baseUrl: this.baseUrl,
      merchantId: config.merchantId,
    });

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request/response interceptors for logging and error handling
    this.setupInterceptors();
  }

  private async getAuthToken(): Promise<string> {
    // Check if we have a valid token
    if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.authToken;
    }

    // Get new token
    const authUrl =
      this.config.environment === "SANDBOX"
        ? "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token"
        : "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";

    try {
      const response = await axios.post(
        authUrl,
        new URLSearchParams({
          client_id: this.config.clientId,
          client_version: "1",
          client_secret: this.config.clientSecret,
          grant_type: "client_credentials",
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const accessToken = response.data.access_token;
      if (!accessToken) {
        throw new Error(
          "Failed to get auth token - no access token in response"
        );
      }

      this.authToken = accessToken;
      this.tokenExpiry = response.data.expires_at * 1000; // Convert to milliseconds
      console.log("PhonePe Auth Token Generated");
      return accessToken;
    } catch (error) {
      console.error("Error getting PhonePe auth token:", error);
      throw error;
    }
  }

  private async setupInterceptors() {
    this.httpClient.interceptors.request.use(
      async (config) => {
        // Get fresh token for each request
        const token = await this.getAuthToken();
        if (config.headers) {
          config.headers.Authorization = `O-Bearer ${token}`;
        }

        console.log(
          `PhonePe API Request - ${config.method?.toUpperCase()} ${config.url}`
        );
        return config;
      },
      (error) => {
        console.error("PhonePe Request Error:", error);
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        console.log(`PhonePe API Response - Status: ${response.status}`);
        return response;
      },
      (error) => {
        console.error(
          "PhonePe Response Error:",
          error.response?.data || error.message
        );
        return Promise.reject(error);
      }
    );
  }

  public generatePhonePeOrderId(prefix: string = "PP"): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    // Remove any special characters and ensure it's alphanumeric with underscores only
    return `${prefix}_${timestamp}_${random}`.replace(/[^a-zA-Z0-9_]/g, "");
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // Validate required fields
      if (!request.merchantOrderId || !request.amount) {
        throw new Error("merchantOrderId and amount are required fields");
      }

      const payload = {
        merchantOrderId: request.merchantOrderId,
        amount: request.amount,
        expireAfter: 1200, // 20 minutes default expiry
        metaInfo: {
          udf1: request.metadata?.outletId || "",
          udf2: request.metadata?.from || "",
          udf3: request.metadata?.domain || "",
          udf4: request.metadata?.type || "",
          udf5: request.metadata?.userId || "",
        },
        paymentFlow: {
          type: "PG_CHECKOUT",
          message: "Payment for order",
          merchantUrls: {
            redirectUrl: request.redirectUrl,
          },
        },
      };

      console.log(
        "PhonePe Payment Request Payload:",
        JSON.stringify(payload, null, 2)
      );

      // Get auth token for the request
      const token = await this.getAuthToken();
      console.log("PhonePe Auth Token:", token);

      console.log(`Request URL: ${this.baseUrl}/checkout/v2/pay`);

      const response = await this.httpClient.post(
        "/checkout/v2/pay",
        {
          merchantOrderId: request.merchantOrderId,
          amount: request.amount,
          expireAfter: 1200, // 20 minutes default expiry
          metaInfo: {
            udf1: request.metadata?.outletId || "",
            udf2: request.metadata?.from || "",
            udf3: request.metadata?.domain || "",
            udf4: request.metadata?.type || "",
            udf5: request.metadata?.userId || "",
          },
          paymentFlow: {
            type: "PG_CHECKOUT",
            message: "Payment for order",
            merchantUrls: {
              redirectUrl: request.redirectUrl,
            },
          },
        },
        {
          headers: {
            Authorization: `O-Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        "PhonePe API Response:",
        JSON.stringify(response.data, null, 2)
      );

      // Check if response has the expected structure
      if (!response.data || typeof response.data !== "object") {
        throw new Error("Invalid response format from PhonePe API");
      }

      // PhonePe returns orderId, state, expireAt, and redirectUrl directly in the response
      if (response.data.orderId && response.data.redirectUrl) {
        return {
          success: true,
          redirectUrl: response.data.redirectUrl,
          orderId: response.data.orderId,
          amount: request.amount,
          merchantOrderId: request.merchantOrderId,
          metadata: request.metadata,
          responseData: {
            merchantOrderId: request.merchantOrderId,
            transactionId: response.data.orderId,
            state: response.data.state,
          },
        };
      }

      // Handle error case
      const errorMessage =
        response.data.message ||
        response.data.error ||
        response.data.data?.error?.message ||
        "Payment creation failed";

      console.error("PhonePe Payment Error:", {
        message: errorMessage,
        code: response.data.code,
        data: response.data,
        status: response.status,
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: response.data.code,
        merchantOrderId: request.merchantOrderId,
        amount: request.amount,
      };
    } catch (error: any) {
      console.error("PhonePe payment creation error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
        stack: error.stack,
      });

      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.response?.data?.data?.error?.message ||
        error.message ||
        "Payment creation failed";

      return {
        success: false,
        error: errorMessage,
        errorCode: error.response?.data?.code || "UNKNOWN_ERROR",
        merchantOrderId: request.merchantOrderId,
        amount: request.amount,
      };
    }
  }

  async getOrderStatus(merchantOrderId: string): Promise<StatusResponse> {
    try {
      const token = await this.getAuthToken();
      const response = await this.httpClient.get(
        `/checkout/v2/order/${merchantOrderId}/status`,
        {
          headers: {
            Authorization: `O-Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("PhonePe Status Response:", response.data);

      if (response.data.state === "COMPLETED") {
        return {
          success: true,
          state: response.data.state,
          orderId: response.data.orderId,
          amount: response.data.amount,
        };
      } else if (response.data.state === "FAILED") {
        return {
          success: false,
          state: response.data.state,
          error: response.data.errorCode || "Payment failed",
        };
      } else {
        return {
          success: true,
          state: response.data.state,
          orderId: response.data.orderId,
          amount: response.data.amount,
        };
      }
    } catch (error: any) {
      console.error("PhonePe status check error:", error);
      return {
        success: false,
        state: "FAILED",
        error:
          error.response?.data?.message ||
          error.message ||
          "Status check failed",
      };
    }
  }
}
