"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhonePeClient = void 0;
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
class PhonePeClient {
    constructor(config) {
        this.authToken = null;
        this.tokenExpiry = null;
        this.config = config;
        this.baseUrl =
            config.environment === "SANDBOX"
                ? "https://api-preprod.phonepe.com/apis/pg-sandbox"
                : "https://api.phonepe.com/apis/pg";
        this.httpClient = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: 30000,
            headers: {
                "Content-Type": "application/json",
            },
        });
        // Add request/response interceptors for logging and error handling
        this.setupInterceptors();
    }
    getAuthToken() {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if we have a valid token
            if (this.authToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                return this.authToken;
            }
            // Get new token
            const authUrl = this.config.environment === "SANDBOX"
                ? "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token"
                : "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";
            try {
                const response = yield axios_1.default.post(authUrl, new URLSearchParams({
                    client_id: this.config.clientId,
                    client_version: "1",
                    client_secret: this.config.clientSecret,
                    grant_type: "client_credentials",
                }), {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                });
                const accessToken = response.data.access_token;
                if (!accessToken) {
                    throw new Error("Failed to get auth token - no access token in response");
                }
                this.authToken = accessToken;
                this.tokenExpiry = response.data.expires_at * 1000; // Convert to milliseconds
                return accessToken;
            }
            catch (error) {
                console.error("Error getting PhonePe auth token:", error);
                throw error;
            }
        });
    }
    setupInterceptors() {
        return __awaiter(this, void 0, void 0, function* () {
            this.httpClient.interceptors.request.use((config) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                // Get fresh token for each request
                const token = yield this.getAuthToken();
                if (config.headers) {
                    config.headers.Authorization = `O-Bearer ${token}`;
                }
                console.log(`PhonePe API Request - ${(_a = config.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()} ${config.url}`);
                return config;
            }), (error) => {
                console.error("PhonePe Request Error:", error);
                return Promise.reject(error);
            });
            this.httpClient.interceptors.response.use((response) => {
                console.log(`PhonePe API Response - Status: ${response.status}`);
                return response;
            }, (error) => {
                var _a;
                console.error("PhonePe Response Error:", ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
                return Promise.reject(error);
            });
        });
    }
    generateSignature(payload, endpoint) {
        const stringToHash = payload + endpoint + this.config.clientSecret;
        return (crypto_1.default.createHash("sha256").update(stringToHash).digest("hex") + "###1");
    }
    generateStatusSignature(merchantOrderId) {
        const endpoint = `/checkout/v2/order/${merchantOrderId}/status`;
        return (crypto_1.default
            .createHash("sha256")
            .update(endpoint + this.config.clientSecret)
            .digest("hex") + "###1");
    }
    createPayment(request) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const payload = {
                    merchantOrderId: request.merchantOrderId,
                    amount: request.amount,
                    expireAfter: 1200, // 20 minutes default expiry
                    metaInfo: {
                        udf1: ((_a = request.metadata) === null || _a === void 0 ? void 0 : _a.outletId) || "",
                        udf2: ((_b = request.metadata) === null || _b === void 0 ? void 0 : _b.from) || "",
                        udf3: ((_c = request.metadata) === null || _c === void 0 ? void 0 : _c.domain) || "",
                        udf4: ((_d = request.metadata) === null || _d === void 0 ? void 0 : _d.type) || "",
                        udf5: ((_e = request.metadata) === null || _e === void 0 ? void 0 : _e.userId) || "",
                    },
                    paymentFlow: {
                        type: "PG_CHECKOUT",
                        message: "Payment for order",
                        merchantUrls: {
                            redirectUrl: request.redirectUrl,
                        },
                    },
                };
                console.log("PhonePe Payment Request Payload:", JSON.stringify(payload, null, 2));
                const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
                const signature = this.generateSignature(base64Payload, "/checkout/v2/pay");
                console.log("PhonePe Request Headers:", {
                    "X-VERIFY": signature,
                    "Content-Type": "application/json",
                });
                const response = yield this.httpClient.post("/checkout/v2/pay", {
                    request: base64Payload,
                }, {
                    headers: {
                        "X-VERIFY": signature,
                    },
                });
                console.log("PhonePe API Response:", JSON.stringify(response.data, null, 2));
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
                const errorMessage = response.data.message ||
                    response.data.error ||
                    ((_g = (_f = response.data.data) === null || _f === void 0 ? void 0 : _f.error) === null || _g === void 0 ? void 0 : _g.message) ||
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
            }
            catch (error) {
                console.error("PhonePe payment creation error:", {
                    message: error.message,
                    response: (_h = error.response) === null || _h === void 0 ? void 0 : _h.data,
                    status: (_j = error.response) === null || _j === void 0 ? void 0 : _j.status,
                    headers: (_k = error.response) === null || _k === void 0 ? void 0 : _k.headers,
                    stack: error.stack,
                });
                const errorMessage = ((_m = (_l = error.response) === null || _l === void 0 ? void 0 : _l.data) === null || _m === void 0 ? void 0 : _m.message) ||
                    ((_p = (_o = error.response) === null || _o === void 0 ? void 0 : _o.data) === null || _p === void 0 ? void 0 : _p.error) ||
                    ((_t = (_s = (_r = (_q = error.response) === null || _q === void 0 ? void 0 : _q.data) === null || _r === void 0 ? void 0 : _r.data) === null || _s === void 0 ? void 0 : _s.error) === null || _t === void 0 ? void 0 : _t.message) ||
                    error.message ||
                    "Payment creation failed";
                return {
                    success: false,
                    error: errorMessage,
                    errorCode: ((_v = (_u = error.response) === null || _u === void 0 ? void 0 : _u.data) === null || _v === void 0 ? void 0 : _v.code) || "UNKNOWN_ERROR",
                    merchantOrderId: request.merchantOrderId,
                    amount: request.amount,
                };
            }
        });
    }
    getOrderStatus(merchantOrderId) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const signature = this.generateStatusSignature(merchantOrderId);
                const response = yield this.httpClient.get(`/checkout/v2/order/${merchantOrderId}/status`, {
                    headers: {
                        "X-VERIFY": signature,
                    },
                });
                console.log("PhonePe Status Response:", response.data);
                if (response.data.state === "COMPLETED") {
                    return {
                        success: true,
                        state: response.data.state,
                        orderId: response.data.orderId,
                        amount: response.data.amount,
                    };
                }
                else if (response.data.state === "FAILED") {
                    return {
                        success: false,
                        state: response.data.state,
                        error: response.data.errorCode || "Payment failed",
                    };
                }
                else {
                    return {
                        success: true,
                        state: response.data.state,
                        orderId: response.data.orderId,
                        amount: response.data.amount,
                    };
                }
            }
            catch (error) {
                console.error("PhonePe status check error:", error);
                return {
                    success: false,
                    state: "FAILED",
                    error: ((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) ||
                        error.message ||
                        "Status check failed",
                };
            }
        });
    }
}
exports.PhonePeClient = PhonePeClient;
