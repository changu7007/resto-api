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
exports.cashFlowStats = exports.lastSixMonthsOrders = exports.outletTopSellingItems = exports.orderStatsForOutletByStaff = exports.orderStatsForOutlet = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const utils_1 = require("../../../lib/utils");
const get_users_1 = require("../../../lib/get-users");
const date_fns_1 = require("date-fns");
const orderStatsForOutlet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { outletId } = req.params;
    const { period } = req.query;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const { startDate, endDate } = (0, utils_1.getPeriodDates)(period);
    const orders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outlet.id,
            createdAt: {
                gte: startDate,
                lte: endDate,
            },
        },
        select: {
            isPaid: true,
            orderStatus: true,
            totalAmount: true,
            orderType: true,
            orderItems: {
                select: {
                    menuItem: {
                        select: {
                            price: true,
                            isVariants: true,
                            grossProfit: true,
                            menuItemVariants: {
                                select: {
                                    grossProfit: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    // Initialize totals for all types and the "All" category
    const totals = {
        all: { revenue: 0, orders: 0, grossProfit: 0 },
        express: { revenue: 0, orders: 0, grossProfit: 0 },
        dineIn: { revenue: 0, orders: 0, grossProfit: 0 },
        delivery: { revenue: 0, orders: 0, grossProfit: 0 },
        takeaway: { revenue: 0, orders: 0, grossProfit: 0 },
    };
    // Calculate revenue, orders, and gross profit
    (_a = orders
        .filter((o) => o.isPaid === true)) === null || _a === void 0 ? void 0 : _a.forEach((order) => {
        const amount = parseFloat(order.totalAmount);
        // Calculate gross profit for this order
        let orderGrossProfit = 0;
        order.orderItems.forEach((item) => {
            if (item.menuItem.isVariants) {
                // Use gross profit from menuItemVariants if available
                orderGrossProfit += item.menuItem.menuItemVariants.reduce((acc, variant) => acc + (variant.grossProfit || 0), 0);
            }
            else {
                // Use gross profit from menuItem directly
                orderGrossProfit += item.menuItem.grossProfit || 0;
            }
        });
        // Sum for all orders
        totals.all.revenue += amount;
        totals.all.orders++;
        totals.all.grossProfit += orderGrossProfit;
        // Sum for each orderType
        switch (order.orderType) {
            case "EXPRESS":
                totals.express.revenue += amount;
                totals.express.orders++;
                totals.express.grossProfit += orderGrossProfit;
                break;
            case "DINEIN":
                totals.dineIn.revenue += amount;
                totals.dineIn.orders++;
                totals.dineIn.grossProfit += orderGrossProfit;
                break;
            case "DELIVERY":
                totals.delivery.revenue += amount;
                totals.delivery.orders++;
                totals.delivery.grossProfit += orderGrossProfit;
                break;
            case "TAKEAWAY":
                totals.takeaway.revenue += amount;
                totals.takeaway.orders++;
                totals.takeaway.grossProfit += orderGrossProfit;
                break;
        }
    });
    // Format the stats (this is just an example, you can adjust the format)
    const expressFormattedStats = {
        totalRevenue: totals.all.revenue,
        totalOrders: totals.all.orders,
        grossProfit: totals.all.grossProfit,
        stats: [
            {
                type: "EXPRESS",
                revenue: totals.express.revenue,
                orders: totals.express.orders,
                grossProfit: totals.express.grossProfit,
            },
            {
                type: "DELIVERY",
                revenue: totals.delivery.revenue,
                orders: totals.delivery.orders,
                grossProfit: totals.delivery.grossProfit,
            },
            {
                type: "TAKEAWAY",
                revenue: totals.takeaway.revenue,
                orders: totals.takeaway.orders,
                grossProfit: totals.takeaway.grossProfit,
            },
        ],
    };
    const formattedStats = {
        totalRevenue: totals.all.revenue,
        totalOrders: totals.all.orders,
        grossProfit: totals.all.grossProfit,
        stats: [
            {
                type: "DINEIN",
                revenue: totals.dineIn.revenue,
                orders: totals.dineIn.orders,
                grossProfit: totals.dineIn.grossProfit,
            },
            {
                type: "DELIVERY",
                revenue: totals.delivery.revenue,
                orders: totals.delivery.orders,
                grossProfit: totals.delivery.grossProfit,
            },
            {
                type: "TAKEAWAY",
                revenue: totals.takeaway.revenue,
                orders: totals.takeaway.orders,
                grossProfit: totals.takeaway.grossProfit,
            },
        ],
    };
    if (outlet.outletType === "BAKERY" || outlet.outletType === "EXPRESS") {
        return res.json({
            success: true,
            stats: expressFormattedStats,
            message: "Powered Up",
        });
    }
    else {
        return res.json({
            success: true,
            stats: formattedStats,
            message: "Powered Up",
        });
    }
});
exports.orderStatsForOutlet = orderStatsForOutlet;
const orderStatsForOutletByStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { outletId } = req.params;
    const { period } = req.query;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    //@ts-ignore
    const staff = yield (0, get_users_1.getStaffById)(outlet.id, (_b = req.user) === null || _b === void 0 ? void 0 : _b.id);
    if (!(staff === null || staff === void 0 ? void 0 : staff.id)) {
        throw new not_found_1.NotFoundException("Unauthorized", root_1.ErrorCode.UNAUTHORIZED);
    }
    const { startDate, endDate } = (0, utils_1.getPeriodDates)(period);
    const orders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outlet.id,
            staffId: staff === null || staff === void 0 ? void 0 : staff.id,
            createdAt: {
                gte: startDate,
                lte: endDate,
            },
        },
        select: {
            totalAmount: true,
            orderType: true,
        },
    });
    // Initialize totals for all types and the "All" category
    const totals = {
        all: { revenue: 0, orders: 0 },
        dineIn: { revenue: 0, orders: 0 },
        delivery: { revenue: 0, orders: 0 },
        takeaway: { revenue: 0, orders: 0 },
    };
    // Sum up the revenue and order counts for each category and the total
    orders.forEach((order) => {
        const amount = parseFloat(order.totalAmount);
        // Sum for all orders
        totals.all.revenue += amount;
        totals.all.orders++;
        // Sum for each orderType
        switch (order.orderType) {
            case "DINEIN":
                totals.dineIn.revenue += amount;
                totals.dineIn.orders++;
                break;
            case "DELIVERY":
                totals.delivery.revenue += amount;
                totals.delivery.orders++;
                break;
            case "TAKEAWAY":
                totals.takeaway.revenue += amount;
                totals.takeaway.orders++;
                break;
        }
    });
    // Format the stats (this is just an example, you can adjust the format)
    const formattedStats = {
        totalRevenue: totals.all.revenue,
        totalOrders: totals.all.orders,
        stats: [
            {
                type: "DINEIN",
                revenue: totals.dineIn.revenue,
                orders: totals.dineIn.orders,
            },
            {
                type: "DELIVERY",
                revenue: totals.delivery.revenue,
                orders: totals.delivery.orders,
            },
            {
                type: "TAKEAWAY",
                revenue: totals.takeaway.revenue,
                orders: totals.takeaway.orders,
            },
        ],
    };
    return res.json({
        success: true,
        stats: formattedStats,
        message: "Powered Up",
    });
});
exports.orderStatsForOutletByStaff = orderStatsForOutletByStaff;
const outletTopSellingItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const period = req.query.period || "all";
    const categoryId = req.query.categoryId || "all";
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const { startDate, endDate } = (0, utils_1.getPeriodDates)(period);
    // Build the filter for category
    const categoryFilter = categoryId !== "all" ? { categoryId: { categoryId: categoryId } } : {};
    // Fetch top-selling items
    const topItems = yield __1.prismaDB.orderItem.findMany({
        where: {
            order: {
                restaurantId: outlet.id,
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            menuItem: categoryFilter.categoryId ? { categoryId: categoryId } : {},
        },
        include: {
            menuItem: {
                include: {
                    category: true,
                    images: true,
                },
            },
        },
    });
    // Aggregate the data
    const aggregated = {};
    topItems.forEach((item) => {
        const foodId = item.menuItem.id;
        if (!aggregated[foodId]) {
            aggregated[foodId] = {
                id: foodId,
                name: item.menuItem.name,
                category: item.menuItem.category.name,
                orders: 0,
                revenue: 0,
                imageUrl: item.menuItem.images.length > 0 ? item.menuItem.images[0].url : null, // Adjust as needed
            };
        }
        aggregated[foodId].orders += Number(item.quantity);
        aggregated[foodId].revenue += Number(item.totalPrice);
    });
    // Convert the aggregated object to an array and sort by orders
    const sortedTopItems = Object.values(aggregated)
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5); // Top 5 items
    return res.json({
        success: true,
        topItems: sortedTopItems,
        message: "Powered Up",
    });
});
exports.outletTopSellingItems = outletTopSellingItems;
const lastSixMonthsOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const sixMonthsAgo = (0, date_fns_1.subMonths)(new Date(), 6);
    const orders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            createdAt: {
                gte: sixMonthsAgo,
            },
            // orderStatus: "COMPLETED",
        },
        select: {
            orderType: true,
            createdAt: true,
        },
    });
    // Initialize an object to accumulate order counts by month and orderType
    const monthlyData = {};
    orders === null || orders === void 0 ? void 0 : orders.forEach((order) => {
        const month = (0, date_fns_1.format)(order === null || order === void 0 ? void 0 : order.createdAt, "MMMM");
        if (!monthlyData[month]) {
            monthlyData[month] = { express: 0, dineIn: 0, delivery: 0, takeaway: 0 };
        }
        switch (order === null || order === void 0 ? void 0 : order.orderType) {
            case "EXPRESS":
                monthlyData[month].express++;
                break;
            case "DINEIN":
                monthlyData[month].dineIn++;
                break;
            case "TAKEAWAY":
                monthlyData[month].takeaway++;
                break;
            case "DELIVERY":
                monthlyData[month].delivery++;
                break;
        }
    });
    const chartData = Array.from({ length: 6 })
        .map((_, index) => {
        var _a, _b, _c, _d;
        const month = (0, date_fns_1.format)((0, date_fns_1.subMonths)(new Date(), index), "MMMM");
        return {
            month,
            Express: ((_a = monthlyData[month]) === null || _a === void 0 ? void 0 : _a.express) || 0,
            DineIn: ((_b = monthlyData[month]) === null || _b === void 0 ? void 0 : _b.dineIn) || 0,
            Takeaway: ((_c = monthlyData[month]) === null || _c === void 0 ? void 0 : _c.takeaway) || 0,
            Delivery: ((_d = monthlyData[month]) === null || _d === void 0 ? void 0 : _d.delivery) || 0,
        };
    })
        .reverse();
    return res.json({
        success: true,
        monthStats: chartData,
    });
});
exports.lastSixMonthsOrders = lastSixMonthsOrders;
const cashFlowStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const { outletId } = req.params;
    const { period } = req.query;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const { startDate, endDate } = (0, utils_1.getPeriodDates)(period);
    const cashFlowOrderSession = yield __1.prismaDB.orderSession.findMany({
        where: {
            restaurantId: outlet.id,
            createdAt: {
                gte: startDate,
                lte: endDate,
            },
        },
        select: {
            isPaid: true,
            sessionStatus: true,
            paymentMethod: true,
            subTotal: true,
        },
    });
    const paymentTotals = {
        UPI: { revenue: 0, transactions: 0 },
        CASH: { revenue: 0, transactions: 0 },
        DEBIT: { revenue: 0, transactions: 0 },
        CREDIT: { revenue: 0, transactions: 0 },
    };
    (_c = cashFlowOrderSession === null || cashFlowOrderSession === void 0 ? void 0 : cashFlowOrderSession.filter((o) => o.isPaid === true)) === null || _c === void 0 ? void 0 : _c.forEach((session) => {
        const amount = parseFloat(session === null || session === void 0 ? void 0 : session.subTotal);
        switch (session.paymentMethod) {
            case "UPI":
                paymentTotals.UPI.revenue += amount;
                paymentTotals.UPI.transactions++;
                break;
            case "CASH":
                paymentTotals.CASH.revenue += amount;
                paymentTotals.CASH.transactions++;
                break;
            case "DEBIT":
                paymentTotals.DEBIT.revenue += amount;
                paymentTotals.DEBIT.transactions++;
                break;
            case "CREDIT":
                paymentTotals.CREDIT.revenue += amount;
                paymentTotals.CREDIT.transactions++;
                break;
        }
    });
    // Aggregate total revenue and transactions
    const totalRevenue = paymentTotals.UPI.revenue +
        paymentTotals.CASH.revenue +
        paymentTotals.DEBIT.revenue +
        paymentTotals.CREDIT.revenue;
    const totalTransactions = paymentTotals.UPI.transactions +
        paymentTotals.CASH.transactions +
        paymentTotals.DEBIT.transactions +
        paymentTotals.CREDIT.transactions;
    // Format the response
    const formattedStats = {
        totalRevenue,
        totalTransactions,
        breakdown: [
            {
                method: "UPI",
                revenue: paymentTotals.UPI.revenue,
                transactions: paymentTotals.UPI.transactions,
            },
            {
                method: "CASH",
                revenue: paymentTotals.CASH.revenue,
                transactions: paymentTotals.CASH.transactions,
            },
            {
                method: "DEBIT",
                revenue: paymentTotals.DEBIT.revenue,
                transactions: paymentTotals.DEBIT.transactions,
            },
            {
                method: "CREDIT",
                revenue: paymentTotals.CREDIT.revenue,
                transactions: paymentTotals.CREDIT.transactions,
            },
        ],
    };
    return res.json({
        success: true,
        stats: formattedStats,
        message: "Cashflow statistics retrieved successfully",
    });
});
exports.cashFlowStats = cashFlowStats;
