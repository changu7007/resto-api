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
exports.initializeAlertCrons = exports.AlertService = void 0;
const __1 = require("..");
const croner_1 = require("croner");
const redis_1 = require("../services/redis");
const ws_1 = require("../services/ws");
class AlertService {
    // Check for low stock items
    checkLowStock(restaurantId) {
        return __awaiter(this, void 0, void 0, function* () {
            const lowStockItems = yield __1.prismaDB.rawMaterial.findMany({
                where: {
                    restaurantId,
                    currentStock: {
                        lte: __1.prismaDB.rawMaterial.fields.minimumStockLevel,
                    },
                },
            });
            for (const item of lowStockItems) {
                yield this.createAlert({
                    restaurantId,
                    type: "LOW_STOCK",
                    priority: "HIGH",
                    message: `Low stock alert for ${item.name}. Current stock: ${item.currentStock}`,
                    metadata: { itemId: item.id, name: item.name },
                });
            }
        });
    }
    // Check for delayed orders
    checkDelayedOrders(restaurantId) {
        return __awaiter(this, void 0, void 0, function* () {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const delayedOrders = yield __1.prismaDB.order.findMany({
                where: {
                    restaurantId,
                    orderStatus: {
                        in: ["INCOMMING", "PREPARING"],
                    },
                    createdAt: {
                        lte: fiveMinutesAgo,
                    },
                },
            });
            for (const order of delayedOrders) {
                yield this.createAlert({
                    restaurantId,
                    type: "ORDER_DELAY",
                    priority: "CRITICAL",
                    message: `Order #${order.generatedOrderId} is delayed by more than 5 minutes`,
                    metadata: { orderId: order.id },
                });
            }
        });
    }
    // Check for not served Orders
    checkNotServedOrders(restaurantId) {
        return __awaiter(this, void 0, void 0, function* () {
            const oneMinutesAgo = new Date(Date.now() - 1 * 60 * 1000);
            const delayedNotServedOrders = yield __1.prismaDB.order.findMany({
                where: {
                    restaurantId,
                    orderStatus: {
                        in: ["FOODREADY"],
                    },
                    createdAt: {
                        lte: oneMinutesAgo,
                    },
                },
            });
            for (const order of delayedNotServedOrders) {
                yield this.createAlert({
                    restaurantId,
                    type: "ORDER_NOTSERVED",
                    priority: "HIGH",
                    message: `Order #${order.generatedOrderId} is not yet served to the customer`,
                    metadata: {
                        orderId: order === null || order === void 0 ? void 0 : order.id,
                        generatedOrderId: order === null || order === void 0 ? void 0 : order.generatedOrderId,
                    },
                });
            }
        });
    }
    // Check for pending payrolls
    checkPendingPayrolls(restaurantId) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const pendingPayrolls = yield __1.prismaDB.payroll.findMany({
                where: {
                    staff: {
                        restaurantId,
                    },
                    status: "PENDING",
                },
                include: {
                    staff: true,
                },
            });
            for (const payroll of pendingPayrolls) {
                yield this.createAlert({
                    restaurantId,
                    type: "PAYROLL_PENDING",
                    priority: "MEDIUM",
                    message: `Pending payroll for ${payroll.staff.name}`,
                    metadata: {
                        payrollId: payroll.id,
                        staffId: payroll.staff.id,
                        name: (_a = payroll === null || payroll === void 0 ? void 0 : payroll.staff) === null || _a === void 0 ? void 0 : _a.name,
                    },
                });
            }
        });
    }
    // Check for purchase settlements
    checkPurchaseSettlements(restaurantId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pendingSettlements = yield __1.prismaDB.purchase.findMany({
                where: {
                    restaurantId,
                    purchaseStatus: "SETTLEMENT",
                },
                include: {
                    vendor: true,
                },
            });
            for (const purchase of pendingSettlements) {
                yield this.createAlert({
                    restaurantId,
                    type: "PURCHASE_SETTLEMENT",
                    priority: "HIGH",
                    message: `Purchase settlement pending for vendor ${purchase.vendor.name}`,
                    metadata: { purchaseId: purchase.id, vendorId: purchase.vendor.id },
                });
            }
        });
    }
    // Check for purchase settlements
    checkPurchaseProcessed(restaurantId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pendingSettlements = yield __1.prismaDB.purchase.findMany({
                where: {
                    restaurantId,
                    purchaseStatus: { in: ["PROCESSED", "REQUESTED"] },
                },
                include: {
                    vendor: true,
                },
            });
            for (const purchase of pendingSettlements) {
                yield this.createAlert({
                    restaurantId,
                    type: "PURCHASE_ACTION_REQUIRED",
                    priority: "MEDIUM",
                    message: `Purchase Processed/Requested action required for vendor ${purchase.vendor.name}`,
                    metadata: { purchaseId: purchase.id, vendorId: purchase.vendor.id },
                });
            }
        });
    }
    // Create alert
    createAlert({ restaurantId, type, priority, message, metadata, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { orderId, itemId, payrollId, purchaseId, generatedOrderId, name } = metadata || {};
            // Generate href link based on metadata
            const href = this.generateHref({
                restaurantId,
                priority,
                orderId,
                generatedOrderId,
                itemId,
                payrollId,
                name,
                purchaseId,
            });
            // Check if similar alert exists and is still pending
            const existingAlert = yield __1.prismaDB.alert.findFirst({
                where: Object.assign(Object.assign(Object.assign(Object.assign({ restaurantId,
                    type, status: { in: ["PENDING", "ACKNOWLEDGED"] } }, (orderId && { orderId })), (itemId && { itemId })), (payrollId && { payrollId })), (purchaseId && { purchaseId })),
            });
            if (!existingAlert) {
                yield __1.prismaDB.alert.create({
                    data: {
                        restaurantId,
                        type,
                        priority,
                        message,
                        metadata: metadata ? JSON.stringify(metadata) : undefined,
                        orderId,
                        itemId,
                        href: href,
                        payrollId,
                        purchaseId,
                        status: "PENDING",
                    },
                });
                ws_1.websocketManager.notifyClients(restaurantId, "NEW_ALERT");
                const alerts = yield __1.prismaDB.alert.findMany({
                    where: {
                        restaurantId: restaurantId,
                        status: {
                            in: ["PENDING"],
                        },
                    },
                    select: {
                        id: true,
                        type: true,
                        status: true,
                        priority: true,
                        href: true,
                        message: true,
                        createdAt: true,
                    },
                });
                yield redis_1.redis.set(`alerts-${restaurantId}`, JSON.stringify(alerts));
            }
        });
    }
    // Utility to generate href based on metadata
    generateHref({ restaurantId, priority, orderId, generatedOrderId, itemId, payrollId, name, purchaseId, }) {
        if (itemId) {
            return `/${restaurantId}/inventory/stocks?search=${name}`;
        }
        if (orderId) {
            if (priority === "HIGH") {
                return `/${restaurantId}/orders?search=${generatedOrderId}`;
            }
            else {
                return `/${restaurantId}/kitchen-view`;
            }
        }
        if (payrollId) {
            return `/${restaurantId}/payroll?search=${name}`; // Modify if "respective staff name" logic is needed
        }
        if (purchaseId) {
            if (priority === "HIGH") {
                return `/${restaurantId}/inventory/purchases`;
            }
            else {
                return `/${restaurantId}/inventory/purchases?tabs=request-purchases`;
            }
        }
        return "/";
    }
}
exports.AlertService = AlertService;
// Initialize cron jobs
function initializeAlertCrons() {
    // Get all restaurants
    function processAllRestaurants(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const restaurants = yield __1.prismaDB.restaurant.findMany({
                select: { id: true },
            });
            for (const restaurant of restaurants) {
                yield callback(restaurant.id);
            }
        });
    }
    const alertService = new AlertService();
    // Check low stock every hour
    new // Check low stock every hour
     croner_1.Cron("0 * * * *", () => __awaiter(this, void 0, void 0, function* () {
        console.log("Checked Low Stock every hour");
        yield processAllRestaurants((id) => alertService.checkLowStock(id));
    }));
    // Check delayed orders every minute
    new // Check delayed orders every minute
     croner_1.Cron("* * * * *", () => __awaiter(this, void 0, void 0, function* () {
        console.log("Checked Delayed Orders Every Min");
        yield processAllRestaurants((id) => alertService.checkDelayedOrders(id));
    }));
    // Check delayed orders every minute
    new // Check delayed orders every minute
     croner_1.Cron("* * * * *", () => __awaiter(this, void 0, void 0, function* () {
        console.log("Checked NOt Served Orders Every Min");
        yield processAllRestaurants((id) => alertService.checkNotServedOrders(id));
    }));
    // Check pending payrolls daily
    new // Check pending payrolls daily
     croner_1.Cron("0 0 * * *", () => __awaiter(this, void 0, void 0, function* () {
        console.log("Checked Pending Payrolls Daily");
        yield processAllRestaurants((id) => alertService.checkPendingPayrolls(id));
    }));
    // Check purchase settlements every 4 hours
    new // Check purchase settlements every 4 hours
     croner_1.Cron("0 */4 * * *", () => __awaiter(this, void 0, void 0, function* () {
        console.log("Checked Purchase Settlement every hour");
        yield processAllRestaurants((id) => alertService.checkPurchaseSettlements(id));
    }));
    new // Check purchase settlements every 4 hours
     croner_1.Cron("0 */4 * * *", () => __awaiter(this, void 0, void 0, function* () {
        console.log("Checked Purchase Processed/Requested every hour");
        yield processAllRestaurants((id) => alertService.checkPurchaseProcessed(id));
    }));
}
exports.initializeAlertCrons = initializeAlertCrons;
