// services/printer/print-manager.ts

import { PrinterService } from "./printer-service";
import { PrintTemplateService } from "./print-template-service";
import { prismaDB } from "../..";
import { Order, OrderItem, PrintLocationType } from "@prisma/client";
import { PrintContent, Printer, PrintResult } from "./types";

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

export class PrintManager {
  private printerServices: Map<string, PrinterService> = new Map();

  async initialize(restaurantId: string) {
    // Get all active printers for the restaurant
    const printers = await prismaDB.printer.findMany({
      where: {
        restaurantId,
        isActive: true,
      },
      include: {
        printLocations: {
          include: {
            printLocation: true,
          },
        },
      },
    });

    // Initialize printer services
    printers.forEach((printer) => {
      this.printerServices.set(
        printer.id,
        new PrinterService({
          connectionType: printer.connectionType,
          printerType: printer.printerType,
          paperWidth: printer.paperWidth,
          ipAddress: printer.ipAddress || undefined,
          port: printer.port || undefined,
          macAddress: printer.macAddress || undefined,
          usbVendorId: printer.usbVendorId || undefined,
          usbProductId: printer.usbProductId || undefined,
        })
      );
    });
  }

  private formatContent(content: PrintContent): string {
    let formattedContent = "";

    // Add header
    formattedContent += `${content.content.header.restaurantName}\n`;
    formattedContent += `${content.content.header.orderType}\n`;
    formattedContent += `Customer: ${content.content.header.customerName}\n`;
    formattedContent += `Date: ${content.content.header.date}\n\n`;

    // Add items
    formattedContent += "Items:\n";
    formattedContent += "-".repeat(32) + "\n";
    content.content.items.forEach((item) => {
      formattedContent += `${item.name} x${item.quantity}`;
      if (item.price) {
        formattedContent += ` - ₹${item.price.toFixed(2)}`;
      }
      formattedContent += "\n";
    });
    formattedContent += "-".repeat(32) + "\n";

    // Add summary if available
    if (content.content.summary) {
      const { summary } = content.content;
      formattedContent += `\nSubtotal: ₹${summary.subTotal.toFixed(2)}\n`;
      if (summary.sgst) {
        formattedContent += `SGST: ₹${summary.sgst.toFixed(2)}\n`;
      }
      if (summary.cgst) {
        formattedContent += `CGST: ₹${summary.cgst.toFixed(2)}\n`;
      }
      formattedContent += `Total: ₹${summary.total.toFixed(2)}\n`;
      formattedContent += `Rounded: ₹${summary.rounded.toFixed(2)}\n`;
    }

    // Add payment details if available
    if (content.content.payment) {
      formattedContent += "\nPayment Details:\n";
      formattedContent += "-".repeat(32) + "\n";
      if (content.content.payment.type === "SPLIT") {
        content.content.payment.details?.forEach((detail) => {
          formattedContent += `${detail.method}: ₹${detail.amount.toFixed(
            2
          )}\n`;
        });
      } else {
        const detail = content.content.payment.details?.[0];
        if (detail) {
          formattedContent += `${detail.method}: ₹${detail.amount.toFixed(
            2
          )}\n`;
        }
      }
    }

    // Add footer if available
    if (content.content.footer) {
      formattedContent += `\nTotal Items: ${content.content.footer.totalItems}\n`;
    }

    // Add note if available
    if (content.content.note) {
      formattedContent += `\nNote: ${content.content.note}\n`;
    }

    return formattedContent;
  }

  async print(printer: Printer, content: PrintContent): Promise<PrintResult> {
    try {
      const printerService = this.printerServices.get(printer.id);
      if (!printerService) {
        throw new Error(`Printer service not found for printer ${printer.id}`);
      }

      const formattedContent = this.formatContent(content);
      return await printerService.print({
        content: formattedContent,
        cutPaper: true,
        openCashDrawer: content.type === "BILL",
        copies: content.type === "BILL" ? 2 : 1,
      });
    } catch (error) {
      console.error(`Print error for printer ${printer.id}:`, error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        printerId: printer.id,
      };
    }
  }
}
