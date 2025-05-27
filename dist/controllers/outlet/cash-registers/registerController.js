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
const luxon_1 = require("luxon");
const utils_1 = require("../../../lib/utils");
const getAllCashRegisters = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { date } = req.query;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!getOutlet) {
        return res.status(404).json({ message: "Outlet not found" });
    }
    const timeZone = "Asia/Kolkata"; // Default to a specific time zone
    // Parse the date parameter if provided
    let startDate;
    let endDate;
    if (date && typeof date === "string") {
        try {
            // Parse the date string to a Date object
            const parsedDate = (0, date_fns_1.parseISO)(date);
            // Use DateTime from luxon to handle timezone properly
            const dateInIST = luxon_1.DateTime.fromJSDate(parsedDate).setZone(timeZone);
            // Set the start and end of the day in IST
            const startDateTime = dateInIST.startOf("day").toUTC().toJSDate();
            const endDateTime = dateInIST.endOf("day").toUTC().toJSDate();
            startDate = startDateTime;
            endDate = endDateTime;
        }
        catch (error) {
            return res
                .status(400)
                .json({ message: "Invalid date format. Use YYYY-MM-DD" });
        }
    }
    // Build the where clause for the query
    const whereClause = {
        restaurantId: outletId,
    };
    // Add date filtering if date parameter is provided
    if (startDate && endDate) {
        whereClause.createdAt = {
            gte: startDate,
            lte: endDate,
        };
    }
    const cashRegisters = yield __1.prismaDB.cashRegister.findMany({
        where: whereClause,
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
        var _a, _b, _c, _d;
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
            cashTransactions: (_a = register === null || register === void 0 ? void 0 : register.transactions) === null || _a === void 0 ? void 0 : _a.filter((t) => t.paymentMethod === "CASH").length,
            upiTransactions: (_b = register === null || register === void 0 ? void 0 : register.transactions) === null || _b === void 0 ? void 0 : _b.filter((t) => t.paymentMethod === "UPI").length,
            cardTransactions: (_c = register === null || register === void 0 ? void 0 : register.transactions) === null || _c === void 0 ? void 0 : _c.filter((t) => t.paymentMethod === "DEBIT").length,
            creditTransactions: (_d = register === null || register === void 0 ? void 0 : register.transactions) === null || _d === void 0 ? void 0 : _d.filter((t) => t.paymentMethod === "CREDIT").length,
            todayTransactions: todayTransactions.length,
            paymentTotals,
            denominations: register.denominations,
            discrepancy: register.status === "CLOSED" || register.status === "FORCE_CLOSED"
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
    const { page = 1, limit = 10, period, paymentMethod, type, source, search, startDate, endDate, } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;
    const outletStartDateTime = new Date(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.createdAt);
    const timeZone = "Asia/Kolkata"; // Default to a specific time zone
    // Calculate date range based on period or provided dates
    let startDateObj = new Date();
    let endDateObj = (0, date_fns_1.endOfToday)();
    // If startDate and endDate are provided, use them
    if (startDate &&
        endDate &&
        typeof startDate === "string" &&
        typeof endDate === "string") {
        try {
            // Parse the date strings to Date objects
            const parsedStartDate = (0, date_fns_1.parseISO)(startDate);
            const parsedEndDate = (0, date_fns_1.parseISO)(endDate);
            // Use DateTime from luxon to handle timezone properly
            const startDateInIST = luxon_1.DateTime.fromJSDate(parsedStartDate).setZone(timeZone);
            const endDateInIST = luxon_1.DateTime.fromJSDate(parsedEndDate).setZone(timeZone);
            // Set the start and end of the day in IST
            startDateObj = startDateInIST.startOf("day").toUTC().toJSDate();
            endDateObj = endDateInIST.endOf("day").toUTC().toJSDate();
        }
        catch (error) {
            return res
                .status(400)
                .json({ message: "Invalid date format. Use YYYY-MM-DD" });
        }
    }
    else {
        // Use period-based date calculation if no specific dates provided
        switch (period) {
            case "today":
                startDateObj = (0, date_fns_1.startOfToday)();
                break;
            case "yesterday":
                startDateObj = (0, date_fns_1.startOfYesterday)();
                endDateObj = (0, date_fns_1.startOfToday)();
                break;
            case "week":
                startDateObj = (0, date_fns_1.startOfWeek)(new Date());
                break;
            case "month":
                startDateObj = (0, date_fns_1.startOfMonth)(new Date());
                break;
            default:
                startDateObj = outletStartDateTime;
        }
    }
    // Build filter conditions
    const where = Object.assign(Object.assign(Object.assign(Object.assign({ register: {
            restaurantId: outletId,
        }, createdAt: {
            gte: startDateObj,
            lte: endDateObj,
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
        where: Object.assign({ register: { restaurantId: outletId } }, (startDateObj && endDateObj
            ? {
                createdAt: {
                    gte: startDateObj,
                    lte: endDateObj,
                },
            }
            : {})),
        _sum: {
            amount: true,
        },
    });
    // Process summary data
    const summaryData = summary.reduce((acc, curr) => {
        var _a, _b, _c, _d;
        if (curr.type === "CASH_IN") {
            acc.totalIncome += ((_a = curr._sum) === null || _a === void 0 ? void 0 : _a.amount) || 0;
            acc.paymentMethodIncome[curr.paymentMethod] =
                (acc.paymentMethodIncome[curr.paymentMethod] || 0) +
                    (((_b = curr._sum) === null || _b === void 0 ? void 0 : _b.amount) || 0);
        }
        else {
            acc.totalExpense += ((_c = curr._sum) === null || _c === void 0 ? void 0 : _c.amount) || 0;
            acc.paymentMethodExpense[curr.paymentMethod] =
                (acc.paymentMethodExpense[curr.paymentMethod] || 0) +
                    (((_d = curr._sum) === null || _d === void 0 ? void 0 : _d.amount) || 0);
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
            transactions: {
                orderBy: {
                    createdAt: "desc",
                },
            },
            denominations: true,
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
                balances: {
                    opening: {
                        total: (reg === null || reg === void 0 ? void 0 : reg.openingBalance) || 0,
                        cash: (reg === null || reg === void 0 ? void 0 : reg.openingCashBalance) || 0,
                        upi: (reg === null || reg === void 0 ? void 0 : reg.openingUPIBalance) || 0,
                        card: (reg === null || reg === void 0 ? void 0 : reg.openingCardBalance) || 0,
                    },
                    current: {
                        total: reg ? calculateTotalBalance(reg.transactions) : 0,
                        cash: reg ? calculateBalanceByMethod(reg.transactions, "CASH") : 0,
                        upi: reg ? calculateBalanceByMethod(reg.transactions, "UPI") : 0,
                        card: reg
                            ? calculateBalanceByMethod(reg.transactions, "DEBIT") +
                                calculateBalanceByMethod(reg.transactions, "CREDIT")
                            : 0,
                    },
                },
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
        cashIn: activeRegisters.reduce((sum, reg) => sum +
            (0, utils_1.calculateInOut)(reg.transactions.filter((tx) => tx.type === "CASH_IN")), 0),
        cashOut: activeRegisters.reduce((sum, reg) => sum +
            (0, utils_1.calculateInOut)(reg.transactions.filter((tx) => tx.type === "CASH_OUT")), 0),
        netPosition: activeRegisters.reduce((sum, reg) => sum +
            (0, utils_1.calculateInOut)(reg.transactions.filter((tx) => tx.type === "CASH_IN")), 0) -
            activeRegisters.reduce((sum, reg) => sum +
                (0, utils_1.calculateInOut)(reg.transactions.filter((tx) => tx.type === "CASH_OUT")), 0),
        cashFlow: {
            cash: activeRegisters.reduce((sum, reg) => sum + calculateBalanceByMethod(reg.transactions, "CASH"), 0),
            upi: activeRegisters.reduce((sum, reg) => sum + calculateBalanceByMethod(reg.transactions, "UPI"), 0),
            card: activeRegisters.reduce((sum, reg) => sum +
                calculateBalanceByMethod(reg.transactions, "DEBIT") +
                calculateBalanceByMethod(reg.transactions, "CREDIT"), 0),
        },
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
    const { page = 1, limit = 10, paymentMethod, type, source, search, registerId, startDate, endDate, } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;
    const timeZone = "Asia/Kolkata"; // Default to a specific time zone
    // Parse the date parameters if provided
    let startDateObj;
    let endDateObj;
    if (startDate &&
        endDate &&
        typeof startDate === "string" &&
        typeof endDate === "string") {
        try {
            // Parse the date strings to Date objects
            const parsedStartDate = (0, date_fns_1.parseISO)(startDate);
            const parsedEndDate = (0, date_fns_1.parseISO)(endDate);
            // Use DateTime from luxon to handle timezone properly
            const startDateInIST = luxon_1.DateTime.fromJSDate(parsedStartDate).setZone(timeZone);
            const endDateInIST = luxon_1.DateTime.fromJSDate(parsedEndDate).setZone(timeZone);
            // Set the start and end of the day in IST
            startDateObj = startDateInIST.startOf("day").toUTC().toJSDate();
            endDateObj = endDateInIST.endOf("day").toUTC().toJSDate();
        }
        catch (error) {
            return res
                .status(400)
                .json({ message: "Invalid date format. Use YYYY-MM-DD" });
        }
    }
    // Build filter conditions
    const where = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ register: {
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
        : {})), (startDateObj && endDateObj
        ? {
            createdAt: {
                gte: startDateObj,
                lte: endDateObj,
            },
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
        where: Object.assign({ register: { id: registerId, restaurantId: outletId } }, (startDateObj && endDateObj
            ? {
                createdAt: {
                    gte: startDateObj,
                    lte: endDateObj,
                },
            }
            : {})),
        _sum: {
            amount: true,
        },
    });
    // Process summary data
    const summaryData = summary.reduce((acc, curr) => {
        var _a, _b, _c, _d;
        if (curr.type === "CASH_IN") {
            acc.totalIncome += ((_a = curr._sum) === null || _a === void 0 ? void 0 : _a.amount) || 0;
            acc.paymentMethodIncome[curr.paymentMethod] =
                (acc.paymentMethodIncome[curr.paymentMethod] || 0) +
                    (((_b = curr._sum) === null || _b === void 0 ? void 0 : _b.amount) || 0);
        }
        else {
            acc.totalExpense += ((_c = curr._sum) === null || _c === void 0 ? void 0 : _c.amount) || 0;
            acc.paymentMethodExpense[curr.paymentMethod] =
                (acc.paymentMethodExpense[curr.paymentMethod] || 0) +
                    (((_d = curr._sum) === null || _d === void 0 ? void 0 : _d.amount) || 0);
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
