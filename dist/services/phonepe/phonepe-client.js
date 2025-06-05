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
        console.log("PhonePe Client Configuration:", {
            environment: config.environment,
            baseUrl: this.baseUrl,
            merchantId: config.merchantId,
        });
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
                console.log("PhonePe Auth Token Generated");
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
    generatePhonePeOrderId(prefix = "PP") {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, "0");
        // Remove any special characters and ensure it's alphanumeric with underscores only
        return `${prefix}_${timestamp}_${random}`.replace(/[^a-zA-Z0-9_]/g, "");
    }
    createPayment(request) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
        return __awaiter(this, void 0, void 0, function* () {
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
                // Get auth token for the request
                const token = yield this.getAuthToken();
                console.log("PhonePe Auth Token:", token);
                console.log(`Request URL: ${this.baseUrl}/checkout/v2/pay`);
                const response = yield this.httpClient.post("/checkout/v2/pay", {
                    merchantOrderId: request.merchantOrderId,
                    amount: request.amount,
                    expireAfter: 1200, // 20 minutes default expiry
                    metaInfo: {
                        udf1: ((_f = request.metadata) === null || _f === void 0 ? void 0 : _f.outletId) || "",
                        udf2: ((_g = request.metadata) === null || _g === void 0 ? void 0 : _g.from) || "",
                        udf3: ((_h = request.metadata) === null || _h === void 0 ? void 0 : _h.domain) || "",
                        udf4: ((_j = request.metadata) === null || _j === void 0 ? void 0 : _j.type) || "",
                        udf5: ((_k = request.metadata) === null || _k === void 0 ? void 0 : _k.userId) || "",
                    },
                    paymentFlow: {
                        type: "PG_CHECKOUT",
                        message: "Payment for order",
                        merchantUrls: {
                            redirectUrl: request.redirectUrl,
                        },
                    },
                }, {
                    headers: {
                        Authorization: `O-Bearer ${token}`,
                        "Content-Type": "application/json",
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
                    ((_m = (_l = response.data.data) === null || _l === void 0 ? void 0 : _l.error) === null || _m === void 0 ? void 0 : _m.message) ||
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
                    response: (_o = error.response) === null || _o === void 0 ? void 0 : _o.data,
                    status: (_p = error.response) === null || _p === void 0 ? void 0 : _p.status,
                    headers: (_q = error.response) === null || _q === void 0 ? void 0 : _q.headers,
                    stack: error.stack,
                });
                const errorMessage = ((_s = (_r = error.response) === null || _r === void 0 ? void 0 : _r.data) === null || _s === void 0 ? void 0 : _s.message) ||
                    ((_u = (_t = error.response) === null || _t === void 0 ? void 0 : _t.data) === null || _u === void 0 ? void 0 : _u.error) ||
                    ((_y = (_x = (_w = (_v = error.response) === null || _v === void 0 ? void 0 : _v.data) === null || _w === void 0 ? void 0 : _w.data) === null || _x === void 0 ? void 0 : _x.error) === null || _y === void 0 ? void 0 : _y.message) ||
                    error.message ||
                    "Payment creation failed";
                return {
                    success: false,
                    error: errorMessage,
                    errorCode: ((_0 = (_z = error.response) === null || _z === void 0 ? void 0 : _z.data) === null || _0 === void 0 ? void 0 : _0.code) || "UNKNOWN_ERROR",
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
                const token = yield this.getAuthToken();
                const response = yield this.httpClient.get(`/checkout/v2/order/${merchantOrderId}/status`, {
                    headers: {
                        Authorization: `O-Bearer ${token}`,
                        "Content-Type": "application/json",
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
