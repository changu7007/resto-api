import axios from "axios";
import { logger } from "..";
import { BadRequestsException } from "../exceptions/bad-request";
import { ErrorCode } from "../exceptions/root";

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  version: string;
}

interface TemplateComponent {
  type: "body" | "header" | "button";
  sub_type?: "url";
  index?: string;
  parameters: Array<{
    type: "text" | "currency" | "date_time" | "image" | "document";
    text?: string;

    currency?: {
      fallback_value: string;
      code: string;
      amount_1000: number;
    };

    date_time?: {
      fallback_value: string;
    };
    image?: {
      link: string;
    };
    document?: {
      link: string;
      filename: string;
    };
  }>;
}

interface OrderItem {
  name: string;
  quantity: number;
}

interface BillItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface SendTemplateParams {
  to: string;
  templateName: string;
  languageCode: string;
  components?: TemplateComponent[];
}

export class WhatsAppService {
  private config: WhatsAppConfig;
  private baseUrl: string;

  private formatPhoneNumber(phone: string): string {
    // Remove any spaces or special characters
    const cleaned = phone.replace(/\D/g, "");
    // Add + if not present
    return cleaned.startsWith("+") ? cleaned : `+91${cleaned}`;
  }

  private formatCurrency(amount: number, currency: string = "INR"): string {
    return `₹${amount.toFixed(2)}`;
  }

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.baseUrl = `https://graph.facebook.com/${config.version}`;
  }

  async sendTemplateMessage({
    to,
    templateName,
    languageCode,
    components,
  }: SendTemplateParams): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
        {
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
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      logger.info("WhatsApp template message sent successfully", {
        to,
        templateName,
        response: response.data,
      });

      return response.data;
    } catch (error: any) {
      logger.error("Failed to send WhatsApp template message", {
        to,
        templateName,
        error: error.response?.data || error.message,
      });
      throw new BadRequestsException(
        error.response?.data?.error?.message ||
          "Failed to send WhatsApp message",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  }

  async sendBillToCustomer({
    phoneNumber,
    billId,
    items,
    subtotal,
    tax,
    discount,
    totalAmount,
    paymentStatus,
    restaurantName,
    orderType,
  }: {
    phoneNumber: string;
    billId: string;
    items: BillItem[];
    subtotal: number;
    tax: number;
    discount: number;
    totalAmount: number;
    paymentStatus: string;
    restaurantName: string;
    orderType: string;
  }) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);

    // Format items list with prices
    const formattedItems = items
      .map(
        (item) =>
          `${item.name} (${item.quantity}) - Rs.${item.price * item.quantity}`
      )
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
  }

  // Helper method for payment notification to owner
  async sendPaymentNotificationToOwner({
    phoneNumber,
    amount,
    billId,
    paymentMode,
  }: {
    phoneNumber: string;
    amount: number;
    billId: string;
    paymentMode: string;
  }) {
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
  }

  // Helper method for customer order notification
  async sendOrderNotificationToCustomer({
    phoneNumber,
    orderNumber,
    items,
    estimatedTime,
    restaurantName,
  }: {
    phoneNumber: string;
    orderNumber: string;
    items: OrderItem[];
    estimatedTime: string;
    restaurantName: string;
  }) {
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
  }

  // Helper method for authentication OTP
  async sendAuthenticationOTP({
    phoneNumber,
    otp,
    expiryMinutes = 5,
    businessName = "Your Restaurant",
  }: {
    phoneNumber: string;
    otp: string;
    expiryMinutes?: number;
    businessName?: string;
  }) {
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
  }

  // Add this method to debug template structure
  async getTemplateStructure(templateName: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.config.businessAccountId}/message_templates`,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,

            "Content-Type": "application/json",
          },
          params: {
            name: templateName,
          },
        }
      );

      console.log(
        `Template structure for ${templateName}:`,
        JSON.stringify(response.data, null, 2)
      );
      return response.data;
    } catch (error) {
      console.error("Failed to fetch template structure:", error);
      throw error;
    }
  }

  async getAvailableTemplates(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.config.businessAccountId}/message_templates`,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,

            "Content-Type": "application/json",
          },
        }
      );

      console.log("Available templates:", response.data);
      return response.data;
    } catch (error: any) {
      console.log("Failed to fetch templates:", error);
      throw error;
    }
  }
}
