import { logger } from "..";
import { BadRequestsException } from "../exceptions/bad-request";
import { ErrorCode } from "../exceptions/root";

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string; // Twilio phone number to send SMS from
}

export class TwilioService {
  private client: any; // Using any type temporarily until twilio package is installed
  private config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
    // We'll initialize the client when the twilio package is installed
    // For now, we'll use a placeholder
    this.client = {
      messages: {
        create: async (params: any) => {
          // Placeholder implementation
          console.log("Twilio message create called with params:", params);
          return { sid: "MOCK_MESSAGE_SID" };
        },
      },
    };
  }

  /**
   * Format phone number to E.164 format
   * @param phone Phone number to format
   * @returns Formatted phone number
   */
  private formatPhoneNumber(phone: string): string {
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
  async sendSmsOtp(
    to: string,
    otpCode: string,
    restaurantName: string = "Your Restaurant"
  ): Promise<any> {
    try {
      const formattedPhone = this.formatPhoneNumber(to);
      console.log(`Sending SMS OTP to ${formattedPhone}`);

      // Create message body
      const messageBody = `Your verification code for ${restaurantName} is: ${otpCode}. This code will expire in 5 minutes.`;

      // Send SMS using Twilio
      const message = await this.client.messages.create({
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
    } catch (error: any) {
      logger.error("Failed to send SMS", {
        to,
        error: error.message,
      });
      throw new BadRequestsException(
        error.message || "Failed to send SMS",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  }

  /**
   * Send OTP via WhatsApp
   * @param to Recipient phone number
   * @param otpCode The OTP code to send
   * @param restaurantName Restaurant name to include in the message
   * @returns Promise with message details
   */
  async sendWhatsAppOtp(
    to: string,
    otpCode: string,
    restaurantName: string = "Your Restaurant"
  ): Promise<any> {
    try {
      const formattedPhone = this.formatPhoneNumber(to);
      console.log(`Sending WhatsApp OTP to ${formattedPhone}`);

      // Create message body
      const messageBody = `Your verification code for ${restaurantName} is: ${otpCode}. This code will expire in 5 minutes.`;

      // Send WhatsApp message using Twilio
      const message = await this.client.messages.create({
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
    } catch (error: any) {
      logger.error("Failed to send WhatsApp message", {
        to,
        error: error.message,
      });
      throw new BadRequestsException(
        error.message || "Failed to send WhatsApp message",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  }
}
