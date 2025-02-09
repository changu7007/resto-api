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
exports.WhatsAppService = void 0;
const axios_1 = __importDefault(require("axios"));
const __1 = require("..");
const bad_request_1 = require("../exceptions/bad-request");
const root_1 = require("../exceptions/root");
class WhatsAppService {
    formatPhoneNumber(phone) {
        // Remove any spaces or special characters
        const cleaned = phone.replace(/\D/g, "");
        // Add + if not present
        return cleaned.startsWith("+") ? cleaned : `+91${cleaned}`;
    }
    formatCurrency(amount, currency = "INR") {
        return `₹${amount.toFixed(2)}`;
    }
    constructor(config) {
        this.config = config;
        this.baseUrl = `https://graph.facebook.com/${config.version}`;
    }
    sendTemplateMessage({ to, templateName, languageCode, components, }) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios_1.default.post(`${this.baseUrl}/${this.config.phoneNumberId}/messages`, {
                    messaging_product: "whatsapp",
                    to,
                    type: "template",
                    template: {
                        name: templateName,
                        language: {
                            code: languageCode,
                        },
                        components,
                    },
                }, {
                    headers: {
                        Authorization: `Bearer ${this.config.accessToken}`,
                        "Content-Type": "application/json",
                    },
                });
                __1.logger.info("WhatsApp template message sent successfully", {
                    to,
                    templateName,
                    response: response.data,
                });
                return response.data;
            }
            catch (error) {
                __1.logger.error("Failed to send WhatsApp template message", {
                    to,
                    templateName,
                    error: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message,
                });
                throw new bad_request_1.BadRequestsException(((_d = (_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.message) ||
                    "Failed to send WhatsApp message", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
            }
        });
    }
    sendBillToCustomer({ phoneNumber, billId, items, subtotal, tax, discount, totalAmount, paymentStatus, restaurantName, orderType, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            // Format items list with prices
            const formattedItems = items
                .map((item) => `${item.name} (${item.quantity}) - Rs.${item.price * item.quantity}`)
                .join(", ");
            return this.sendTemplateMessage({
                to: formattedPhone,
                templateName: "bill_details",
                languageCode: "en",
                components: [
                    {
                        type: "header",
                        parameters: [
                            {
                                type: "text",
                                text: restaurantName,
                            },
                        ],
                    },
                    {
                        type: "body",
                        parameters: [
                            {
                                type: "text",
                                text: billId,
                            },
                            {
                                type: "text",
                                text: orderType,
                            },
                            {
                                type: "text",
                                text: formattedItems,
                            },
                            {
                                type: "text",
                                text: subtotal.toString(),
                            },
                            {
                                type: "text",
                                text: tax.toString(),
                            },
                            {
                                type: "text",
                                text: discount.toString(),
                            },
                            {
                                type: "text",
                                text: totalAmount.toString(),
                            },
                            {
                                type: "text",
                                text: paymentStatus,
                            },
                        ],
                    },
                ],
            });
        });
    }
    // Helper method for payment notification to owner
    sendPaymentNotificationToOwner({ phoneNumber, amount, billId, paymentMode, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            return this.sendTemplateMessage({
                to: formattedPhone,
                templateName: "payment_notification",
                languageCode: "en",
                components: [
                    {
                        type: "body",
                        parameters: [
                            {
                                type: "text",
                                text: billId,
                            },
                            {
                                type: "text",
                                text: `Rs.${amount}`,
                            },
                            {
                                type: "text",
                                text: paymentMode,
                            },
                        ],
                    },
                ],
            });
        });
    }
    // Helper method for customer order notification
    sendOrderNotificationToCustomer({ phoneNumber, orderNumber, items, estimatedTime, restaurantName, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            const formattedItems = items
                .map((item) => `${item.name} x ${item.quantity}`)
                .join(", ");
            return this.sendTemplateMessage({
                to: formattedPhone,
                templateName: "order_notification",
                languageCode: "en",
                components: [
                    {
                        type: "body",
                        parameters: [
                            {
                                type: "text",
                                text: orderNumber,
                            },
                            {
                                type: "text",
                                text: formattedItems,
                            },
                            {
                                type: "text",
                                text: estimatedTime,
                            },
                            {
                                type: "text",
                                text: restaurantName,
                            },
                        ],
                    },
                ],
            });
        });
    }
    // Helper method for authentication OTP
    sendAuthenticationOTP({ phoneNumber, otp, expiryMinutes = 5, businessName = "Your Restaurant", }) {
        return __awaiter(this, void 0, void 0, function* () {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            console.log(`Formatted phone number: ${formattedPhone}`);
            return this.sendTemplateMessage({
                to: formattedPhone,
                templateName: "authentication_otp",
                languageCode: "en_US",
                components: [
                    {
                        type: "body",
                        parameters: [
                            {
                                type: "text",
                                text: otp,
                            },
                        ],
                    },
                    {
                        type: "button",
                        sub_type: "url",
                        index: "0",
                        parameters: [
                            {
                                type: "text",
                                text: otp,
                            },
                        ],
                    },
                ],
            });
        });
    }
    // Add this method to debug template structure
    getTemplateStructure(templateName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios_1.default.get(`${this.baseUrl}/${this.config.businessAccountId}/message_templates`, {
                    headers: {
                        Authorization: `Bearer ${this.config.accessToken}`,
                        "Content-Type": "application/json",
                    },
                    params: {
                        name: templateName,
                    },
                });
                console.log(`Template structure for ${templateName}:`, JSON.stringify(response.data, null, 2));
                return response.data;
            }
            catch (error) {
                console.error("Failed to fetch template structure:", error);
                throw error;
            }
        });
    }
    getAvailableTemplates() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios_1.default.get(`${this.baseUrl}/${this.config.businessAccountId}/message_templates`, {
                    headers: {
                        Authorization: `Bearer ${this.config.accessToken}`,
                        "Content-Type": "application/json",
                    },
                });
                console.log("Available templates:", response.data);
                return response.data;
            }
            catch (error) {
                console.log("Failed to fetch templates:", error);
                throw error;
            }
        });
    }
}
exports.WhatsAppService = WhatsAppService;
