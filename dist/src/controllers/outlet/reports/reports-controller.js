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
exports.formatDailyReportWorkbook = exports.getReportsForTable = exports.posGenerateReport = exports.createReport = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const client_s3_1 = require("@aws-sdk/client-s3");
const exceljs_1 = __importDefault(require("exceljs"));
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const axios_1 = __importDefault(require("axios"));
const zod_1 = require("zod");
const bad_request_1 = require("../../../exceptions/bad-request");
const date_fns_1 = require("date-fns");
const utils_1 = require("../../../lib/utils");
// Add timezone utility functions
function convertToIST(date) {
    return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}
function setISTTime(date, hours, minutes, seconds, milliseconds) {
    const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    istDate.setHours(hours, minutes, seconds, milliseconds);
    return istDate;
}
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const formSchema = zod_1.z.object({
    reportType: zod_1.z.enum([
        "DAYREPORT",
        "SALES",
        "INVENTORY",
        "FINANCIAL",
        "STAFF",
        "CASHREGISTER",
    ]),
    format: zod_1.z.enum(["PDF", "EXCEL"]),
    dateRange: zod_1.z.object({
        from: zod_1.z.string().refine((date) => !isNaN(Date.parse(date)), {
            message: "Invalid 'from' date",
        }),
        to: zod_1.z.string().refine((date) => !isNaN(Date.parse(date)), {
            message: "Invalid 'to' date",
        }),
    }),
});
const createReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const { outletId } = req.params;
    const { data: validateFields, error } = formSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    console.log("Validate fields", validateFields);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const data = yield fetchReportData(validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType, (_b = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _b === void 0 ? void 0 : _b.from, (_c = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _c === void 0 ? void 0 : _c.to, outletId);
    if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.format) === "PDF") {
        yield __1.prismaDB.report.create({
            data: {
                restaurantId: outletId,
                userId,
                reportType: validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType,
                format: validateFields === null || validateFields === void 0 ? void 0 : validateFields.format,
                generatedBy: ((_d = outlet.users) === null || _d === void 0 ? void 0 : _d.name) || "System",
                status: "COMPLETED",
                reportData: data,
                dateRange: {
                    create: {
                        startDate: new Date((_e = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _e === void 0 ? void 0 : _e.from),
                        endDate: new Date((_f = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _f === void 0 ? void 0 : _f.to),
                    },
                },
            },
        });
        return res.json({
            success: true,
            message: "PDF report generated",
            reportData: data,
        });
    }
    else if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.format) === "EXCEL") {
        const fileUrl = yield generateExcel(data, validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType, outlet.name);
        yield __1.prismaDB.report.create({
            data: {
                restaurantId: outletId,
                userId,
                reportType: validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType,
                format: validateFields === null || validateFields === void 0 ? void 0 : validateFields.format,
                generatedBy: ((_g = outlet.users) === null || _g === void 0 ? void 0 : _g.name) || "System",
                status: "COMPLETED",
                fileUrl: fileUrl,
                dateRange: {
                    create: {
                        startDate: new Date((_h = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _h === void 0 ? void 0 : _h.from),
                        endDate: new Date((_j = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _j === void 0 ? void 0 : _j.to),
                    },
                },
            },
        });
        return res.json({
            success: true,
            message: "Excel report generated",
        });
    }
});
exports.createReport = createReport;
const posformSchema = zod_1.z.object({
    reportType: zod_1.z.enum(["DAYREPORT", "SALES"]),
    format: zod_1.z.enum(["PDF", "EXCEL"]),
    dateRange: zod_1.z.object({
        from: zod_1.z.string().refine((date) => !isNaN(Date.parse(date)), {
            message: "Invalid 'from' date",
        }),
        to: zod_1.z.string().refine((date) => !isNaN(Date.parse(date)), {
            message: "Invalid 'to' date",
        }),
    }),
});
const posGenerateReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _k, _l;
    const { outletId } = req.params;
    const { data: validateFields, error } = posformSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    console.log("Validate fields", validateFields);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const data = yield fetchReportData(validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType, (_k = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _k === void 0 ? void 0 : _k.from, (_l = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _l === void 0 ? void 0 : _l.to, outletId);
    if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.format) === "PDF") {
        return res.json({
            success: true,
            message: "PDF report generated",
            reportType: validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType,
            reportData: data,
        });
    }
    else if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.format) === "EXCEL") {
        const fileUrl = yield generateExcel(data, validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType, outlet.name);
        return res.json({
            success: true,
            reportData: data,
            message: "Excel report generated",
            reportType: validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType,
            fileUrl: fileUrl,
        });
    }
});
exports.posGenerateReport = posGenerateReport;
function fetchReportData(reportType, startDate, endDate, restaurantId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Adjust date ranges to start at 00:00:00 for the start date and 23:59:59 for the end date (IST)
        const startDateWithTime = new Date(startDate);
        const endDateWithTime = new Date(endDate);
        // Convert to IST and set appropriate times
        const istStartDate = setISTTime(startDateWithTime, 0, 0, 0, 0);
        const istEndDate = setISTTime(endDateWithTime, 23, 59, 59, 999);
        const where = {
            restaurantId,
            updatedAt: {
                gte: istStartDate,
                lte: istEndDate,
            },
        };
        const dateRange = {
            from: istStartDate.toISOString(),
            to: istEndDate.toISOString(),
        };
        switch (reportType) {
            case "DAYREPORT":
                return formatDayReport(dateRange, restaurantId);
            case "SALES":
                return formatSalesData(dateRange, restaurantId);
            case "INVENTORY":
                return formatInventoryData(dateRange, restaurantId);
            case "CASHREGISTER":
                return formatCashRegisterData(dateRange, restaurantId);
            case "FINANCIAL":
                const [orders, expenses] = yield Promise.all([
                    __1.prismaDB.order.findMany({
                        where,
                        select: { totalAmount: true, gstPrice: true },
                    }),
                    __1.prismaDB.expenses.findMany({ where }),
                ]);
                return { orders, expenses };
            case "STAFF":
                return __1.prismaDB.payroll.findMany({ where, include: { staff: true } });
            default:
                throw new Error("Invalid reportType");
        }
    });
}
function formatDayReport(dateRange, restaurantId) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const [restaurant, orders, expenses, cashRegister, staffActivities] = yield Promise.all([
            __1.prismaDB.restaurant.findUnique({
                where: { id: restaurantId },
                select: {
                    name: true,
                    address: true,
                    phoneNo: true,
                    email: true,
                    imageUrl: true,
                },
            }),
            __1.prismaDB.order.findMany({
                where: {
                    restaurantId,
                    updatedAt: {
                        gte: new Date(dateRange.from),
                        lte: new Date(dateRange.to),
                    },
                },
                include: {
                    orderSession: {
                        select: {
                            billId: true,
                            paymentMethod: true,
                            isPaid: true,
                            splitPayments: true,
                            sessionStatus: true,
                        },
                    },
                },
            }),
            __1.prismaDB.expenses.findMany({
                where: {
                    restaurantId,
                    updatedAt: {
                        gte: new Date(dateRange.from),
                        lte: new Date(dateRange.to),
                    },
                },
            }),
            __1.prismaDB.cashRegister.findMany({
                where: {
                    restaurantId,
                    createdAt: {
                        gte: new Date(dateRange.from),
                        lte: new Date(dateRange.to),
                    },
                },
                include: {
                    transactions: true,
                },
            }),
            __1.prismaDB.order.groupBy({
                by: ["createdBy"],
                where: {
                    restaurantId,
                    updatedAt: {
                        gte: new Date(dateRange.from),
                        lte: new Date(dateRange.to),
                    },
                },
                _count: { _all: true },
                _sum: { totalAmount: true },
            }),
        ]);
        const formattedOrders = orders.map((order) => {
            var _a, _b, _c, _d;
            return ({
                billId: ((_a = order.orderSession) === null || _a === void 0 ? void 0 : _a.billId) || order.id,
                orderType: order.orderType,
                paidStatus: ((_b = order.orderSession) === null || _b === void 0 ? void 0 : _b.isPaid) ? "Paid" : "Unpaid",
                totalAmount: Number(order.totalAmount),
                paymentMethod: (_c = order.orderSession) === null || _c === void 0 ? void 0 : _c.paymentMethod,
                status: (_d = order.orderSession) === null || _d === void 0 ? void 0 : _d.sessionStatus,
                createdAt: order.updatedAt,
                createdBy: order.createdBy,
            });
        });
        const paymentTotals = {
            CASH: 0,
            UPI: 0,
            CARD: 0,
            NOTPAID: 0,
        };
        for (const order of orders) {
            if (order.orderSession.sessionStatus === "COMPLETED" ||
                order.orderSession.sessionStatus === "ONPROGRESS") {
                const method = ((_a = order.orderSession) === null || _a === void 0 ? void 0 : _a.paymentMethod) || "NOTPAID";
                if (method === "SPLIT") {
                    (_b = order.orderSession.splitPayments) === null || _b === void 0 ? void 0 : _b.forEach((sp) => {
                        paymentTotals[sp.method] =
                            (paymentTotals[sp.method] || 0) + sp.amount;
                    });
                }
                else {
                    paymentTotals[method] =
                        (paymentTotals[method] || 0) + Number(order.totalAmount);
                }
            }
        }
        const totalRevenue = orders
            .filter((o) => { var _a; return ((_a = o.orderSession) === null || _a === void 0 ? void 0 : _a.sessionStatus) === "COMPLETED"; })
            .reduce((sum, o) => sum + Number(o.totalAmount), 0);
        const unpaidRevenue = orders
            .filter((o) => { var _a; return ((_a = o.orderSession) === null || _a === void 0 ? void 0 : _a.sessionStatus) === "ONPROGRESS"; })
            .reduce((sum, o) => sum + Number(o.totalAmount), 0);
        const cancelledRevenue = orders
            .filter((o) => { var _a; return ((_a = o.orderSession) === null || _a === void 0 ? void 0 : _a.sessionStatus) === "CANCELLED"; })
            .reduce((sum, o) => sum + Number(o.totalAmount), 0);
        const topItems = yield __1.prismaDB.orderItem.groupBy({
            by: ["name"],
            where: {
                order: {
                    restaurantId,
                    orderSession: {
                        sessionStatus: {
                            in: ["ONPROGRESS", "COMPLETED"],
                        },
                    },
                    updatedAt: {
                        gte: new Date(dateRange.from),
                        lte: new Date(dateRange.to),
                    },
                },
            },
            _sum: { quantity: true, totalPrice: true },
            orderBy: { _sum: { quantity: "desc" } },
        });
        return {
            restaurant: Object.assign(Object.assign({}, restaurant), { phone: restaurant === null || restaurant === void 0 ? void 0 : restaurant.phoneNo, dateRange: {
                    from: new Date(dateRange.from).toLocaleString(),
                    to: new Date(dateRange.to).toLocaleString(),
                } }),
            summary: {
                orders: {
                    total: orders.length,
                    completed: orders.filter((o) => { var _a; return ((_a = o.orderSession) === null || _a === void 0 ? void 0 : _a.sessionStatus) === "COMPLETED"; }).length,
                    onProgress: orders.filter((o) => { var _a; return ((_a = o.orderSession) === null || _a === void 0 ? void 0 : _a.sessionStatus) === "ONPROGRESS"; }).length,
                    cancelled: orders.filter((o) => { var _a; return ((_a = o.orderSession) === null || _a === void 0 ? void 0 : _a.sessionStatus) === "CANCELLED"; }).length,
                    totalRevenue,
                    unpaidRevenue,
                    cancelledRevenue,
                    paymentTotals,
                },
                cashRegister: cashRegister
                    ? {
                        openingCash: cashRegister.reduce((sum, tx) => sum + tx.openingBalance, 0),
                        cashIn: cashRegister === null || cashRegister === void 0 ? void 0 : cashRegister.reduce((sum, cash) => {
                            var _a;
                            return sum +
                                (0, utils_1.calculateInOut)((_a = cash === null || cash === void 0 ? void 0 : cash.transactions) === null || _a === void 0 ? void 0 : _a.filter((tx) => tx.type === "CASH_IN"));
                        }, 0),
                        cashOut: cashRegister === null || cashRegister === void 0 ? void 0 : cashRegister.reduce((sum, cash) => {
                            var _a;
                            return sum +
                                (0, utils_1.calculateInOut)((_a = cash === null || cash === void 0 ? void 0 : cash.transactions) === null || _a === void 0 ? void 0 : _a.filter((tx) => tx.type === "CASH_OUT"));
                        }, 0),
                        closingCash: cashRegister.reduce((sum, tx) => sum + Number(tx.closingBalance || 0), 0),
                    }
                    : null,
                expenses: expenses.map((e) => ({
                    category: e.category,
                    description: e.description,
                    amount: e.amount,
                    paymentMethod: e.paymentMethod,
                })),
                topItems: topItems.map((i) => ({
                    itemName: i.name,
                    quantitySold: i._sum.quantity,
                    totalSales: i._sum.totalPrice,
                })),
                staffPerformance: staffActivities.map((s) => ({
                    staffId: s.createdBy,
                    ordersHandled: s._count._all,
                    revenueGenerated: s._sum.totalAmount,
                })),
            },
        };
    });
}
function formatCashRegisterData(dateRange, restaurantId) {
    return __awaiter(this, void 0, void 0, function* () {
        const where = {
            restaurantId: restaurantId,
            updatedAt: {
                gt: new Date(dateRange.from),
                lt: new Date(dateRange.to),
            },
        };
        // Fetch all required data in parallel
        const [cashRegister, outlet] = yield Promise.all([
            __1.prismaDB.cashRegister.findMany({
                where,
                include: {
                    denominations: true,
                    transactions: true,
                    staff: {
                        select: {
                            id: true,
                            name: true,
                            role: true,
                        },
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            role: true,
                        },
                    },
                },
            }),
            __1.prismaDB.restaurant.findUnique({
                where: { id: restaurantId },
                select: {
                    name: true,
                    address: true,
                    phoneNo: true,
                    email: true,
                    imageUrl: true,
                },
            }),
        ]);
        const cashIn = cashRegister.reduce((sum, tx) => sum +
            (0, utils_1.calculateInOut)(tx.transactions.filter((trans) => trans.type === "CASH_IN")), 0);
        const cashOut = cashRegister.reduce((sum, tx) => sum +
            (0, utils_1.calculateInOut)(tx.transactions.filter((trans) => trans.type === "CASH_OUT")), 0);
        const paymentBreakDown = (paymentMethod, cashTransactionType) => {
            return cashRegister.reduce((sum, tx) => sum +
                (0, utils_1.calculateInOut)(tx.transactions.filter((trans) => trans.type === cashTransactionType &&
                    trans.paymentMethod === paymentMethod)), 0);
        };
        const formattedTransactions = cashRegister.flatMap((register) => register.transactions.map((transaction) => {
            var _a, _b;
            return ({
                id: transaction.id,
                date: transaction.createdAt,
                transactionType: transaction.type,
                description: transaction.description,
                amount: transaction.amount,
                source: transaction.source,
                paymentMethod: transaction.paymentMethod,
                registerId: register.id,
                performedBy: ((_a = register === null || register === void 0 ? void 0 : register.staff) === null || _a === void 0 ? void 0 : _a.name) || ((_b = register === null || register === void 0 ? void 0 : register.user) === null || _b === void 0 ? void 0 : _b.name),
            });
        }));
        return {
            restaurant: {
                name: (outlet === null || outlet === void 0 ? void 0 : outlet.name) || "",
                address: (outlet === null || outlet === void 0 ? void 0 : outlet.address) || "",
                phone: (outlet === null || outlet === void 0 ? void 0 : outlet.phoneNo) || "",
                email: (outlet === null || outlet === void 0 ? void 0 : outlet.email) || "",
                logo: (outlet === null || outlet === void 0 ? void 0 : outlet.imageUrl) || "",
                dateRange: {
                    from: new Date(dateRange.from).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                    to: new Date(dateRange.to).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                },
            },
            summary: {
                totalOpenedRegister: cashRegister === null || cashRegister === void 0 ? void 0 : cashRegister.length,
                openingBalance: cashRegister.reduce((balance, tx) => balance + tx.openingBalance, 0),
                totalCashIn: cashIn,
                totalCashOut: cashOut,
                netPosition: cashIn - cashOut,
                expectedClosingBalance: cashRegister.reduce((balance, tx) => balance + Number(tx.actualBalance), 0),
                actualClosingBlance: cashRegister.reduce((balance, tx) => balance + Number(tx.closingBalance), 0),
                discrepancy: cashRegister.reduce((total, tx) => total +
                    (Number(tx.actualBalance || 0) - Number(tx.closingBalance || 0)), 0),
                paymentDistribution: {
                    cashIn: {
                        cash: paymentBreakDown("CASH", "CASH_IN"),
                        upi: paymentBreakDown("UPI", "CASH_IN"),
                        card: paymentBreakDown("DEBIT", "CASH_IN"),
                        total: cashIn,
                    },
                    cashOut: {
                        cash: paymentBreakDown("CASH", "CASH_OUT"),
                        upi: paymentBreakDown("UPI", "CASH_OUT"),
                        card: paymentBreakDown("DEBIT", "CASH_OUT"),
                        total: cashOut,
                    },
                },
                formattedTransactions: formattedTransactions,
            },
        };
    });
}
function formatSalesData(dateRange, outletId) {
    return __awaiter(this, void 0, void 0, function* () {
        // const where = ;
        // Fetch all required data in parallel
        const [orders, outlet] = yield Promise.all([
            __1.prismaDB.order.findMany({
                where: {
                    restaurantId: outletId,
                    orderSession: {
                        sessionStatus: {
                            in: ["COMPLETED", "ONPROGRESS"],
                        },
                    },
                    updatedAt: {
                        gt: new Date(dateRange.from),
                        lt: new Date(dateRange.to),
                    },
                },
                include: {
                    orderSession: {
                        select: {
                            billId: true,
                            paymentMethod: true,
                            isPaid: true,
                            splitPayments: true,
                            sessionStatus: true,
                        },
                    },
                },
            }),
            __1.prismaDB.restaurant.findUnique({
                where: { id: outletId },
                select: {
                    name: true,
                    address: true,
                    phoneNo: true,
                    email: true,
                    imageUrl: true,
                },
            }),
        ]);
        // Format the orders for table display
        const formattedOrders = orders.map((order) => {
            var _a;
            return {
                billId: order.orderSession.billId || order.id,
                orderType: order.orderType,
                paidStatus: order.orderSession.isPaid ? "Paid" : "Unpaid",
                totalAmount: Number(order.totalAmount),
                paymentMethod: order.orderSession.paymentMethod,
                status: (_a = order === null || order === void 0 ? void 0 : order.orderSession) === null || _a === void 0 ? void 0 : _a.sessionStatus,
                createdAt: order === null || order === void 0 ? void 0 : order.updatedAt,
                createdBy: order.createdBy,
            };
        });
        const standardizedPayments = {
            CASH: 0,
            UPI: 0,
            CARD: 0,
            NOTPAID: 0,
        };
        // Process all orders to calculate payment method distribution
        orders.forEach((order) => {
            const paymentMethod = order.orderSession.paymentMethod;
            const orderAmount = Number(order.totalAmount);
            // Handle regular (non-split) payments
            if (paymentMethod !== "SPLIT") {
                const standardMethod = mapPaymentMethod(paymentMethod);
                standardizedPayments[standardMethod] += orderAmount;
            }
            // Handle split payments by distributing amounts across standardized categories
            else if (order.paymentMethod === "SPLIT" &&
                order.orderSession.splitPayments &&
                order.orderSession.splitPayments.length > 0) {
                order.orderSession.splitPayments.forEach((splitPayment) => {
                    const standardMethod = mapPaymentMethod(splitPayment.method);
                    standardizedPayments[standardMethod] += splitPayment.amount;
                });
            }
            // If it's marked as SPLIT but no split details available, put it in OTHER
            else {
                standardizedPayments["NOTPAID"] += orderAmount;
            }
        });
        // Remove any payment methods with zero amounts
        const paymentMethods = Object.fromEntries(Object.entries(standardizedPayments).filter(([_, amount]) => amount > 0));
        // Calculate total revenue
        const totalRevenue = orders
            .filter((o) => o.orderSession.sessionStatus === "COMPLETED")
            .reduce((acc, order) => acc + Number(order.totalAmount), 0);
        const unpaidRevenue = orders
            .filter((o) => o.orderSession.sessionStatus === "ONPROGRESS")
            .reduce((acc, order) => acc + Number(order.totalAmount), 0);
        return {
            restaurant: {
                name: (outlet === null || outlet === void 0 ? void 0 : outlet.name) || "",
                address: (outlet === null || outlet === void 0 ? void 0 : outlet.address) || "",
                phone: (outlet === null || outlet === void 0 ? void 0 : outlet.phoneNo) || "",
                email: (outlet === null || outlet === void 0 ? void 0 : outlet.email) || "",
                logo: (outlet === null || outlet === void 0 ? void 0 : outlet.imageUrl) || "",
                dateRange: {
                    from: new Date(dateRange.from).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                    to: new Date(dateRange.to).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                },
            },
            ordersData: {
                formattedOrders,
                totalRevenue,
                paymentMethods,
            },
        };
    });
}
// Function to standardize payment methods
function mapPaymentMethod(method) {
    // Map payment methods to standardized categories: CASH, UPI, CARD
    switch (method) {
        case "CASH":
            return "CASH";
        case "UPI":
            return "UPI";
        case "CREDIT":
        case "DEBIT":
            return "CARD"; // Map both CREDIT and DEBIT to CARD
        default:
            return "NOTPAID";
    }
}
function formatInventoryData(dateRange, outletId) {
    return __awaiter(this, void 0, void 0, function* () {
        const where = {
            restaurantId: outletId,
            createdAt: {
                gte: new Date(dateRange.from),
                lte: new Date(dateRange.to),
            },
        };
        // Fetch all required data in parallel
        const [rawMaterials, categories, purchases, vendors, outlet] = yield Promise.all([
            __1.prismaDB.rawMaterial.findMany({
                where: { restaurantId: outletId },
                include: {
                    rawMaterialCategory: true,
                    consumptionUnit: true,
                    minimumStockUnit: true,
                },
            }),
            __1.prismaDB.rawMaterialCategory.count({
                where: { restaurantId: outletId },
            }),
            __1.prismaDB.purchase.findMany({
                where,
                include: {
                    vendor: true,
                    purchaseItems: {
                        include: {
                            rawMaterial: {
                                include: {
                                    rawMaterialCategory: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            __1.prismaDB.vendor.findMany({
                where: { restaurantId: outletId },
                include: {
                    purchases: {
                        where,
                        include: {
                            purchaseItems: true,
                        },
                    },
                },
            }),
            __1.prismaDB.restaurant.findUnique({
                where: { id: outletId },
                select: {
                    name: true,
                    address: true,
                    phoneNo: true,
                    email: true,
                    imageUrl: true,
                },
            }),
        ]);
        // Calculate total purchase amount
        const totalPurchaseAmount = purchases.reduce((sum, purchase) => sum + (purchase.totalAmount || 0), 0);
        // Format raw materials by category
        const rawMaterialsByCategory = rawMaterials.reduce((acc, material) => {
            const categoryName = material.rawMaterialCategory.name;
            if (!acc[categoryName]) {
                acc[categoryName] = {
                    count: 0,
                    totalValue: 0,
                    items: [],
                };
            }
            const value = (material.currentStock || 0) * (material.lastPurchasedPrice || 0);
            acc[categoryName].count++;
            acc[categoryName].totalValue += value;
            acc[categoryName].items.push({
                name: material.name,
                currentStock: material.currentStock || 0,
                minimumStock: material.minimumStockLevel || 0,
                unit: material.consumptionUnit.name,
                value: value,
                lastPurchasePrice: material.lastPurchasedPrice || 0,
            });
            return acc;
        }, {});
        // Calculate stock status
        const stockStatus = rawMaterials.reduce((acc, material) => {
            if (!material.currentStock || material.currentStock === 0) {
                acc.outOfStock++;
            }
            else if (material.currentStock <= (material.minimumStockLevel || 0)) {
                acc.low++;
            }
            else {
                acc.optimal++;
            }
            return acc;
        }, { optimal: 0, low: 0, outOfStock: 0 });
        // Format recent purchases
        const recentPurchases = purchases.slice(0, 5).map((purchase) => ({
            invoiceNo: purchase.invoiceNo,
            vendorName: purchase.vendor.name,
            date: purchase.createdAt.toISOString().split("T")[0],
            amount: purchase.totalAmount || 0,
            status: purchase.purchaseStatus,
            items: purchase.purchaseItems.length,
        }));
        // Format vendor analysis
        const vendorAnalysis = vendors.map((vendor) => {
            var _a;
            const vendorPurchases = vendor.purchases;
            const totalAmount = vendorPurchases.reduce((sum, purchase) => sum + (purchase.totalAmount || 0), 0);
            return {
                name: vendor.name,
                totalPurchases: vendorPurchases.length,
                totalAmount,
                lastPurchaseDate: ((_a = vendorPurchases[0]) === null || _a === void 0 ? void 0 : _a.createdAt.toISOString().split("T")[0]) || "",
            };
        });
        // Calculate purchase history
        const purchaseHistory = {
            monthly: purchases.reduce((acc, purchase) => {
                const month = purchase.createdAt.toLocaleString("default", {
                    month: "short",
                });
                const year = purchase.createdAt.getFullYear();
                const key = `${month} ${year}`;
                acc[key] = (acc[key] || 0) + (purchase.totalAmount || 0);
                return acc;
            }, {}),
            categoryWise: purchases.reduce((acc, purchase) => {
                purchase.purchaseItems.forEach((item) => {
                    const category = item.rawMaterial.rawMaterialCategory.name;
                    acc[category] = (acc[category] || 0) + (item.purchasePrice || 0);
                });
                return acc;
            }, {}),
            vendorWise: purchases.reduce((acc, purchase) => {
                const vendorName = purchase.vendor.name;
                acc[vendorName] = (acc[vendorName] || 0) + (purchase.totalAmount || 0);
                return acc;
            }, {}),
        };
        return {
            restaurant: {
                name: (outlet === null || outlet === void 0 ? void 0 : outlet.name) || "",
                address: (outlet === null || outlet === void 0 ? void 0 : outlet.address) || "",
                phone: (outlet === null || outlet === void 0 ? void 0 : outlet.phoneNo) || "",
                email: (outlet === null || outlet === void 0 ? void 0 : outlet.email) || "",
                website: "",
                logo: (outlet === null || outlet === void 0 ? void 0 : outlet.imageUrl) || "",
            },
            inventoryData: {
                stats: {
                    totalRawMaterials: rawMaterials.length,
                    totalCategories: categories,
                    totalPurchaseOrders: purchases.length,
                    totalVendors: vendors.length,
                    totalPurchaseAmount,
                    lowStockItems: stockStatus.low + stockStatus.outOfStock,
                },
                rawMaterialsByCategory,
                recentPurchases,
                stockStatus,
                vendorAnalysis,
                purchaseHistory,
            },
        };
    });
}
function generateExcel(data, reportType, outletName) {
    return __awaiter(this, void 0, void 0, function* () {
        const workbook = new exceljs_1.default.Workbook();
        switch (reportType) {
            case "DAYREPORT":
                formatDailyReportWorkbook(workbook, data);
                break;
            case "SALES":
                formatSalesWorkbook(workbook, data);
                break;
            case "INVENTORY":
                formatInventoryWorkbook(workbook, data);
                break;
            case "CASHREGISTER":
                formatCashRegisterWorkbook(workbook, data);
                break;
            // Add other report types...
        }
        const buffer = yield workbook.xlsx.writeBuffer();
        const nodeBuffer = Buffer.from(buffer);
        return uploadToS3(nodeBuffer, `${outletName}/reports/${reportType}_${Date.now()}.xlsx`);
    });
}
function uploadToS3(buffer, key) {
    return __awaiter(this, void 0, void 0, function* () {
        const putObjectCommand = new client_s3_1.PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: key.endsWith(".pdf")
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const signedUrl = yield (0, s3_request_presigner_1.getSignedUrl)(s3Client, putObjectCommand, {
            expiresIn: 60,
        });
        // Perform the PUT request to the signed URL
        yield axios_1.default.put(signedUrl, buffer, {
            headers: {
                "Content-Type": putObjectCommand.input.ContentType, // Use the ContentType from the input object
            },
        });
        return signedUrl.split("?")[0];
    });
}
const getReportsForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _m;
    const { outletId } = req.params;
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const dateRange = req.body.dateRange;
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    let dateFilter = {};
    // Apply the proper time range if dateRange is provided
    if (dateRange) {
        const startDateWithTime = new Date(dateRange.from);
        const endDateWithTime = new Date(dateRange.to);
        // Convert to IST and set appropriate times
        const istStartDate = setISTTime(startDateWithTime, 0, 0, 0, 0);
        const istEndDate = setISTTime(endDateWithTime, 23, 59, 59, 999);
        dateFilter = {
            createdAt: {
                gte: istStartDate,
                lte: istEndDate,
            },
        };
    }
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.report.count({
        where: Object.assign({ restaurantId: outletId, OR: [{ generatedBy: { contains: search, mode: "insensitive" } }], AND: filterConditions }, dateFilter),
    });
    const reports = yield __1.prismaDB.report.findMany({
        take,
        skip,
        where: Object.assign({ restaurantId: outletId, OR: [{ generatedBy: { contains: (_m = search) !== null && _m !== void 0 ? _m : "" } }], AND: filterConditions }, dateFilter),
        select: {
            id: true,
            reportType: true,
            format: true,
            status: true,
            dateRange: true,
            reportData: true,
            generatedBy: true,
            createdAt: true,
            fileUrl: true,
        },
        orderBy,
    });
    const data = {
        totalCount: totalCount,
        reports,
    };
    return res.json({
        success: true,
        reports: data,
        message: "Fetched ✅",
    });
});
exports.getReportsForTable = getReportsForTable;
// Helper Functions
function formatCurrencyForExcel(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
    }).format(value);
}
function styleWorksheet(worksheet) {
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.font = { name: "Arial", size: 10 };
            cell.alignment = { vertical: "middle", horizontal: "left" };
        });
    });
}
// Sales Report Formatting
function formatSalesWorkbook(workbook, data) {
    const worksheet = workbook.addWorksheet("Order Sales Report");
    // Title
    worksheet.mergeCells("A1:D1");
    worksheet.getCell("A1").value = "Order Sales Report";
    worksheet.getCell("A1").font = {
        size: 16,
        bold: true,
        color: { argb: "2563EB" },
    };
    worksheet.getCell("A1").alignment = { horizontal: "center" };
    // Restaurant Information
    worksheet.addRow([""]);
    worksheet.addRow(["Restaurant Information"]);
    worksheet.addRow(["Name", data.restaurant.name]);
    worksheet.addRow(["Address", data.restaurant.address]);
    worksheet.addRow(["Phone", data.restaurant.phone]);
    worksheet.addRow(["Email", data.restaurant.email]);
    // Summary
    worksheet.addRow([""]);
    worksheet.addRow(["Summary"]);
    worksheet.addRow([
        "Total Revenue",
        formatCurrencyForExcel(data.ordersData.totalRevenue),
    ]);
    worksheet.addRow(["Total Orders", data.ordersData.formattedOrders.length]);
    // Payment Methods
    worksheet.addRow([""]);
    worksheet.addRow(["Payment Methods"]);
    worksheet.addRow(["Method", "Amount"]);
    Object.entries(data.ordersData.paymentMethods).forEach(([method, amount]) => {
        worksheet.addRow([method, formatCurrencyForExcel(amount)]);
    });
    // Orders Table
    worksheet.addRow([""]);
    worksheet.addRow(["Order Details"]);
    worksheet.addRow([
        "Bill ID",
        "Order Type",
        "Status",
        "Method",
        "Amount",
        "Time",
        "Created By",
    ]);
    data.ordersData.formattedOrders.forEach((order) => {
        worksheet.addRow([
            order.billId,
            order.orderType,
            order.paidStatus,
            order.paymentMethod,
            formatCurrencyForExcel(order.totalAmount),
            (0, date_fns_1.format)(new Date(order.createdAt), "hh:mm a"),
            order.createdBy,
        ]);
    });
    applySalesStyles(worksheet);
}
/**
 * Helper function to format payment method for display
 * @param method Payment method code
 * @returns Human-readable payment method name
 */
function formatPaymentMethod(method) {
    switch (method) {
        case "CASH":
            return "Cash";
        case "UPI":
            return "UPI";
        case "CARD":
            return "Card";
        case "NOTPAID":
            return "Not Paid";
        default:
            return method;
    }
}
/**
 * Applies standard styles to a worksheet
 * @param worksheet The worksheet to style
 */
function applyDailyReportStyles(worksheet) {
    // Style header cells without merging (merging is done during creation)
    ["A1", "A3", "A12", "A21", "A31", "A39", "A47"].forEach((cellRef) => {
        const cell = worksheet.getCell(cellRef);
        cell.font = { bold: true, size: 12, color: { argb: "2563EB" } };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "DBEAFE" },
        };
        cell.border = {
            bottom: { style: "thin", color: { argb: "B9D9F7" } },
        };
    });
    // Style section headers
    [3, 12, 21, 31, 39, 47].forEach((row) => {
        worksheet.getRow(row).height = 20;
        worksheet.getRow(row).alignment = { vertical: "middle" };
    });
    // Style table headers
    [22, 32, 40, 48].forEach((row) => {
        const headerRow = worksheet.getRow(row);
        headerRow.font = { bold: true, size: 10 };
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "EFF6FF" },
        };
        headerRow.height = 18;
        headerRow.alignment = { vertical: "middle" };
    });
    // Add borders dynamically to table header rows based on content
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        // Apply styling to table header rows that contain column headers
        if ([22, 32, 40, 48, 61, 74].indexOf(rowNumber) !== -1) {
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                };
            });
        }
    });
    // Set column widths
    worksheet.columns.forEach((column, index) => {
        switch (index) {
            case 0: // Column A
                column.width = 15;
                break;
            case 1: // Column B
                column.width = 25;
                break;
            case 2: // Column C
            case 3: // Column D
                column.width = 15;
                break;
            default:
                column.width = 12;
        }
    });
}
/**
 * Formats a DailyReportResponse into an Excel workbook
 * @param workbook ExcelJS Workbook to add the worksheet to
 * @param data DailyReportResponse data to format
 */
function formatDailyReportWorkbook(workbook, data) {
    const worksheet = workbook.addWorksheet("Daily Operations Report");
    // Title
    worksheet.mergeCells("A1:G1");
    worksheet.getCell("A1").value = "Daily Operations Report";
    worksheet.getCell("A1").font = {
        size: 16,
        bold: true,
        color: { argb: "2563EB" },
    };
    worksheet.getCell("A1").alignment = { horizontal: "center" };
    // Restaurant Information
    worksheet.addRow([""]);
    worksheet.mergeCells("A3:G3");
    worksheet.getCell("A3").value = "Restaurant Information";
    worksheet.getCell("A3").font = { bold: true };
    worksheet.addRow(["Name", data.restaurant.name]);
    worksheet.addRow(["Address", data.restaurant.address]);
    worksheet.addRow(["Phone", data.restaurant.phoneNo || ""]); // Handle potential field name difference
    worksheet.addRow(["Email", data.restaurant.email]);
    worksheet.addRow([
        "Report Date Range",
        `${data.restaurant.dateRange.from} - ${data.restaurant.dateRange.to}`,
    ]);
    // Key Metrics
    worksheet.addRow([""]);
    worksheet.addRow([""]);
    worksheet.mergeCells("A12:G12");
    worksheet.getCell("A12").value = "Key Metrics";
    worksheet.getCell("A12").font = { bold: true };
    const totalRevenue = data.summary.orders.totalRevenue || 0;
    const totalExpenses = data.summary.expenses.reduce((acc, exp) => acc + exp.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    worksheet.addRow(["Total Revenue", formatCurrencyForExcel(totalRevenue)]);
    worksheet.addRow(["Total Expenses", formatCurrencyForExcel(totalExpenses)]);
    worksheet.addRow(["Net Profit", formatCurrencyForExcel(netProfit)]);
    const profitCell = worksheet.getCell("B15");
    profitCell.font = {
        color: { argb: netProfit >= 0 ? "10B981" : "EF4444" },
        bold: true,
    };
    // Orders Summary
    worksheet.addRow([""]);
    worksheet.addRow([""]);
    worksheet.mergeCells("A21:G21");
    worksheet.getCell("A21").value = "Order Summary";
    worksheet.getCell("A21").font = { bold: true };
    worksheet.addRow([
        "Category",
        "Total",
        "Completed",
        "In Progress",
        "Cancelled",
        "Total Revenue",
        "Unpaid Revenue",
        "Cancelled Revenue",
    ]);
    worksheet.addRow([
        "Orders",
        data.summary.orders.total || 0,
        data.summary.orders.completed || 0,
        data.summary.orders.onProgress || 0,
        data.summary.orders.cancelled || 0,
        formatCurrencyForExcel(data.summary.orders.totalRevenue || 0),
        formatCurrencyForExcel(data.summary.orders.unpaidRevenue || 0),
        formatCurrencyForExcel(data.summary.orders.cancelledRevenue || 0),
    ]);
    // Payment Breakdown
    worksheet.addRow([""]);
    worksheet.addRow([""]);
    const paymentRow = worksheet.rowCount;
    worksheet.mergeCells(`A${paymentRow}:G${paymentRow}`);
    worksheet.getCell(`A${paymentRow}`).value = "Payment Breakdown";
    worksheet.getCell(`A${paymentRow}`).font = { bold: true };
    worksheet.addRow(["Payment Method", "Amount", "Percentage"]);
    const paymentMethods = [
        "CASH",
        "UPI",
        "CARD",
        "NOTPAID",
    ];
    const paymentTotals = data.summary.orders.paymentTotals || {};
    const totalPayments = Object.values(paymentTotals).reduce((sum, val) => sum + (val || 0), 0);
    paymentMethods.forEach((method) => {
        const amount = paymentTotals[method] || 0;
        const percentage = totalPayments > 0
            ? ((amount / totalPayments) * 100).toFixed(2) + "%"
            : "0%";
        worksheet.addRow([
            formatPaymentMethod(method),
            formatCurrencyForExcel(amount),
            percentage,
        ]);
    });
    worksheet.addRow(["Total", formatCurrencyForExcel(totalPayments), "100%"]);
    const totalRow = worksheet.getRow(worksheet.rowCount);
    totalRow.font = { bold: true };
    // Cash Register
    worksheet.addRow([""]);
    worksheet.addRow([""]);
    const cashRow = worksheet.rowCount;
    worksheet.mergeCells(`A${cashRow}:G${cashRow}`);
    worksheet.getCell(`A${cashRow}`).value = "Cash Register";
    worksheet.getCell(`A${cashRow}`).font = { bold: true };
    worksheet.addRow(["Category", "Amount", ""]);
    if (data.summary.cashRegister) {
        worksheet.addRow([
            "Opening Cash",
            formatCurrencyForExcel(data.summary.cashRegister.openingCash),
            "",
        ]);
        worksheet.addRow([
            "Cash In",
            formatCurrencyForExcel(data.summary.cashRegister.cashIn),
            "",
        ]);
        worksheet.addRow([
            "Cash Out",
            formatCurrencyForExcel(data.summary.cashRegister.cashOut),
            "",
        ]);
        worksheet.addRow([
            "Closing Cash",
            formatCurrencyForExcel(data.summary.cashRegister.closingCash),
            "",
        ]);
        // Calculate balance
        const balance = Object.values(data.summary.cashRegister).reduce((sum, val) => sum + (val || 0), 0);
        worksheet.addRow(["Balance", formatCurrencyForExcel(balance), ""]);
        const balanceRow = worksheet.getRow(worksheet.rowCount);
        balanceRow.font = { bold: true };
    }
    else {
        worksheet.addRow(["No cash register data available", "", ""]);
    }
    // Top Items
    worksheet.addRow([""]);
    worksheet.addRow([""]);
    const topItemsRow = worksheet.rowCount;
    worksheet.mergeCells(`A${topItemsRow}:G${topItemsRow}`);
    worksheet.getCell(`A${topItemsRow}`).value = "Top Items Sold";
    worksheet.getCell(`A${topItemsRow}`).font = { bold: true };
    worksheet.addRow(["Item Name", "Quantity Sold", "Total Sales"]);
    if (data.summary.topItems && data.summary.topItems.length > 0) {
        data.summary.topItems.forEach((item) => {
            worksheet.addRow([
                item.itemName,
                item.quantitySold,
                formatCurrencyForExcel(item.totalSales),
            ]);
        });
    }
    else {
        worksheet.addRow(["No top items data available", "", ""]);
    }
    // Expenses
    worksheet.addRow([""]);
    worksheet.addRow([""]);
    const expenseRow = worksheet.rowCount;
    worksheet.mergeCells(`A${expenseRow}:G${expenseRow}`);
    worksheet.getCell(`A${expenseRow}`).value = "Expenses";
    worksheet.getCell(`A${expenseRow}`).font = { bold: true };
    worksheet.addRow(["Category", "Amount", ""]);
    if (data.summary.expenses && data.summary.expenses.length > 0) {
        data.summary.expenses.forEach((expense) => {
            worksheet.addRow([
                expense.category,
                formatCurrencyForExcel(expense.amount),
                "",
            ]);
        });
        // Total expenses
        worksheet.addRow(["Total", formatCurrencyForExcel(totalExpenses), ""]);
        const totalExpRow = worksheet.getRow(worksheet.rowCount);
        totalExpRow.font = { bold: true };
    }
    else {
        worksheet.addRow(["No expense data available", "", ""]);
    }
    // Staff Performance
    worksheet.addRow([""]);
    worksheet.addRow([""]);
    const staffRow = worksheet.rowCount;
    worksheet.mergeCells(`A${staffRow}:G${staffRow}`);
    worksheet.getCell(`A${staffRow}`).value = "Staff Performance";
    worksheet.getCell(`A${staffRow}`).font = { bold: true };
    worksheet.addRow(["Staff ID", "Orders Handled", "Revenue Generated"]);
    if (data.summary.staffPerformance &&
        data.summary.staffPerformance.length > 0) {
        data.summary.staffPerformance.forEach((staff) => {
            worksheet.addRow([
                staff.staffId,
                staff.ordersHandled,
                formatCurrencyForExcel(staff.revenueGenerated),
            ]);
        });
    }
    else {
        worksheet.addRow(["No staff performance data available", "", ""]);
    }
    // Apply styles
    applyDailyReportStyles(worksheet);
    return;
}
exports.formatDailyReportWorkbook = formatDailyReportWorkbook;
//cash register formatting
function formatCashRegisterWorkbook(workbook, data) {
    const worksheet = workbook.addWorksheet("Cash Register Report");
    // Title
    worksheet.mergeCells("A1:E1");
    worksheet.getCell("A1").value = "Cash Register Report";
    worksheet.getCell("A1").font = {
        size: 16,
        bold: true,
        color: { argb: "2563EB" },
    };
    worksheet.getCell("A1").alignment = { horizontal: "center" };
    // Restaurant Information
    worksheet.addRow([""]);
    worksheet.addRow(["Restaurant Information"]);
    worksheet.addRow(["Name", data.restaurant.name]);
    worksheet.addRow(["Address", data.restaurant.address]);
    worksheet.addRow(["Phone", data.restaurant.phone]);
    worksheet.addRow(["Email", data.restaurant.email]);
    worksheet.addRow([
        "Report Date Range",
        `${data.restaurant.dateRange.from} - ${data.restaurant.dateRange.to}`,
    ]);
    // Summary Section
    worksheet.addRow([""]);
    worksheet.addRow(["Summary"]);
    worksheet.addRow([
        "Total Opened Registers",
        data.summary.totalOpenedRegister,
    ]);
    worksheet.addRow([
        "Opening Balance",
        formatCurrencyForExcel(data.summary.openingBalance),
    ]);
    worksheet.addRow([
        "Total Cash In",
        formatCurrencyForExcel(data.summary.totalCashIn),
    ]);
    worksheet.addRow([
        "Total Cash Out",
        formatCurrencyForExcel(data.summary.totalCashOut),
    ]);
    worksheet.addRow([
        "Net Position",
        formatCurrencyForExcel(data.summary.netPosition),
    ]);
    worksheet.addRow([
        "Expected Closing Balance",
        formatCurrencyForExcel(data.summary.expectedClosingBalance),
    ]);
    worksheet.addRow([
        "Actual Closing Balance",
        formatCurrencyForExcel(data.summary.actualClosingBlance),
    ]);
    worksheet.addRow([
        "Discrepancy",
        formatCurrencyForExcel(data.summary.discrepancy),
    ]);
    // Payment Distribution
    worksheet.addRow([""]);
    worksheet.addRow(["Payment Distribution - CASH IN"]);
    worksheet.addRow([
        "Cash",
        formatCurrencyForExcel(data.summary.paymentDistribution.cashIn.cash),
    ]);
    worksheet.addRow([
        "UPI",
        formatCurrencyForExcel(data.summary.paymentDistribution.cashIn.upi),
    ]);
    worksheet.addRow([
        "Card",
        formatCurrencyForExcel(data.summary.paymentDistribution.cashIn.card),
    ]);
    worksheet.addRow([
        "Total",
        formatCurrencyForExcel(data.summary.paymentDistribution.cashIn.total),
    ]);
    worksheet.addRow([""]);
    worksheet.addRow(["Payment Distribution - CASH OUT"]);
    worksheet.addRow([
        "Cash",
        formatCurrencyForExcel(data.summary.paymentDistribution.cashOut.cash),
    ]);
    worksheet.addRow([
        "UPI",
        formatCurrencyForExcel(data.summary.paymentDistribution.cashOut.upi),
    ]);
    worksheet.addRow([
        "Card",
        formatCurrencyForExcel(data.summary.paymentDistribution.cashOut.card),
    ]);
    worksheet.addRow([
        "Total",
        formatCurrencyForExcel(data.summary.paymentDistribution.cashOut.total),
    ]);
    // Transactions Table
    worksheet.addRow([""]);
    worksheet.addRow(["Transactions"]);
    worksheet.addRow([
        "Date",
        "Description",
        "Transaction Type",
        "Amount",
        "Source",
        "Payment Method",
        "Performed By",
    ]);
    data.summary.formattedTransactions.forEach((tx) => {
        worksheet.addRow([
            (0, date_fns_1.format)(new Date(tx.date), "dd MMM yyyy, hh:mm a"),
            tx.description,
            tx.transactionType,
            formatCurrencyForExcel(tx.amount),
            tx.source,
            tx.paymentMethod,
            tx.performedBy,
        ]);
    });
    applySalesStyles(worksheet);
}
function formatInventoryWorkbook(workbook, data) {
    console.log(data);
    const worksheet = workbook.addWorksheet("Inventory Report");
    // Title
    worksheet.mergeCells("A1:D1");
    worksheet.getCell("A1").value = "Inventory Report";
    worksheet.getCell("A1").font = {
        size: 16,
        bold: true,
        color: { argb: "2563EB" },
    };
    worksheet.getCell("A1").alignment = { horizontal: "center" };
    // Key Stats
    worksheet.addRow([""]);
    worksheet.addRow(["Key Metrics", "Value"]);
    worksheet.addRow([
        "Total Raw Materials",
        data.inventoryData.stats.totalRawMaterials,
    ]);
    worksheet.addRow([
        "Total Categories",
        data.inventoryData.stats.totalCategories,
    ]);
    worksheet.addRow([
        "Total Purchase Orders",
        data.inventoryData.stats.totalPurchaseOrders,
    ]);
    worksheet.addRow(["Total Vendors", data.inventoryData.stats.totalVendors]);
    worksheet.addRow([
        "Total Purchase Amount",
        formatCurrencyForExcel(data.inventoryData.stats.totalPurchaseAmount),
    ]);
    worksheet.addRow(["Low Stock Items", data.inventoryData.stats.lowStockItems]);
    // Raw Materials by Category
    worksheet.addRow([""]);
    worksheet.addRow(["Raw Materials by Category"]);
    worksheet.addRow(["Category", "Count", "Total Value"]);
    Object.entries(data.inventoryData.rawMaterialsByCategory).forEach(([category, info]) => {
        worksheet.addRow([
            category,
            info.count,
            formatCurrencyForExcel(info.totalValue),
        ]);
    });
    // Recent Purchases
    worksheet.addRow([""]);
    worksheet.addRow(["Recent Purchases"]);
    worksheet.addRow([
        "Invoice No",
        "Vendor",
        "Date",
        "Amount",
        "Status",
        "Items",
    ]);
    data.inventoryData.recentPurchases.forEach((purchase) => {
        worksheet.addRow([
            purchase.invoiceNo,
            purchase.vendorName,
            purchase.date,
            formatCurrencyForExcel(purchase.amount),
            purchase.status,
            purchase.items,
        ]);
    });
    // Stock Status
    worksheet.addRow([""]);
    worksheet.addRow(["Stock Status"]);
    worksheet.addRow(["Status", "Count"]);
    Object.entries(data.inventoryData.stockStatus).forEach(([status, count]) => {
        worksheet.addRow([status, count]);
    });
    // Vendor Analysis
    worksheet.addRow([""]);
    worksheet.addRow(["Vendor Analysis"]);
    worksheet.addRow([
        "Vendor",
        "Total Purchases",
        "Total Amount",
        "Last Purchase Date",
    ]);
    data.inventoryData.vendorAnalysis.forEach((vendor) => {
        worksheet.addRow([
            vendor.name,
            vendor.totalPurchases,
            formatCurrencyForExcel(vendor.totalAmount),
            vendor.lastPurchaseDate,
        ]);
    });
    applyInventoryStyles(worksheet);
}
// Simplified styling functions
function applySalesStyles(worksheet) {
    worksheet.getColumn(1).width = 25;
    worksheet.getColumn(2).width = 20;
    worksheet.getColumn(3).width = 20;
    applyCommonStyles(worksheet);
}
function applyInventoryStyles(worksheet) {
    worksheet.getColumn(1).width = 25;
    worksheet.getColumn(2).width = 20;
    worksheet.getColumn(3).width = 20;
    worksheet.getColumn(4).width = 20;
    applyCommonStyles(worksheet);
}
function applyCommonStyles(worksheet) {
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.font = { name: "Arial", size: 10 };
            cell.alignment = { vertical: "middle", horizontal: "left" };
        });
        // Style section headers
        if (row.getCell(1).value &&
            typeof row.getCell(1).value === "string" &&
            !row.getCell(2).value) {
            row.getCell(1).font = { bold: true, size: 12, color: { argb: "2563EB" } };
        }
    });
}
