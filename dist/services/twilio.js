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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioService = void 0;
const __1 = require("..");
const bad_request_1 = require("../exceptions/bad-request");
const root_1 = require("../exceptions/root");
class TwilioService {
    constructor(config) {
        this.config = config;
        // We'll initialize the client when the twilio package is installed
        // For now, we'll use a placeholder
        this.client = {
            messages: {
                create: (params) => __awaiter(this, void 0, void 0, function* () {
                    // Placeholder implementation
                    console.log("Twilio message create called with params:", params);
                    return { sid: "MOCK_MESSAGE_SID" };
                }),
            },
        };
    }
    /**
     * Format phone number to E.164 format
     * @param phone Phone number to format
     * @returns Formatted phone number
     */
    formatPhoneNumber(phone) {
        // Remove any spaces or special characters
        const cleaned = phone.replace(/\D/g, "");
        // Add + if not present (assuming Indian numbers by default)
        return cleaned.startsWith("+") ? cleaned : `+91${cleaned}`;
    }
    /**
     * Send OTP via SMS
     * @param to Recipient phone number
     * @param otpCode The OTP code to send
     * @param restaurantName Restaurant name to include in the message
     * @returns Promise with message details
     */
    sendSmsOtp(to, otpCode, restaurantName = "Your Restaurant") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const formattedPhone = this.formatPhoneNumber(to);
                console.log(`Sending SMS OTP to ${formattedPhone}`);
                // Create message body
                const messageBody = `Your verification code for ${restaurantName} is: ${otpCode}. This code will expire in 5 minutes.`;
                // Send SMS using Twilio
                const message = yield this.client.messages.create({
                    body: messageBody,
                    from: this.config.fromPhoneNumber,
                    to: formattedPhone,
                });
                console.log("SMS sent successfully", {
                    to: formattedPhone,
                    messageId: message.sid,
                });
                return {
                    success: true,
                    message: "Verification code sent via SMS",
                    messageId: message.sid,
                };
            }
            catch (error) {
                __1.logger.error("Failed to send SMS", {
                    to,
                    error: error.message,
                });
                throw new bad_request_1.BadRequestsException(error.message || "Failed to send SMS", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
            }
        });
    }
    /**
     * Send OTP via WhatsApp
     * @param to Recipient phone number
     * @param otpCode The OTP code to send
     * @param restaurantName Restaurant name to include in the message
     * @returns Promise with message details
     */
    sendWhatsAppOtp(to, otpCode, restaurantName = "Your Restaurant") {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const formattedPhone = this.formatPhoneNumber(to);
                console.log(`Sending WhatsApp OTP to ${formattedPhone}`);
                // Create message body
                const messageBody = `Your verification code for ${restaurantName} is: ${otpCode}. This code will expire in 5 minutes.`;
                // Send WhatsApp message using Twilio
                const message = yield this.client.messages.create({
                    body: messageBody,
                    from: `whatsapp:${this.config.fromPhoneNumber}`,
                    to: `whatsapp:${formattedPhone}`,
                });
                console.log("WhatsApp message sent successfully", {
                    to: formattedPhone,
                    messageId: message.sid,
                });
                return {
                    success: true,
                    message: "Verification code sent via WhatsApp",
                    messageId: message.sid,
                };
            }
            catch (error) {
                __1.logger.error("Failed to send WhatsApp message", {
                    to,
                    error: error.message,
                });
                throw new bad_request_1.BadRequestsException(error.message || "Failed to send WhatsApp message", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
            }
        });
    }
}
exports.TwilioService = TwilioService;
