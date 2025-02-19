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
exports.getTransactionHistoryForRegister = exports.recordIncome = exports.getAdminRegisterStatus = exports.getTransactionHistory = exports.getCashRegisterById = exports.getAllCashRegisters = void 0;
const __1 = require("../../..");
const outlet_1 = require("../../../lib/outlet");
const date_fns_1 = require("date-fns");
const redis_1 = require("../../../services/redis");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const zod_1 = require("zod");
const bad_request_1 = require("../../../exceptions/bad-request");
const getAllCashRegisters = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!getOutlet) {
        return res.status(404).json({ message: "Outlet not found" });
    }
    const cashRegisters = yield __1.prismaDB.cashRegister.findMany({
        where: {
            restaurantId: outletId,
        },
        include: {
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
                },
            },
            transactions: {
                select: {
                    type: true,
                    amount: true,
                    paymentMethod: true,
                    source: true,
                    createdAt: true,
                },
            },
            denominations: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    // Calculate balances and format response
    const formattedRegisters = cashRegisters.map((register) => {
        // Calculate current balance and payment method totals
        const paymentTotals = register.transactions.reduce((acc, t) => {
            if (!acc[t.paymentMethod]) {
                acc[t.paymentMethod] = { in: 0, out: 0 };
            }
            if (t.type === "CASH_IN") {
                acc[t.paymentMethod].in += t.amount;
            }
            else {
                acc[t.paymentMethod].out += t.amount;
            }
            return acc;
        }, {});
        const currentBalance = register.transactions.reduce((sum, t) => {
            return t.type === "CASH_IN" ? sum + t.amount : sum - t.amount;
        }, 0);
        // Get today's transactions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTransactions = register.transactions.filter((t) => new Date(t.createdAt) >= today);
        return {
            id: register.id,
            openedBy: register.staff || register.user,
            openingBalance: register.openingBalance,
            openingCashBalance: register.openingCashBalance,
            openingUPIBalance: register.openingUPIBalance,
            openingCardBalance: register.openingCardBalance,
            currentBalance,
            closingBalance: register.closingBalance,
            actualBalance: register.actualBalance,
            expectedBalance: currentBalance,
            status: register.status,
            openedAt: register.openedAt,
            closedAt: register.closedAt,
            transactions: register.transactions.length,
            todayTransactions: todayTransactions.length,
            paymentTotals,
            denominations: register.denominations,
            discrepancy: register.status === "CLOSED"
                ? register.actualBalance - currentBalance
                : null,
        };
    });
    return res.json({
        success: true,
        data: formattedRegisters,
    });
});
exports.getAllCashRegisters = getAllCashRegisters;
const getCashRegisterById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { registerId } = req.params;
    const register = yield __1.prismaDB.cashRegister.findUnique({
        where: { id: registerId },
    });
});
exports.getCashRegisterById = getCashRegisterById;
const getTransactionHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!getOutlet) {
        return res.status(404).json({ message: "Outlet not found" });
    }
    const { page = 1, limit = 10, period, paymentMethod, type, source, search, } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;
    const outletStartDateTime = new Date(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.createdAt);
    // Calculate date range based on period
    let startDate = new Date();
    let endDate = (0, date_fns_1.endOfToday)();
    switch (period) {
        case "today":
            startDate = (0, date_fns_1.startOfToday)();
            break;
        case "yesterday":
            startDate = (0, date_fns_1.startOfYesterday)();
            endDate = (0, date_fns_1.startOfToday)();
            break;
        case "week":
            startDate = (0, date_fns_1.startOfWeek)(new Date());
            break;
        case "month":
            startDate = (0, date_fns_1.startOfMonth)(new Date());
            break;
        default:
            startDate = outletStartDateTime;
    }
    // Build filter conditions
    const where = Object.assign(Object.assign(Object.assign(Object.assign({ register: {
            restaurantId: outletId,
        }, createdAt: {
            gte: startDate,
            lte: endDate,
        } }, (type ? { type: type } : {})), (paymentMethod ? { paymentMethod: paymentMethod } : {})), (source ? { source: source } : {})), (search
        ? {
            OR: [
                {
                    description: { contains: search },
                },
                {
                    referenceId: { contains: search },
                },
            ],
        }
        : {}));
    // Get total count for pagination
    const total = yield __1.prismaDB.cashTransaction.count({ where });
    // Fetch transactions with pagination
    const transactions = yield __1.prismaDB.cashTransaction.findMany({
        where,
        include: {
            register: {
                select: {
                    openingBalance: true,
                    closingBalance: true,
                    status: true,
                },
            },
            order: {
                select: {
                    billId: true,
                    subTotal: true,
                },
            },
            expense: {
                select: {
                    category: true,
                    description: true,
                },
            },
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
        orderBy: {
            createdAt: "desc",
        },
        skip,
        take: pageSize,
    });
    // Calculate summary statistics
    const summary = yield __1.prismaDB.cashTransaction.groupBy({
        by: ["type", "paymentMethod"],
        where: Object.assign({ register: { restaurantId: outletId } }, (startDate && endDate
            ? {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            }
            : {})),
        _sum: {
            amount: true,
        },
    });
    // Process summary data
    const summaryData = summary.reduce((acc, curr) => {
        if (curr.type === "CASH_IN") {
            acc.totalIncome += curr._sum.amount || 0;
            acc.paymentMethodIncome[curr.paymentMethod] =
                (acc.paymentMethodIncome[curr.paymentMethod] || 0) +
                    (curr._sum.amount || 0);
        }
        else {
            acc.totalExpense += curr._sum.amount || 0;
            acc.paymentMethodExpense[curr.paymentMethod] =
                (acc.paymentMethodExpense[curr.paymentMethod] || 0) +
                    (curr._sum.amount || 0);
        }
        return acc;
    }, {
        totalIncome: 0,
        totalExpense: 0,
        paymentMethodIncome: {},
        paymentMethodExpense: {},
    });
    // Format transactions for response
    const formattedTransactions = transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        source: transaction.source,
        amount: transaction.amount,
        description: transaction.description,
        paymentMethod: transaction.paymentMethod,
        referenceId: transaction.referenceId,
        performedBy: transaction.staff || transaction.user,
        orderDetails: transaction.orderId,
        expenseDetails: transaction.expenseId,
        registerDetails: transaction.registerId,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
    }));
    // Return paginated response
    res.json({
        data: formattedTransactions,
        pagination: {
            total,
            page: pageNumber,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
            hasMore: pageNumber * pageSize < total,
        },
        summary: Object.assign(Object.assign({}, summaryData), { netAmount: summaryData.totalIncome - summaryData.totalExpense }),
    });
});
exports.getTransactionHistory = getTransactionHistory;
const getAdminRegisterStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    // @ts-ignore
    const { id: userId } = req.user;
    const register = yield __1.prismaDB.cashRegister.findFirst({
        where: {
            restaurantId: outletId,
            openedBy: userId,
            status: "OPEN",
        },
        include: {
            transactions: {
                orderBy: {
                    createdAt: "desc",
                },
            },
            denominations: true,
        },
    });
    // Get restaurant details
    const restaurant = yield __1.prismaDB.restaurant.findFirst({
        where: {
            id: outletId,
        },
    });
    if (!restaurant) {
        throw new not_found_1.NotFoundException("Restaurant not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Calculate current balance for each payment method
    const calculateBalanceByMethod = (transactions, method) => {
        return transactions
            .filter((t) => t.paymentMethod === method)
            .reduce((balance, tx) => {
            return tx.type === "CASH_IN"
                ? balance + tx.amount
                : balance - tx.amount;
        }, 0);
    };
    // Calculate total balance
    const calculateTotalBalance = (transactions) => {
        return transactions.reduce((balance, tx) => {
            return tx.type === "CASH_IN" ? balance + tx.amount : balance - tx.amount;
        }, 0);
    };
    // Get all active registers for this restaurant
    const activeRegisters = yield __1.prismaDB.cashRegister.findMany({
        where: {
            restaurantId: outletId,
            status: "OPEN",
        },
        include: {
            staff: true,
            user: true,
        },
    });
    const registerStatus = {
        registerId: (register === null || register === void 0 ? void 0 : register.id) || null,
        hasActiveRegister: !!register,
        isRestaurantRegisterOpen: activeRegisters.length > 0,
        activeOperators: activeRegisters.map((reg) => {
            var _a, _b;
            return ({
                name: ((_a = reg.staff) === null || _a === void 0 ? void 0 : _a.name) || ((_b = reg.user) === null || _b === void 0 ? void 0 : _b.name) || "Unknown",
                type: reg.staff ? "Staff" : "Admin",
                registerId: reg.id,
                openedAt: reg.openedAt,
            });
        }),
        lastTransactions: (register === null || register === void 0 ? void 0 : register.transactions) || [],
        sessionStarted: (register === null || register === void 0 ? void 0 : register.openedAt) || null,
        balances: {
            opening: {
                total: (register === null || register === void 0 ? void 0 : register.openingBalance) || 0,
                cash: (register === null || register === void 0 ? void 0 : register.openingCashBalance) || 0,
                upi: (register === null || register === void 0 ? void 0 : register.openingUPIBalance) || 0,
                card: (register === null || register === void 0 ? void 0 : register.openingCardBalance) || 0,
            },
            current: {
                total: register ? calculateTotalBalance(register.transactions) : 0,
                cash: register
                    ? calculateBalanceByMethod(register.transactions, "CASH")
                    : 0,
                upi: register
                    ? calculateBalanceByMethod(register.transactions, "UPI")
                    : 0,
                card: register
                    ? calculateBalanceByMethod(register.transactions, "DEBIT") +
                        calculateBalanceByMethod(register.transactions, "CREDIT")
                    : 0,
            },
        },
        denominations: (register === null || register === void 0 ? void 0 : register.denominations) || null,
    };
    const formatToSend = {
        registerId: register === null || register === void 0 ? void 0 : register.id,
        registerStatus,
    };
    // Cache the register status
    yield redis_1.redis.set(`admin-register-${userId}-${outletId}`, JSON.stringify(formatToSend), "EX", 300 // Cache for 5 minutes
    );
    return res.json({
        success: true,
        data: formatToSend,
    });
});
exports.getAdminRegisterStatus = getAdminRegisterStatus;
const incomeSchema = zod_1.z.object({
    registerId: zod_1.z
        .string({
        required_error: "Register ID is required",
    })
        .min(1),
    amount: zod_1.z.coerce
        .number({
        required_error: "Amount is required",
    })
        .min(1),
    paymentMethod: zod_1.z.enum(["CASH", "UPI", "CARD", "CREDIT"], {
        required_error: "Payment method is required",
    }),
    source: zod_1.z.enum(["ORDER", "MANUAL", "SETTLEMENT"], {
        required_error: "Source is required",
    }),
    description: zod_1.z.string().min(1),
});
const recordIncome = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    // @ts-ignore
    const { id: userId } = req.user;
    const { data: validateFields, error } = incomeSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.NOT_FOUND);
    }
    const register = yield __1.prismaDB.cashRegister.findFirst({
        where: {
            id: validateFields.registerId,
            restaurantId: outletId,
            status: "OPEN",
        },
    });
    if (!register) {
        throw new not_found_1.NotFoundException("Register not found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.cashTransaction.create({
        data: {
            registerId: register.id,
            amount: validateFields.amount,
            type: "CASH_IN",
            paymentMethod: validateFields.paymentMethod,
            source: validateFields.source,
            description: validateFields.description,
            performedBy: userId,
        },
    });
    return res.json({
        success: true,
        message: "Income recorded successfully",
    });
});
exports.recordIncome = recordIncome;
const getTransactionHistoryForRegister = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!getOutlet) {
        return res.status(404).json({ message: "Outlet not found" });
    }
    const { page = 1, limit = 10, paymentMethod, type, source, search, registerId, } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;
    // Build filter conditions
    const where = Object.assign(Object.assign(Object.assign(Object.assign({ register: {
            id: registerId,
            restaurantId: outletId,
        } }, (type ? { type: type } : {})), (paymentMethod ? { paymentMethod: paymentMethod } : {})), (source ? { source: source } : {})), (search
        ? {
            OR: [
                {
                    description: { contains: search },
                },
                {
                    referenceId: { contains: search },
                },
            ],
        }
        : {}));
    // Get total count for pagination
    const total = yield __1.prismaDB.cashTransaction.count({ where });
    // Fetch transactions with pagination
    const transactions = yield __1.prismaDB.cashTransaction.findMany({
        where,
        include: {
            register: {
                select: {
                    openingBalance: true,
                    closingBalance: true,
                    status: true,
                },
            },
            order: {
                select: {
                    billId: true,
                    subTotal: true,
                },
            },
            expense: {
                select: {
                    category: true,
                    description: true,
                },
            },
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
        orderBy: {
            createdAt: "desc",
        },
        skip,
        take: pageSize,
    });
    // Calculate summary statistics
    const summary = yield __1.prismaDB.cashTransaction.groupBy({
        by: ["type", "paymentMethod"],
        where: {
            register: { id: registerId, restaurantId: outletId },
        },
        _sum: {
            amount: true,
        },
    });
    // Process summary data
    const summaryData = summary.reduce((acc, curr) => {
        if (curr.type === "CASH_IN") {
            acc.totalIncome += curr._sum.amount || 0;
            acc.paymentMethodIncome[curr.paymentMethod] =
                (acc.paymentMethodIncome[curr.paymentMethod] || 0) +
                    (curr._sum.amount || 0);
        }
        else {
            acc.totalExpense += curr._sum.amount || 0;
            acc.paymentMethodExpense[curr.paymentMethod] =
                (acc.paymentMethodExpense[curr.paymentMethod] || 0) +
                    (curr._sum.amount || 0);
        }
        return acc;
    }, {
        totalIncome: 0,
        totalExpense: 0,
        paymentMethodIncome: {},
        paymentMethodExpense: {},
    });
    // Format transactions for response
    const formattedTransactions = transactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        source: transaction.source,
        amount: transaction.amount,
        description: transaction.description,
        paymentMethod: transaction.paymentMethod,
        referenceId: transaction.referenceId,
        performedBy: transaction.staff || transaction.user,
        orderDetails: transaction.orderId,
        expenseDetails: transaction.expenseId,
        registerDetails: transaction.registerId,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
    }));
    // Return paginated response
    res.json({
        data: formattedTransactions,
        pagination: {
            total,
            page: pageNumber,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
            hasMore: pageNumber * pageSize < total,
        },
        summary: Object.assign(Object.assign({}, summaryData), { netAmount: summaryData.totalIncome - summaryData.totalExpense }),
    });
});
exports.getTransactionHistoryForRegister = getTransactionHistoryForRegister;
