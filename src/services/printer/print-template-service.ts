import { Order, OrderItem, OrderType } from "@prisma/client";

interface PrintTemplate {
  header: {
    title?: string;
    restaurantName: string;
    customerName: string;
    orderType: string;
    date: string;
    invoice?: string;
    address?: string;
    gstin?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    price?: number;
  }>;
  summary?: {
    subTotal: number;
    rounded: number;
    sgst?: number;
    cgst?: number;
    total: number;
  };
  footer?: {
    totalItems: number;
  };
  payment?: {
    type: "SPLIT" | "SINGLE";
    details?: Array<{ method: string; amount: number }>;
  };
  note?: string;
}

interface ExtendedOrder extends Order {
  items: OrderItem[];
  restaurant: {
    name: string;
    address: string;
    gstin: string;
  };
  customer?: {
    name: string;
  };
}

export class PrintTemplateService {
  static generateKOTTemplate(order: ExtendedOrder): string {
    const template: PrintTemplate = {
      header: {
        title: "KOT ORDER",
        restaurantName: order.restaurant.name,
        customerName: order.customer?.name || "Walk-in Customer",
        orderType: order.orderType,
        date: new Date(order.createdAt).toLocaleString(),
      },
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
      })),
      footer: {
        totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0),
      },
      note: order.note || undefined,
    };

    return JSON.stringify(template);
  }

  static generateBillTemplate(order: ExtendedOrder): string {
    const subTotal = order.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );
    const gst = subTotal * 0.05; // 5% GST (2.5% SGST + 2.5% CGST)
    const total = subTotal + gst * 2;
    const rounded = Math.round(total) - total;

    const template: PrintTemplate = {
      header: {
        title: "BILL",
        restaurantName: order.restaurant.name,
        customerName: order.customer?.name || "Walk-in Customer",
        orderType: order.orderType,
        date: new Date(order.createdAt).toLocaleString(),
        invoice: order.generatedOrderId,
        address: order.restaurant.address,
        gstin: order.restaurant.gstin,
      },
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.totalPrice / item.quantity, // Calculate unit price from total
      })),
      summary: {
        subTotal,
        sgst: gst,
        cgst: gst,
        rounded,
        total: Math.round(total),
      },
      payment: {
        type: "SINGLE", // Default to single payment
        details: [], // Payment details should be updated when payment is processed
      },
    };

    return JSON.stringify(template);
  }
}
