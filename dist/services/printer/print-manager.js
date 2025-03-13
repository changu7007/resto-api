"use strict";
// services/printer/print-manager.ts
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
exports.PrintManager = void 0;
const printer_service_1 = require("./printer-service");
const __1 = require("../..");
class PrintManager {
    constructor() {
        this.printerServices = new Map();
    }
    initialize(restaurantId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get all active printers for the restaurant
            const printers = yield __1.prismaDB.printer.findMany({
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
                this.printerServices.set(printer.id, new printer_service_1.PrinterService({
                    connectionType: printer.connectionType,
                    printerType: printer.printerType,
                    paperWidth: printer.paperWidth,
                    ipAddress: printer.ipAddress || undefined,
                    port: printer.port || undefined,
                    macAddress: printer.macAddress || undefined,
                    usbVendorId: printer.usbVendorId || undefined,
                    usbProductId: printer.usbProductId || undefined,
                }));
            });
        });
    }
    formatContent(content) {
        var _a, _b;
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
                (_a = content.content.payment.details) === null || _a === void 0 ? void 0 : _a.forEach((detail) => {
                    formattedContent += `${detail.method}: ₹${detail.amount.toFixed(2)}\n`;
                });
            }
            else {
                const detail = (_b = content.content.payment.details) === null || _b === void 0 ? void 0 : _b[0];
                if (detail) {
                    formattedContent += `${detail.method}: ₹${detail.amount.toFixed(2)}\n`;
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
    print(printer, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const printerService = this.printerServices.get(printer.id);
                if (!printerService) {
                    throw new Error(`Printer service not found for printer ${printer.id}`);
                }
                const formattedContent = this.formatContent(content);
                return yield printerService.print({
                    content: formattedContent,
                    cutPaper: true,
                    openCashDrawer: content.type === "BILL",
                    copies: content.type === "BILL" ? 2 : 1,
                });
            }
            catch (error) {
                console.error(`Print error for printer ${printer.id}:`, error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred",
                    printerId: printer.id,
                };
            }
        });
    }
}
exports.PrintManager = PrintManager;
