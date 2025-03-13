"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintTemplateService = void 0;
class PrintTemplateService {
    static generateKOTTemplate(order) {
        var _a;
        const template = {
            header: {
                title: "KOT ORDER",
                restaurantName: order.restaurant.name,
                customerName: ((_a = order.customer) === null || _a === void 0 ? void 0 : _a.name) || "Walk-in Customer",
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
    static generateBillTemplate(order) {
        var _a;
        const subTotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
        const gst = subTotal * 0.05; // 5% GST (2.5% SGST + 2.5% CGST)
        const total = subTotal + gst * 2;
        const rounded = Math.round(total) - total;
        const template = {
            header: {
                title: "BILL",
                restaurantName: order.restaurant.name,
                customerName: ((_a = order.customer) === null || _a === void 0 ? void 0 : _a.name) || "Walk-in Customer",
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
exports.PrintTemplateService = PrintTemplateService;
