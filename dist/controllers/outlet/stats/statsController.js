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
exports.getTodaysTransaction = exports.getCategoryContributionStats = exports.getOrderHourWise = exports.expenseMetrics = exports.getFinancialMetrics = exports.totalInventory = exports.cashFlowStats = exports.lastSixMonthsOrders = exports.outletTopSellingItems = exports.orderStatsForOutletByStaff = exports.orderStatsForOutlet = exports.getRevenueAndExpenses = exports.setupCacheInvalidation = exports.getDashboardMetrics = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const utils_1 = require("../../../lib/utils");
const get_users_1 = require("../../../lib/get-users");
const date_fns_1 = require("date-fns");
const bad_request_1 = require("../../../exceptions/bad-request");
const luxon_1 = require("luxon");
const redis_1 = require("../../../services/redis");
const ioredis_1 = __importDefault(require("ioredis"));
const secrets_1 = require("../../../secrets");
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
    return `${sign} ${growth.percentage.toFixed(1)}% from ${periodLabel}`;
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
// Cache keys and TTL configuration
const CACHE_CONFIG = {
    DASHBOARD_METRICS: {
        prefix: "dashboard:metrics",
        ttl: 300, // 5 minutes
    },
    REVENUE_EXPENSES: {
        prefix: "revenue:expenses",
        ttl: 600, // 10 minutes
    },
};
// Cache invalidation patterns
const INVALIDATION_PATTERNS = {
    ORDER: "order:*",
    EXPENSE: "expense:*",
    CUSTOMER: "customer:*",
};
// Helper function to generate cache key
const generateCacheKey = (prefix, outletId, period) => {
    return `${prefix}:${outletId}${period ? `:${period}` : ""}`;
};
// Helper function to invalidate cache by pattern
const invalidateCache = (pattern) => __awaiter(void 0, void 0, void 0, function* () {
    const keys = yield redis_1.redis.keys(pattern);
    if (keys.length) {
        yield redis_1.redis.del(...keys);
    }
});
const getDashboardMetrics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { period } = req.query;
    const cacheKey = generateCacheKey(CACHE_CONFIG.DASHBOARD_METRICS.prefix, outletId, period);
    // Try to get from cache first
    const cachedData = yield redis_1.redis.get(cacheKey);
    if (cachedData) {
        return res.json({
            success: true,
            metrics: JSON.parse(cachedData),
            message: "Dashboard Metrics Retrieved from Cache",
            cached: true,
        });
    }
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
                updatedAt: { gte: startDate, lte: endDate },
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
        __1.prismaDB.customerRestaurantAccess.count({
            where: {
                restaurantId: outlet.id,
                updatedAt: { gte: startDate, lte: endDate },
            },
        }),
        __1.prismaDB.customerRestaurantAccess.count({
            where: {
                restaurantId: outlet.id,
                updatedAt: { gte: prevStartDate, lte: prevEndDate },
            },
        }),
        __1.prismaDB.expenses.findMany({
            where: {
                restaurantId: outlet.id,
                updatedAt: { gte: startDate, lte: endDate },
            },
            select: {
                amount: true,
            },
        }),
        __1.prismaDB.expenses.findMany({
            where: {
                restaurantId: outlet.id,
                updatedAt: { gte: startDate, lte: endDate },
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
            totalProfitPercentage: ((parseFloat(currentMetrics.totalGrossProfit.toFixed(2)) -
                currentExpMetrics.totalExpenses.toFixed(2)) /
                parseFloat(currentMetrics.totalRevenue.toFixed(2))) *
                100 || 0,
            percentage: ((parseFloat(currentMetrics.totalGrossProfit.toFixed(2)) -
                currentExpMetrics.totalExpenses.toFixed(2)) /
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
    // Cache the result
    yield redis_1.redis.setex(cacheKey, CACHE_CONFIG.DASHBOARD_METRICS.ttl, JSON.stringify(metrics));
    return res.json({
        success: true,
        metrics,
        message: "Dashboard Metrics Calculated",
    });
});
exports.getDashboardMetrics = getDashboardMetrics;
// Subscribe to relevant events for cache invalidation
const setupCacheInvalidation = () => {
    const pubsub = new ioredis_1.default(secrets_1.REDIS_URL);
    console.log("Setting up cache invalidation");
    pubsub.subscribe("orderUpdated", "expenseUpdated", "customerUpdated");
    pubsub.on("message", (channel, message) => __awaiter(void 0, void 0, void 0, function* () {
        const { outletId } = JSON.parse(message);
        console.log("Message received", JSON.parse(message));
        switch (channel) {
            case "orderUpdated":
                yield invalidateCache(`${CACHE_CONFIG.DASHBOARD_METRICS.prefix}:${outletId}:*`);
                yield invalidateCache(`${CACHE_CONFIG.REVENUE_EXPENSES.prefix}:${outletId}:*`);
                break;
            case "expenseUpdated":
                yield invalidateCache(`${CACHE_CONFIG.DASHBOARD_METRICS.prefix}:${outletId}:*`);
                yield invalidateCache(`${CACHE_CONFIG.REVENUE_EXPENSES.prefix}:${outletId}:*`);
                break;
            case "customerUpdated":
                yield invalidateCache(`${CACHE_CONFIG.DASHBOARD_METRICS.prefix}:${outletId}:*`);
                break;
        }
    }));
};
exports.setupCacheInvalidation = setupCacheInvalidation;
const getRevenueAndExpenses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const cacheKey = generateCacheKey(CACHE_CONFIG.REVENUE_EXPENSES.prefix, outletId);
    // Try to get from cache first
    const cachedData = yield redis_1.redis.get(cacheKey);
    if (cachedData) {
        return res.json({
            success: true,
            monthStats: JSON.parse(cachedData),
            message: "Revenue and Expenses Retrieved from Cache",
            cached: true,
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const sixMonthsAgo = (0, date_fns_1.subMonths)(new Date(), 6);
    // Fetch orders for revenue
    const orders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outlet.id,
            updatedAt: {
                gte: sixMonthsAgo,
            },
        },
        select: {
            totalAmount: true,
            updatedAt: true,
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
        const month = (0, date_fns_1.format)(order.updatedAt, "MMMM");
        if (!monthlyData[month]) {
            monthlyData[month] = { revenue: 0, expenses: 0 };
        }
        monthlyData[month].revenue += Number(order.totalAmount || 0);
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
    yield redis_1.redis.setex(cacheKey, CACHE_CONFIG.REVENUE_EXPENSES.ttl, JSON.stringify(chartData));
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
            updatedAt: {
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
        const amount = Number(order.totalAmount);
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
            updatedAt: {
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
        const amount = Number(order.totalAmount);
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
                orderSession: {
                    sessionStatus: {
                        in: ["ONPROGRESS", "COMPLETED"],
                    },
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
            updatedAt: {
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
            updatedAt: {
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
    // Fetch raw materials with their categories
    const rawMaterials = yield __1.prismaDB.rawMaterial.findMany({
        where: {
            restaurantId: outlet.id,
        },
        include: {
            consumptionUnit: true,
            rawMaterialCategory: true,
        },
    });
    // Calculate wastage analytics
    const wastageAnalytics = yield calculateWastageAnalytics(outlet.id);
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
    // Get stock movement trend (last 6 months)
    const sixMonthsAgo = (0, date_fns_1.subMonths)(new Date(), 6);
    const stockMovement = yield __1.prismaDB.purchase.groupBy({
        by: ["createdAt"],
        where: {
            restaurantId: outletId,
            purchaseStatus: "COMPLETED",
            createdAt: {
                gte: (0, date_fns_1.startOfMonth)(sixMonthsAgo),
            },
        },
        _sum: {
            totalAmount: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    // Get recent purchase orders
    const recentPurchases = yield __1.prismaDB.purchase.findMany({
        where: {
            restaurantId: outletId,
            purchaseStatus: {
                in: ["PROCESSED", "REQUESTED", "SETTLEMENT"],
            },
        },
        include: {
            vendor: {
                select: {
                    name: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 3,
    });
    // Get top vendors by purchase volume
    const topVendors = yield __1.prismaDB.purchase.groupBy({
        by: ["vendorId"],
        where: {
            restaurantId: outletId,
            // purchaseStatus: "COMPLETED",
        },
        _sum: {
            totalAmount: true,
        },
        orderBy: {
            _sum: {
                totalAmount: "desc",
            },
        },
        // take: 3,
    });
    // Get vendor details with contracts
    const topVendorDetails = yield Promise.all(topVendors.map((vendor) => __awaiter(void 0, void 0, void 0, function* () {
        var _d;
        const [vendorInfo, latestContract] = yield Promise.all([
            __1.prismaDB.vendor.findFirst({
                where: { id: vendor.vendorId },
                include: {
                    category: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
            __1.prismaDB.vendorContractRate.findFirst({
                where: {
                    vendorId: vendor.vendorId,
                    isActive: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            }),
        ]);
        return {
            name: (vendorInfo === null || vendorInfo === void 0 ? void 0 : vendorInfo.name) || "Missing Vendor Name",
            category: ((_d = vendorInfo === null || vendorInfo === void 0 ? void 0 : vendorInfo.category) === null || _d === void 0 ? void 0 : _d.name) || "Missing Category",
            contractedRate: `${(latestContract === null || latestContract === void 0 ? void 0 : latestContract.totalRate) || 0}/${latestContract === null || latestContract === void 0 ? void 0 : latestContract.unitName}`,
            marketRate: (latestContract === null || latestContract === void 0 ? void 0 : latestContract.totalRate)
                ? `${(latestContract.totalRate * 1.2).toFixed(2)}/${latestContract.unitName}`
                : "N/A",
            expiryDate: (latestContract === null || latestContract === void 0 ? void 0 : latestContract.validTo)
                ? `Expires in ${Math.ceil((new Date(latestContract.validTo).getTime() -
                    new Date().getTime()) /
                    (1000 * 60 * 60 * 24 * 30))} months`
                : "No expiry date",
            status: (latestContract === null || latestContract === void 0 ? void 0 : latestContract.isActive) ? "Active" : "Renewal Due",
        };
    })));
    // Get low stock items with detailed information
    const lowStockItems = yield __1.prismaDB.rawMaterial.findMany({
        where: {
            restaurantId: outletId,
            currentStock: {
                lte: __1.prismaDB.rawMaterial.fields.minimumStockLevel,
            },
        },
        include: {
            consumptionUnit: true,
        },
        take: 5,
        orderBy: {
            currentStock: "asc",
        },
    });
    const formattedLowStockItems = lowStockItems.map((item) => ({
        name: item.name,
        currentStock: Number(item.currentStock || 0).toFixed(2),
        minimumStock: Number(item.minimumStockLevel || 0).toFixed(2),
        unit: item.consumptionUnit.name,
        status: !item.currentStock
            ? "Out of Stock"
            : item.currentStock <= (item.minimumStockLevel || 0) / 2
                ? "Critical"
                : "Low Stock",
    }));
    // Format recent purchases
    const formattedRecentPurchases = recentPurchases.map((purchase) => ({
        id: purchase.invoiceNo,
        vendorName: purchase.vendor.name,
        amount: purchase.totalAmount || 0,
        status: purchase.purchaseStatus,
        date: (0, date_fns_1.format)(purchase.createdAt, "dd MMM yyyy"),
    }));
    // Step 1: Calculate COGS for each raw material
    const rawMaterialCOGS = yield Promise.all(rawMaterials.map((material) => __awaiter(void 0, void 0, void 0, function* () {
        var _e;
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
            consumedStock: `${(material === null || material === void 0 ? void 0 : material.conversionFactor)
                ? `${(consumedStock / material.conversionFactor).toFixed(2)}-${material === null || material === void 0 ? void 0 : material.purchasedUnit}`
                : `${consumedStock.toFixed(2)}-${(_e = material === null || material === void 0 ? void 0 : material.consumptionUnit) === null || _e === void 0 ? void 0 : _e.name}`} `,
            cogs: cogs.toFixed(2),
        };
    })));
    const inventoryTurnover = cogs._sum.totalAmount && totalInventoryStats.totalValue > 0
        ? cogs._sum.totalAmount / totalInventoryStats.totalValue
        : 0;
    // Format stock movement data
    const formattedStockMovement = Array.from({ length: 6 }, (_, i) => {
        const month = (0, date_fns_1.subMonths)(new Date(), i);
        const monthData = stockMovement.find((entry) => new Date(entry.createdAt).getMonth() === month.getMonth() &&
            new Date(entry.createdAt).getFullYear() === month.getFullYear());
        return {
            month: month.toLocaleString("default", { month: "short" }),
            value: (monthData === null || monthData === void 0 ? void 0 : monthData._sum.totalAmount) || 0,
        };
    }).reverse();
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
        stockMovement: formattedStockMovement,
        recentPurchases: formattedRecentPurchases,
        topVendors: topVendorDetails,
        lowStockItems: formattedLowStockItems,
        wastageAnalytics,
    };
    return res.json({
        success: true,
        formattedInventoryStats: formatted,
    });
});
exports.totalInventory = totalInventory;
// Add this helper function to calculate wastage
const calculateWastageAnalytics = (restaurantId) => __awaiter(void 0, void 0, void 0, function* () {
    // Get the start of the current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    // Fetch all completed orders for the current month
    const orders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: restaurantId,
            orderStatus: "COMPLETED",
            createdAt: {
                gte: startOfMonth,
            },
        },
        include: {
            orderItems: {
                include: {
                    menuItem: {
                        include: {
                            itemRecipe: {
                                include: {
                                    ingredients: {
                                        include: {
                                            rawMaterial: {
                                                include: {
                                                    rawMaterialCategory: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    // Initialize wastage tracking by category
    const wastageByCategory = {};
    // Process each order and calculate wastage
    orders.forEach((order) => {
        order.orderItems.forEach((orderItem) => {
            var _a;
            const recipe = (_a = orderItem.menuItem) === null || _a === void 0 ? void 0 : _a.itemRecipe;
            if (recipe) {
                recipe.ingredients.forEach((ingredient) => {
                    const category = ingredient.rawMaterial.rawMaterialCategory.name;
                    const quantity = Number(orderItem.quantity);
                    const wastageAmount = (ingredient.wastage / 100) * ingredient.quantity * quantity;
                    const wastageValue = wastageAmount * (ingredient.rawMaterial.purchasedPricePerItem || 0);
                    if (!wastageByCategory[category]) {
                        wastageByCategory[category] = {
                            totalWastage: 0,
                            totalValue: 0,
                            itemCount: 0,
                        };
                    }
                    wastageByCategory[category].totalWastage += wastageAmount;
                    wastageByCategory[category].totalValue += wastageValue;
                    wastageByCategory[category].itemCount += 1;
                });
            }
        });
    });
    // Calculate total value for percentage calculations
    const totalWastageValue = Object.values(wastageByCategory).reduce((sum, category) => sum + category.totalValue, 0);
    // Format the results
    const wastageAnalytics = Object.entries(wastageByCategory).map(([category, data]) => ({
        category,
        amount: Math.round(data.totalValue * 100) / 100, // Round to 2 decimal places
        percentage: Math.round((data.totalValue / totalWastageValue) * 1000) / 10, // Round to 1 decimal place
        totalWastageQuantity: Math.round(data.totalWastage * 100) / 100,
        affectedItems: data.itemCount,
    }));
    // Sort by amount in descending order
    wastageAnalytics.sort((a, b) => b.amount - a.amount);
    return wastageAnalytics;
});
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
            updatedAt: { gte: startDate, lte: endDate },
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
            updatedAt: { gte: startDate, lte: endDate },
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
            updatedAt: { gte: startDate, lte: endDate },
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
    // Calculate cash flow metrics
    const cashIn = totalRevenue; // Revenue is the cash coming in
    const cashOut = totalExpensesCost; // Total expenses are the cash going out
    const netCashFlow = cashIn - cashOut; // Net cash flow is the difference
    // Return financial metrics
    return res.json({
        success: true,
        metrics: {
            totalRevenue: totalRevenue.toFixed(2),
            totalGrossProfit: totalGrossProfit.toFixed(2),
            totalExpenses: totalExpenses.toFixed(2),
            netProfit: netProfit.toFixed(2),
            profitMargin: `${profitMargin.toFixed(2)}%`,
            cashIn: cashIn.toFixed(2),
            cashOut: cashOut.toFixed(2),
            netCashFlow: netCashFlow.toFixed(2),
        },
        message: "Financial metrics calculated successfully",
    });
});
exports.getFinancialMetrics = getFinancialMetrics;
const expenseMetrics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { startDate, endDate, prevStartDate, prevEndDate } = req.query;
    if (!startDate || !endDate || !prevStartDate || !prevEndDate) {
        throw new bad_request_1.BadRequestsException("Missing required date parameters", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const formatDateRangeForPrisma = (dateString, isEnd = false) => {
        const [day, month, year] = dateString.split("-").map(Number);
        if (!day || !month || !year) {
            throw new bad_request_1.BadRequestsException("Invalid date format", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        const date = new Date(year, month - 1, day);
        if (isEnd) {
            date.setHours(23, 59, 59, 999); // End of the day
        }
        else {
            date.setHours(0, 0, 0, 0); // Start of the day
        }
        return date;
    };
    const parsedStartDate = formatDateRangeForPrisma(startDate);
    const parsedEndDate = formatDateRangeForPrisma(endDate, true);
    const parsedPrevStartDate = formatDateRangeForPrisma(prevStartDate);
    const parsedPrevEndDate = formatDateRangeForPrisma(prevEndDate, true);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const [currExpenses, prevExpenses, ordersCashIn, expensesCashOut] = yield Promise.all([
        __1.prismaDB.expenses.findMany({
            where: {
                restaurantId: outletId,
                createdAt: {
                    gte: parsedStartDate,
                    lte: parsedEndDate,
                },
            },
            select: {
                amount: true,
            },
        }),
        __1.prismaDB.expenses.findMany({
            where: {
                restaurantId: outletId,
                createdAt: {
                    gte: parsedPrevStartDate,
                    lte: parsedPrevEndDate,
                },
            },
            select: {
                amount: true,
            },
        }),
        __1.prismaDB.order.findMany({
            where: {
                restaurantId: outletId,
                updatedAt: {
                    gte: parsedStartDate,
                    lte: parsedEndDate,
                },
                orderStatus: "COMPLETED",
            },
            select: {
                totalAmount: true,
            },
        }),
        __1.prismaDB.expenses.findMany({
            where: {
                restaurantId: outletId,
                createdAt: {
                    gte: parsedStartDate,
                    lte: parsedEndDate,
                },
                category: {
                    in: [
                        "Ingredients",
                        "Utilities",
                        "Salaries",
                        "Equipment",
                        "Marketing",
                        "Rent",
                        "Miscellaneous",
                    ],
                },
            },
            select: {
                amount: true,
            },
        }),
    ]);
    const totalCurrExpenses = currExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const totalPrevExpenses = prevExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const totalCashIn = ordersCashIn.reduce((sum, order) => sum + Number(order === null || order === void 0 ? void 0 : order.totalAmount), 0);
    const totalCashOut = expensesCashOut.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const percentageChange = totalPrevExpenses
        ? ((totalCurrExpenses - totalPrevExpenses) / totalPrevExpenses) * 100
        : 0;
    const metrics = {
        expenses: {
            totalExpenses: totalCurrExpenses,
            growth: `${percentageChange.toFixed(2)}% vs Previous Period`,
        },
        cashFlow: {
            totalCashIn,
            cashInPercentage: ((totalCashIn / (totalCashIn + totalCashOut)) *
                100).toFixed(2),
            totalCashOut,
            cashOutPercentage: ((totalCashOut / (totalCashIn + totalCashOut)) *
                100).toFixed(2),
            netCash: totalCashIn - totalCashOut,
        },
    };
    return res.json({ success: true, metrics });
});
exports.expenseMetrics = expenseMetrics;
const getOrderHourWise = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _f;
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const timeZone = "Asia/Kolkata"; // Default to a specific time zone
    let startHour = 0;
    let endHour = 23;
    if (outlet.openTime && outlet.closeTime) {
        // Parse hours from HH:mm format
        startHour = parseInt(outlet.openTime.split(":")[0]);
        const closeHour = parseInt(outlet.closeTime.split(":")[0]);
        // Handle cases where closing time is on the next day
        endHour = closeHour < startHour ? closeHour + 24 : closeHour;
    }
    // Start and end of today in the restaurant's time zone
    const todayStart = luxon_1.DateTime.now()
        .setZone(timeZone)
        .startOf("day")
        .toUTC()
        .toISO();
    const todayEnd = (_f = luxon_1.DateTime.now().setZone(timeZone).endOf("day").toUTC().toISO()) !== null && _f !== void 0 ? _f : new Date().toISOString();
    if (!todayStart || !todayEnd) {
        throw new Error("Failed to calculate today's date range.");
    }
    const orders = yield __1.prismaDB.order.groupBy({
        by: ["updatedAt"],
        _count: {
            id: true,
        },
        where: {
            restaurantId: outletId,
            updatedAt: {
                gte: new Date(todayStart),
                lte: new Date(todayEnd),
            },
        },
    });
    const orderStatuses = yield __1.prismaDB.order.groupBy({
        by: ["updatedAt", "orderStatus"],
        _count: {
            id: true,
        },
        where: {
            restaurantId: outletId,
            updatedAt: {
                gte: new Date(todayStart),
                lte: new Date(todayEnd),
            },
        },
    });
    // Generate data for all 24 hours in the outlet's time zone
    // const hours = Array.from({ length: 24 }, (_, i) => i);
    // Generate data only for outlet operating hours
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => (startHour + i) % 24);
    const formattedData = hours.map((hour) => {
        const ordersAtHour = orders.filter((order) => {
            const orderHour = luxon_1.DateTime.fromJSDate(order.updatedAt, {
                zone: timeZone,
            }).hour;
            return orderHour === hour;
        });
        const count = ordersAtHour.reduce((sum, order) => sum + order._count.id, 0);
        const statuses = orderStatuses
            .filter((status) => {
            const statusHour = luxon_1.DateTime.fromJSDate(status.updatedAt, {
                zone: timeZone,
            }).hour;
            return statusHour === hour;
        })
            .reduce((acc, status) => {
            acc[status.orderStatus] = status._count.id;
            return acc;
        }, {});
        return {
            hour,
            count,
            status: statuses,
        };
    });
    return res.json({
        success: true,
        data: formattedData,
    });
});
exports.getOrderHourWise = getOrderHourWise;
const generateVibrantColor = () => {
    const randomColor = Math.floor(Math.random() * 16777215).toString(16);
    return `#${randomColor.padStart(6, "0")}`;
};
const getCategoryContributionStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Fetch orders and related category data
    const orderItems = yield __1.prismaDB.orderItem.findMany({
        where: {
            order: {
                orderStatus: {
                    in: ["COMPLETED", "DELIVERED"],
                },
                restaurantId: outletId,
            },
        },
        include: {
            menuItem: {
                include: {
                    category: true,
                },
            },
        },
    });
    // Aggregate amounts by category
    const categoryTotals = orderItems.reduce((acc, item) => {
        const categoryName = item.menuItem.category.name;
        acc[categoryName] = (acc[categoryName] || 0) + item.totalPrice;
        return acc;
    }, {});
    // Calculate total revenue from all categories
    const totalRevenue = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
    // Map categories to stats with percentage contribution and vibrant colors
    const stats = Object.entries(categoryTotals).map(([category, amount]) => ({
        name: category,
        amount: parseFloat(amount.toFixed(2)),
        percentage: parseFloat(((amount / totalRevenue) * 100).toFixed(2)),
        color: generateVibrantColor(), // Assign a random vibrant color
    }));
    return res.json({
        success: true,
        categoryContributionStats: stats,
    });
});
exports.getCategoryContributionStats = getCategoryContributionStats;
//todays transaction
const getTodaysTransaction = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    const { page = 1, limit = 10 } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const todayStart = luxon_1.DateTime.now()
        .setZone("Asia/Kolkata")
        .startOf("day")
        .toUTC()
        .toISO();
    const where = {
        register: {
            restaurantId: outletId,
            createdAt: {
                gte: new Date(todayStart),
            },
        },
    };
    const total = yield __1.prismaDB.cashTransaction.count({ where });
    // Get all transactions for today (including those from registers)
    const allTransactions = yield __1.prismaDB.cashTransaction.findMany({
        where,
        include: {
            order: {
                select: {
                    id: true,
                    billId: true,
                    orderType: true,
                    subTotal: true,
                    paymentMethod: true,
                    orders: {
                        select: {
                            orderItems: {
                                select: {
                                    name: true,
                                    quantity: true,
                                    isVariants: true,
                                    selectedVariant: true,
                                },
                            },
                        },
                    },
                    createdAt: true,
                },
            },
            expense: {
                select: {
                    id: true,
                    category: true,
                    amount: true,
                    description: true,
                    date: true,
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
    const totalCashIn = allTransactions
        .filter((t) => t.type === "CASH_IN")
        .reduce((sum, t) => sum + t.amount, 0);
    const totalCashOut = allTransactions
        .filter((t) => t.type === "CASH_OUT")
        .reduce((sum, t) => sum + t.amount, 0);
    const transactionCount = allTransactions.length;
    const orderCount = allTransactions.filter((t) => t.source === "ORDER").length;
    const expenseCount = allTransactions.filter((t) => t.source === "EXPENSE").length;
    const manualCount = allTransactions.filter((t) => t.source === "MANUAL").length;
    return res.json({
        success: true,
        data: {
            transactions: allTransactions,
            pagination: {
                total,
                page: pageNumber,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                hasMore: pageNumber * pageSize < total,
            },
            summary: {
                totalCashIn,
                totalCashOut,
                netCash: totalCashIn - totalCashOut,
                transactionCount,
                orderCount,
                expenseCount,
                manualCount,
            },
        },
    });
});
exports.getTodaysTransaction = getTodaysTransaction;
