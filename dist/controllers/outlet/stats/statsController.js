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
exports.getFinancialMetrics = exports.totalInventory = exports.cashFlowStats = exports.lastSixMonthsOrders = exports.outletTopSellingItems = exports.orderStatsForOutletByStaff = exports.orderStatsForOutlet = exports.getRevenueAndExpenses = exports.getDashboardMetrics = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const utils_1 = require("../../../lib/utils");
const get_users_1 = require("../../../lib/get-users");
const date_fns_1 = require("date-fns");
const getPreviousPeriodDates = (period) => {
    const { startDate, endDate } = (0, utils_1.getPeriodDates)(period);
    switch (period) {
        case "today":
            return {
                startDate: new Date(startDate.getTime() - 24 * 60 * 60 * 1000),
                endDate: new Date(endDate.getTime() - 24 * 60 * 60 * 1000),
            };
        case "week":
            return {
                startDate: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
                endDate: new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000),
            };
        case "month":
            return {
                startDate: new Date(startDate.setMonth(startDate.getMonth() - 1)),
                endDate: new Date(endDate.setMonth(endDate.getMonth() - 1)),
            };
        case "year":
            return {
                startDate: new Date(startDate.setFullYear(startDate.getFullYear() - 1)),
                endDate: new Date(endDate.setFullYear(endDate.getFullYear() - 1)),
            };
        default:
            return { startDate, endDate };
    }
};
const calculateMetrics = (orders) => ({
    totalRevenue: orders.reduce((sum, order) => sum + parseFloat(order.totalAmount || "0"), 0),
    totalGrossProfit: orders.reduce((sum, order) => sum + parseFloat(order.totalGrossProfit || "0"), 0),
    totalOrders: orders.length,
    avgOrderTime: orders.length
        ? orders.reduce((sum, order) => sum +
            (new Date(order.updatedAt).getTime() -
                new Date(order.createdAt).getTime()), 0) /
            orders.length /
            60000
        : 0,
});
const calculateExpMetrics = (orders) => ({
    totalExpenses: orders === null || orders === void 0 ? void 0 : orders.reduce((sum, expense) => sum + parseFloat((expense === null || expense === void 0 ? void 0 : expense.amount) || "0"), 0),
});
const calculateGrowthRate = (current, previous) => {
    const delta = current - previous;
    const percentage = previous === 0 ? (current > 0 ? 100 : 0) : (delta / previous) * 100;
    return {
        percentage,
        delta,
        trend: percentage > 0 ? "up" : percentage < 0 ? "down" : "stable",
    };
};
const formatGrowthMessage = (growth, periodLabel) => {
    const sign = growth.delta >= 0 ? "+" : "";
    return `${sign}${growth.delta.toFixed(2)} (${growth.percentage.toFixed(1)}%) from ${periodLabel}`;
};
const getPeriodLabel = (period) => {
    const labels = {
        today: "yesterday",
        week: "last week",
        month: "last month",
        year: "last year",
    };
    return labels[period] || "the previous period";
};
const getDashboardMetrics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { period } = req.query;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const { startDate, endDate } = (0, utils_1.getPeriodDates)(period);
    const { startDate: prevStartDate, endDate: prevEndDate } = getPreviousPeriodDates(period);
    const [currentOrders, prevOrders, currentCustomers, prevCustomers, currentExpenses, prevExpenses,] = yield Promise.all([
        __1.prismaDB.order.findMany({
            where: {
                restaurantId: outlet.id,
                createdAt: { gte: startDate, lte: endDate },
                orderStatus: "COMPLETED",
                orderSession: { sessionStatus: "COMPLETED" },
            },
            select: {
                totalAmount: true,
                totalGrossProfit: true,
                createdAt: true,
                updatedAt: true,
                orderType: true,
            },
        }),
        __1.prismaDB.order.findMany({
            where: {
                restaurantId: outlet.id,
                createdAt: { gte: prevStartDate, lte: prevEndDate },
                orderStatus: "COMPLETED",
                orderSession: { sessionStatus: "COMPLETED" },
            },
            select: {
                totalAmount: true,
                totalGrossProfit: true,
                createdAt: true,
                updatedAt: true,
                orderType: true,
            },
        }),
        __1.prismaDB.customer.count({
            where: {
                restaurantId: outlet.id,
                createdAt: { gte: startDate, lte: endDate },
            },
        }),
        __1.prismaDB.customer.count({
            where: {
                restaurantId: outlet.id,
                createdAt: { gte: prevStartDate, lte: prevEndDate },
            },
        }),
        __1.prismaDB.expenses.findMany({
            where: {
                restaurantId: outlet.id,
                date: { gte: startDate, lte: endDate },
            },
            select: {
                amount: true,
            },
        }),
        __1.prismaDB.expenses.findMany({
            where: {
                restaurantId: outlet.id,
                date: { gte: startDate, lte: endDate },
            },
            select: {
                amount: true,
            },
        }),
    ]);
    const currentMetrics = calculateMetrics(currentOrders);
    const prevMetrics = calculateMetrics(prevOrders);
    const currentExpMetrics = calculateExpMetrics(currentExpenses);
    const prevExpMetrics = calculateExpMetrics(prevExpenses);
    const growthRates = {
        revenue: calculateGrowthRate(currentMetrics.totalRevenue, prevMetrics.totalRevenue),
        grossProfit: calculateGrowthRate(currentMetrics.totalGrossProfit, prevMetrics.totalGrossProfit),
        orders: calculateGrowthRate(currentMetrics.totalOrders, prevMetrics.totalOrders),
        expenses: calculateGrowthRate(currentExpMetrics.totalExpenses, prevExpMetrics.totalExpenses),
        avgOrderTime: calculateGrowthRate(currentMetrics.avgOrderTime, prevMetrics.avgOrderTime),
        customers: calculateGrowthRate(currentCustomers, prevCustomers),
    };
    const periodLabel = getPeriodLabel(period);
    const metrics = {
        revenue: {
            totalRevenue: parseFloat(currentMetrics.totalRevenue.toFixed(2)),
            revenueGrowth: formatGrowthMessage(growthRates.revenue, periodLabel),
        },
        grossProfit: {
            totalGrossProfit: parseFloat(currentMetrics.totalGrossProfit.toFixed(2)),
            grossProfitGrowth: formatGrowthMessage(growthRates.grossProfit, periodLabel),
        },
        netProfit: {
            totalNetProfit: parseFloat(currentMetrics.totalGrossProfit.toFixed(2)) -
                currentExpMetrics.totalExpenses.toFixed(2),
            percentage: (parseFloat(currentMetrics.totalGrossProfit.toFixed(2)) -
                currentExpMetrics.totalExpenses.toFixed(2)) /
                100,
        },
        profitMargin: {
            totalProfitPercentage: (parseFloat(currentMetrics.totalGrossProfit.toFixed(2)) /
                parseFloat(currentMetrics.totalRevenue.toFixed(2))) *
                100 || 0,
            percentage: (parseFloat(currentMetrics.totalGrossProfit.toFixed(2)) /
                parseFloat(currentMetrics.totalRevenue.toFixed(2))) *
                100 || 0,
        },
        expenses: {
            totalExpenses: parseFloat(currentExpMetrics.totalExpenses.toFixed(2)),
            expenseGrowth: formatGrowthMessage(growthRates.expenses, periodLabel),
        },
        orders: {
            totalOrders: currentMetrics.totalOrders,
            orderGrowth: formatGrowthMessage(growthRates.orders, periodLabel),
        },
        orderTime: {
            avgOrderTime: currentMetrics.avgOrderTime.toFixed(2),
            avgOrderTimeGrowth: formatGrowthMessage(growthRates.avgOrderTime, periodLabel),
        },
        customers: {
            totalCustomers: currentCustomers,
            customerGrowth: formatGrowthMessage(growthRates.customers, periodLabel),
        },
    };
    return res.json({
        success: true,
        metrics,
        message: "Dashboard Metrics Calculated",
    });
});
exports.getDashboardMetrics = getDashboardMetrics;
const getRevenueAndExpenses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const sixMonthsAgo = (0, date_fns_1.subMonths)(new Date(), 6);
    // Fetch orders for revenue
    const orders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outlet.id,
            createdAt: {
                gte: sixMonthsAgo,
            },
        },
        select: {
            totalAmount: true,
            createdAt: true,
        },
    });
    // Fetch purchases for expenses
    const purchases = yield __1.prismaDB.purchase.findMany({
        where: {
            restaurantId: outlet.id,
            createdAt: {
                gte: sixMonthsAgo,
            },
        },
        select: {
            totalAmount: true,
            createdAt: true,
        },
    });
    // Fetch  expenses
    const expenses = yield __1.prismaDB.expenses.findMany({
        where: {
            restaurantId: outlet.id,
            date: {
                gte: sixMonthsAgo,
            },
        },
        select: {
            amount: true,
            date: true,
        },
    });
    // Fetch payroll costs
    const payrolls = yield __1.prismaDB.payroll.findMany({
        where: {
            staff: {
                restaurantId: outlet.id,
            },
            payDate: {
                gte: sixMonthsAgo,
            },
        },
        select: {
            amountPaid: true,
            payDate: true,
        },
    });
    // Initialize an object to accumulate data
    const monthlyData = {};
    // Aggregate revenue by month
    orders.forEach((order) => {
        const month = (0, date_fns_1.format)(order.createdAt, "MMMM");
        if (!monthlyData[month]) {
            monthlyData[month] = { revenue: 0, expenses: 0 };
        }
        monthlyData[month].revenue += parseFloat(order.totalAmount || "0");
    });
    // Aggregate purchase expenses by month
    purchases.forEach((purchase) => {
        const month = (0, date_fns_1.format)(purchase.createdAt, "MMMM");
        if (!monthlyData[month]) {
            monthlyData[month] = { revenue: 0, expenses: 0 };
        }
        monthlyData[month].expenses += Number(purchase.totalAmount || "0");
    });
    // Aggregate purchase expenses by month
    expenses.forEach((expense) => {
        const month = (0, date_fns_1.format)(expense.date, "MMMM");
        if (!monthlyData[month]) {
            monthlyData[month] = { revenue: 0, expenses: 0 };
        }
        monthlyData[month].expenses += Number(expense.amount || "0");
    });
    // Aggregate payroll expenses by month
    payrolls.forEach((payroll) => {
        const month = (0, date_fns_1.format)(payroll.payDate, "MMMM");
        if (!monthlyData[month]) {
            monthlyData[month] = { revenue: 0, expenses: 0 };
        }
        monthlyData[month].expenses += Number(payroll.amountPaid || "0");
    });
    // Format the data for the chart
    const chartData = Array.from({ length: 6 })
        .map((_, index) => {
        var _a, _b;
        const month = (0, date_fns_1.format)((0, date_fns_1.subMonths)(new Date(), index), "MMMM");
        return {
            month,
            revenue: ((_a = monthlyData[month]) === null || _a === void 0 ? void 0 : _a.revenue) || 0,
            expenses: ((_b = monthlyData[month]) === null || _b === void 0 ? void 0 : _b.expenses) || 0,
        };
    })
        .reverse();
    return res.json({
        success: true,
        monthStats: chartData,
        message: "Revenue and Expenses Data Retrieved",
    });
});
exports.getRevenueAndExpenses = getRevenueAndExpenses;
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
                orderStatus: "COMPLETED",
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
    topItems === null || topItems === void 0 ? void 0 : topItems.forEach((item, i) => {
        const foodId = item.menuItem.id;
        if (!aggregated[foodId]) {
            aggregated[foodId] = {
                id: foodId,
                name: item.name,
                category: item.menuItem.category.name,
                orders: 0,
                grossProfit: 0,
                revenue: 0,
                imageUrl: item.menuItem.images.length > 0 ? item.menuItem.images[0].url : null, // Adjust as needed
            };
        }
        aggregated[foodId].orders += Number(item.quantity);
        aggregated[foodId].revenue += Number(item.totalPrice);
        aggregated[foodId].grossProfit +=
            Number(item.grossProfit) * Number(item.quantity);
    });
    // Convert the aggregated object to an array and sort by orders
    const sortedTopItems = Object.values(aggregated)
        .sort((a, b) => b.orders - a.orders)
        .map((item, index) => (Object.assign(Object.assign({}, item), { rank: index + 1 })));
    // .slice(0, 5); // Top 5 items
    const stats = {
        itemsTotal: sortedTopItems === null || sortedTopItems === void 0 ? void 0 : sortedTopItems.length,
        totalRevenue: sortedTopItems === null || sortedTopItems === void 0 ? void 0 : sortedTopItems.reduce((accu, order) => {
            return (accu += order.revenue);
        }, 0),
        totalGrossProfit: sortedTopItems === null || sortedTopItems === void 0 ? void 0 : sortedTopItems.reduce((accu, order) => {
            return (accu += order.grossProfit);
        }, 0),
    };
    return res.json({
        success: true,
        topItems: { stats: stats, sortedTopItems: sortedTopItems },
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
        const amount = (session === null || session === void 0 ? void 0 : session.subTotal) || 0;
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
const totalInventory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    // Fetch raw materials
    const rawMaterials = yield __1.prismaDB.rawMaterial.findMany({
        where: {
            restaurantId: outlet.id,
        },
        include: {
            consumptionUnit: true,
        },
    });
    // Fetch purchases
    const purchase = yield __1.prismaDB.purchase.findMany({
        where: {
            restaurantId: outlet.id,
            purchaseStatus: {
                in: ["PROCESSED", "REQUESTED", "ACCEPTED", "SETTLEMENT"],
            },
        },
    });
    // Fetch yesterday's purchase count
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayPurchases = yield __1.prismaDB.purchase.count({
        where: {
            restaurantId: outlet.id,
            purchaseStatus: {
                in: ["PROCESSED", "REQUESTED"],
            },
            createdAt: {
                gte: new Date(yesterday.setHours(0, 0, 0, 0)),
                lt: new Date(yesterday.setHours(23, 59, 59, 999)),
            },
        },
    });
    const todayPurchases = purchase.length;
    const purchaseDifference = todayPurchases - yesterdayPurchases;
    // Calculate total inventory stats and inventory turnover
    const totalInventoryStats = rawMaterials.reduce((acc, material) => {
        const stock = material.currentStock || 0;
        const totalValue = Number(stock) * Number(material === null || material === void 0 ? void 0 : material.purchasedPricePerItem);
        if (Number(stock) < Number(material === null || material === void 0 ? void 0 : material.minimumStockLevel)) {
            acc.lowStockItems += 1;
        }
        acc.totalValue += totalValue;
        acc.totalStock += Number(stock);
        return acc;
    }, { totalValue: 0, lowStockItems: 0, totalStock: 0 });
    // Calculate inventory turnover: Cost of Goods Sold (COGS) / Average Inventory
    const cogs = yield __1.prismaDB.purchase.aggregate({
        where: {
            restaurantId: outlet.id,
            purchaseStatus: "PROCESSED",
        },
        _sum: {
            totalAmount: true,
        },
    });
    // Step 1: Calculate COGS for each raw material
    const rawMaterialCOGS = yield Promise.all(rawMaterials.map((material) => __awaiter(void 0, void 0, void 0, function* () {
        var _d;
        // Step 2: Fetch all orders that consumed this raw material
        const ordersWithMaterial = yield __1.prismaDB.orderItem.findMany({
            where: {
                order: {
                    restaurantId: outletId,
                    orderStatus: "COMPLETED", // Only consider completed orders
                },
                menuItem: {
                    chooseProfit: "itemRecipe",
                    itemRecipe: {
                        ingredients: {
                            some: {
                                rawMaterialId: material.id,
                            },
                        },
                    },
                },
            },
            include: {
                menuItem: {
                    include: {
                        itemRecipe: {
                            include: {
                                ingredients: true,
                            },
                        },
                    },
                },
            },
        });
        // Step 3: Calculate the total consumed stock from these orders
        const consumedStock = ordersWithMaterial.reduce((total, orderItem) => {
            var _a, _b;
            const recipeIngredients = ((_b = (_a = orderItem.menuItem) === null || _a === void 0 ? void 0 : _a.itemRecipe) === null || _b === void 0 ? void 0 : _b.ingredients) || [];
            const ingredientForMaterial = recipeIngredients.find((ingredient) => ingredient.rawMaterialId === material.id);
            if (ingredientForMaterial) {
                const quantityUsedPerOrder = ingredientForMaterial.quantity;
                total += quantityUsedPerOrder * Number(orderItem.quantity);
            }
            return total;
        }, 0);
        // Step 4: Calculate COGS for the raw material
        const cogs = consumedStock / Number(material.purchasedPricePerItem || 0);
        return {
            rawMaterialId: material.id,
            name: material.name,
            purchasedStock: material.purchasedStock,
            consumedStock: `${consumedStock.toFixed(2)} - ${(_d = material === null || material === void 0 ? void 0 : material.consumptionUnit) === null || _d === void 0 ? void 0 : _d.name}`,
            cogs: cogs.toFixed(2),
        };
    })));
    const inventoryTurnover = cogs._sum.totalAmount && totalInventoryStats.totalValue > 0
        ? cogs._sum.totalAmount / totalInventoryStats.totalValue
        : 0;
    // Format the result
    const formatted = {
        totalRawMaterials: rawMaterials.length,
        totalInventoryValue: totalInventoryStats.totalValue,
        lowStockLevels: totalInventoryStats.lowStockItems,
        pendingPurchase: purchase.length,
        purchaseDifference: purchaseDifference >= 0
            ? `+${purchaseDifference}`
            : `${purchaseDifference}`,
        inventoryTurnover: inventoryTurnover.toFixed(2),
        rawMaterialCOGS,
    };
    return res.json({
        success: true,
        formattedInventoryStats: formatted,
    });
});
exports.totalInventory = totalInventory;
const getFinancialMetrics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { period } = req.query;
    // Get outlet details
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    // Define date range based on the period (daily, monthly, etc.)
    const { startDate, endDate } = (0, utils_1.getPeriodDates)(period);
    // Fetch total revenue from completed orders
    const orders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outlet.id,
            createdAt: { gte: startDate, lte: endDate },
            orderStatus: "COMPLETED",
        },
        select: {
            totalAmount: true,
            totalGrossProfit: true,
        },
    });
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const totalGrossProfit = orders.reduce((sum, order) => sum + Number(order.totalGrossProfit || 0), 0);
    // Fetch expenses from purchases
    const purchases = yield __1.prismaDB.purchase.findMany({
        where: {
            restaurantId: outlet.id,
            createdAt: { gte: startDate, lte: endDate },
        },
        select: {
            totalAmount: true,
        },
    });
    const totalPurchaseCost = purchases.reduce((sum, purchase) => sum + Number(purchase.totalAmount || "0"), 0);
    // Fetch  expenses
    const expenses = yield __1.prismaDB.expenses.findMany({
        where: {
            restaurantId: outlet.id,
            date: { gte: startDate, lte: endDate },
        },
        select: {
            amount: true,
            date: true,
        },
    });
    const totalExpensesCost = expenses.reduce((sum, purchase) => sum + Number(purchase.amount || "0"), 0);
    // Fetch labour costs from payroll
    const payrolls = yield __1.prismaDB.payroll.findMany({
        where: {
            staff: { restaurantId: outlet.id },
            payDate: { gte: startDate, lte: endDate },
        },
        select: {
            amountPaid: true,
        },
    });
    const totalLabourCost = payrolls.reduce((sum, payroll) => sum + Number(payroll.amountPaid || "0"), 0);
    // Calculate total expenses
    const totalExpenses = totalPurchaseCost + totalLabourCost + totalExpensesCost;
    // Calculate net profit
    const netProfit = totalGrossProfit - totalExpenses;
    // Calculate profit margin
    const profitMargin = (netProfit / totalRevenue) * 100;
    // Return financial metrics
    return res.json({
        success: true,
        metrics: {
            totalRevenue: totalRevenue.toFixed(2),
            totalGrossProfit: totalGrossProfit.toFixed(2),
            totalExpenses: totalExpenses.toFixed(2),
            netProfit: netProfit.toFixed(2),
            profitMargin: `${profitMargin.toFixed(2)}%`,
        },
        message: "Financial metrics calculated successfully",
    });
});
exports.getFinancialMetrics = getFinancialMetrics;
