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
exports.orderAndStockDeduction = exports.getPOSDashboardStats = exports.getVendorStats = exports.getPurchaseOrderDetails = exports.createPurchaseOrder = exports.getPurchaseOrderStats = exports.getStockLevels = exports.getInventoryOverview = exports.getInventoryAlerts = exports.getStaffPerformance = exports.getPopularItems = exports.getPosStats = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const date_fns_1 = require("date-fns");
const luxon_1 = require("luxon");
// Helper function to calculate percentage change
const calculatePercentageChange = (current, previous) => {
    if (previous === 0)
        return current > 0 ? 100 : 0;
    const percentageChange = ((current - previous) / previous) * 100;
    return Number(percentageChange.toFixed(2));
};
const getPosStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    //@ts-ignore
    const { id: staffId } = req.user;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    const timeZone = "Asia/Kolkata"; // Default timezone
    const today = new Date();
    const yesterday = (0, date_fns_1.subDays)(today, 1);
    const lastMonth = (0, date_fns_1.subDays)(today, 30);
    let startHour = 0;
    let endHour = 23;
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.NOT_FOUND);
    }
    if ((outlet === null || outlet === void 0 ? void 0 : outlet.openTime) && (outlet === null || outlet === void 0 ? void 0 : outlet.closeTime)) {
        startHour = parseInt(outlet === null || outlet === void 0 ? void 0 : outlet.openTime.split(":")[0]);
        const closeHour = parseInt(outlet === null || outlet === void 0 ? void 0 : outlet.closeTime.split(":")[0]);
        endHour = closeHour < startHour ? closeHour + 24 : closeHour;
    }
    // Generate hours array based on operating hours
    const operatingHours = [];
    for (let i = startHour; i <= endHour; i++) {
        operatingHours.push(i % 24);
    }
    // Get today's date range in restaurant's timezone
    const todayStart = luxon_1.DateTime.now().setZone(timeZone).startOf("day").toJSDate();
    const todayEnd = luxon_1.DateTime.now().setZone(timeZone).endOf("day").toJSDate();
    const currentRevenue = yield __1.prismaDB.order.aggregate({
        where: {
            restaurantId: outletId,
            staffId: staffId,
            orderStatus: "COMPLETED",
            isPaid: true,
            updatedAt: {
                gte: (0, date_fns_1.startOfDay)(today),
                lte: (0, date_fns_1.endOfDay)(today),
            },
        },
        _sum: {
            totalAmount: true,
        },
    });
    const previousRevenue = yield __1.prismaDB.order.aggregate({
        where: {
            restaurantId: outletId,
            staffId: staffId,
            orderStatus: "COMPLETED",
            isPaid: true,
            updatedAt: {
                gte: (0, date_fns_1.subDays)(lastMonth, 30),
                lte: lastMonth,
            },
        },
        _sum: {
            totalAmount: true,
        },
    });
    //active orders
    const activeOrders = yield __1.prismaDB.order.count({
        where: {
            restaurantId: outletId,
            staffId: staffId,
            orderStatus: {
                in: ["PREPARING", "FOODREADY", "INCOMMING", "SERVED", "OUTFORDELIVERY"],
            },
        },
    });
    //Get Total Orders and average order value
    const totalOrders = yield __1.prismaDB.order.aggregate({
        where: {
            restaurantId: outletId,
            staffId: staffId,
            orderStatus: "COMPLETED",
            updatedAt: {
                gte: (0, date_fns_1.startOfDay)(today),
                lte: (0, date_fns_1.endOfDay)(today),
            },
        },
        _avg: {
            totalAmount: true,
        },
        _count: true,
    });
    // Get active tables
    const tables = yield __1.prismaDB.table.aggregate({
        where: {
            restaurantId: outletId,
        },
        _count: {
            id: true,
        },
    });
    const activeTables = yield __1.prismaDB.table.count({
        where: {
            restaurantId: outletId,
            occupied: true,
        },
    });
    // Get today's orders by hour
    const getTodayOrdersByHour = () => __awaiter(void 0, void 0, void 0, function* () {
        const ordersByHour = yield Promise.all(operatingHours.map((hour) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            const hourStart = (0, date_fns_1.set)(todayStart, { hours: hour });
            const hourEnd = (0, date_fns_1.set)(todayStart, { hours: hour + 1 });
            const orders = yield __1.prismaDB.order.groupBy({
                by: ["orderType"],
                where: {
                    restaurantId: outletId,
                    createdAt: {
                        gte: hourStart,
                        lt: hourEnd,
                    },
                },
                _count: true,
            });
            return {
                hour: `${hour.toString().padStart(2, "0")}:00`,
                dineIn: (_b = (_a = orders === null || orders === void 0 ? void 0 : orders.find((s) => (s === null || s === void 0 ? void 0 : s.orderType) === "DINEIN")) === null || _a === void 0 ? void 0 : _a._count) !== null && _b !== void 0 ? _b : 0,
                takeaway: (_d = (_c = orders === null || orders === void 0 ? void 0 : orders.find((s) => (s === null || s === void 0 ? void 0 : s.orderType) === "TAKEAWAY")) === null || _c === void 0 ? void 0 : _c._count) !== null && _d !== void 0 ? _d : 0,
                delivery: (_f = (_e = orders === null || orders === void 0 ? void 0 : orders.find((s) => (s === null || s === void 0 ? void 0 : s.orderType) === "DELIVERY")) === null || _e === void 0 ? void 0 : _e._count) !== null && _f !== void 0 ? _f : 0,
                express: (_h = (_g = orders === null || orders === void 0 ? void 0 : orders.find((s) => (s === null || s === void 0 ? void 0 : s.orderType) === "EXPRESS")) === null || _g === void 0 ? void 0 : _g._count) !== null && _h !== void 0 ? _h : 0,
                total: (_j = orders === null || orders === void 0 ? void 0 : orders.reduce((acc, o) => acc + o._count, 0)) !== null && _j !== void 0 ? _j : 0,
            };
        })));
        return ordersByHour;
    });
    // Modified getDailyOrderStats to use operating hours
    const getDailyOrderStats = () => __awaiter(void 0, void 0, void 0, function* () {
        const result = (yield __1.prismaDB.order.aggregateRaw({
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $eq: ["$restaurantId", { $toObjectId: outletId }],
                        },
                    },
                },
                {
                    $addFields: {
                        hour: {
                            $hour: {
                                date: "$updatedAt",
                                timezone: "Asia/Kolkata",
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            hour: "$hour",
                            orderType: "$orderType",
                        },
                        count: { $sum: 1 },
                    },
                },
            ],
        }));
        // Convert the raw aggregation result to the required format
        // Format the results
        const formattedStats = operatingHours.map((hour) => {
            var _a, _b, _c, _d;
            const hourOrders = result.filter((r) => r._id.hour === hour);
            return {
                time: `${hour.toString().padStart(2, "0")}:00`,
                dineIn: ((_a = hourOrders.find((o) => o._id.orderType === "DINEIN")) === null || _a === void 0 ? void 0 : _a.count) || 0,
                takeaway: ((_b = hourOrders.find((o) => o._id.orderType === "TAKEAWAY")) === null || _b === void 0 ? void 0 : _b.count) || 0,
                delivery: ((_c = hourOrders.find((o) => o._id.orderType === "DELIVERY")) === null || _c === void 0 ? void 0 : _c.count) || 0,
                express: ((_d = hourOrders.find((o) => o._id.orderType === "EXPRESS")) === null || _d === void 0 ? void 0 : _d.count) || 0,
                total: hourOrders.reduce((acc, o) => acc + o.count, 0),
            };
        });
        return formattedStats;
    });
    const getWeeklyOrderStats = () => __awaiter(void 0, void 0, void 0, function* () {
        const result = (yield __1.prismaDB.order.aggregateRaw({
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $eq: ["$restaurantId", { $toObjectId: outletId }],
                        },
                    },
                },
                {
                    $addFields: {
                        dayOfWeek: {
                            $dayOfWeek: {
                                date: "$updatedAt",
                                timezone: "Asia/Kolkata",
                            },
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            dayOfWeek: "$dayOfWeek",
                            orderType: "$orderType",
                        },
                        count: { $sum: 1 },
                    },
                },
                {
                    $sort: {
                        "_id.dayOfWeek": 1,
                    },
                },
            ],
        }));
        console.log("Weekly Raw MongoDB Result:", JSON.stringify(result, null, 2));
        // MongoDB dayOfWeek: 1 (Sunday) to 7 (Saturday)
        // Convert to: 0 (Sunday) to 6 (Saturday)
        const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        // Format the results
        const formattedStats = daysOfWeek.map((day, index) => {
            var _a, _b, _c, _d;
            // MongoDB's dayOfWeek is 1-based, so we add 1 to our index
            const dayOrders = result.filter((r) => r._id.dayOfWeek === index + 1);
            return {
                time: day,
                dineIn: ((_a = dayOrders.find((o) => o._id.orderType === "DINEIN")) === null || _a === void 0 ? void 0 : _a.count) || 0,
                takeaway: ((_b = dayOrders.find((o) => o._id.orderType === "TAKEAWAY")) === null || _b === void 0 ? void 0 : _b.count) || 0,
                delivery: ((_c = dayOrders.find((o) => o._id.orderType === "DELIVERY")) === null || _c === void 0 ? void 0 : _c.count) || 0,
                express: ((_d = dayOrders.find((o) => o._id.orderType === "EXPRESS")) === null || _d === void 0 ? void 0 : _d.count) || 0,
                total: dayOrders.reduce((acc, o) => acc + o.count, 0),
            };
        });
        return formattedStats;
    });
    // Calculate growth percentages
    const calculateGrowth = () => __awaiter(void 0, void 0, void 0, function* () {
        var _k, _l, _m, _o, _p, _q, _r, _s;
        const today = yield __1.prismaDB.order.groupBy({
            by: ["orderType"],
            where: {
                restaurantId: outletId,
                createdAt: {
                    gte: (0, date_fns_1.startOfDay)(new Date()),
                },
            },
            _count: true,
        });
        const yesterday = yield __1.prismaDB.order.groupBy({
            by: ["orderType"],
            where: {
                restaurantId: outletId,
                createdAt: {
                    gte: (0, date_fns_1.startOfDay)((0, date_fns_1.subDays)(new Date(), 1)),
                    lt: (0, date_fns_1.startOfDay)(new Date()),
                },
            },
            _count: true,
        });
        return {
            dineIn: calculatePercentageChange(((_k = today.find((t) => t.orderType === "DINEIN")) === null || _k === void 0 ? void 0 : _k._count) || 0, ((_l = yesterday.find((t) => t.orderType === "DINEIN")) === null || _l === void 0 ? void 0 : _l._count) || 0),
            express: calculatePercentageChange(((_m = today.find((t) => t.orderType === "EXPRESS")) === null || _m === void 0 ? void 0 : _m._count) || 0, ((_o = yesterday.find((t) => t.orderType === "EXPRESS")) === null || _o === void 0 ? void 0 : _o._count) || 0),
            takeaway: calculatePercentageChange(((_p = today.find((t) => t.orderType === "TAKEAWAY")) === null || _p === void 0 ? void 0 : _p._count) || 0, ((_q = yesterday.find((t) => t.orderType === "TAKEAWAY")) === null || _q === void 0 ? void 0 : _q._count) || 0),
            delivery: calculatePercentageChange(((_r = today.find((t) => t.orderType === "DELIVERY")) === null || _r === void 0 ? void 0 : _r._count) || 0, ((_s = yesterday.find((t) => t.orderType === "DELIVERY")) === null || _s === void 0 ? void 0 : _s._count) || 0),
        };
    });
    const [dailyStats, weeklyStats, growth, todayOrdersByHour] = yield Promise.all([
        getDailyOrderStats(),
        getWeeklyOrderStats(),
        calculateGrowth(),
        getTodayOrdersByHour(),
    ]);
    // Filter order types based on outlet type
    const isBakeryOrExpress = outlet.outletType === "BAKERY" || outlet.outletType === "EXPRESS";
    const filterOrderTypes = (data) => {
        return data.map((item) => {
            const filtered = Object.assign({}, item);
            if (isBakeryOrExpress) {
                delete filtered.dineIn;
            }
            else {
                delete filtered.express;
            }
            return filtered;
        });
    };
    res.json({
        success: true,
        data: {
            totalSalesRevenue: {
                amount: currentRevenue._sum.totalAmount || 0,
                percentageChange: calculatePercentageChange(currentRevenue._sum.totalAmount || 0, previousRevenue._sum.totalAmount || 0).toFixed(2),
            },
            activeOrders,
            totalOrders: {
                count: totalOrders._count,
                averageOrderValue: Math.round(totalOrders._avg.totalAmount || 0),
            },
            activeTables: {
                active: activeTables,
                total: tables._count.id,
                occupancyRate: Math.round((activeTables / tables._count.id) * 100),
            },
            orderingGrowth: {
                growth: isBakeryOrExpress
                    ? {
                        takeaway: growth.takeaway,
                        delivery: growth.delivery,
                        express: growth.express,
                    }
                    : {
                        dineIn: growth.dineIn,
                        takeaway: growth.takeaway,
                        delivery: growth.delivery,
                    },
                todays: filterOrderTypes(todayOrdersByHour),
                daily: filterOrderTypes(dailyStats),
                weekly: filterOrderTypes(weeklyStats),
            },
        },
    });
});
exports.getPosStats = getPosStats;
const getPopularItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const [popularItems, total] = yield Promise.all([
        __1.prismaDB.orderItem.groupBy({
            by: ["menuId", "name"],
            where: {
                order: {
                    restaurantId: outletId,
                    orderStatus: "COMPLETED",
                },
            },
            _count: {
                menuId: true,
            },
            orderBy: {
                _count: {
                    menuId: "desc",
                },
            },
            take: limit,
            skip,
        }),
        __1.prismaDB.orderItem
            .groupBy({
            by: ["menuId"],
            where: {
                order: {
                    restaurantId: outletId,
                    orderStatus: "COMPLETED",
                },
            },
        })
            .then((items) => items.length),
    ]);
    // Get category names for each menu item
    const itemsWithCategories = yield Promise.all(popularItems.map((item) => __awaiter(void 0, void 0, void 0, function* () {
        const menuItem = yield __1.prismaDB.menuItem.findUnique({
            where: { id: item.menuId },
            select: {
                category: {
                    select: { name: true },
                },
            },
        });
        return {
            name: item.name,
            category: (menuItem === null || menuItem === void 0 ? void 0 : menuItem.category.name) || "Uncategorized",
            orderCount: item._count.menuId,
        };
    })));
    res.json({
        success: true,
        data: {
            items: itemsWithCategories,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page,
            },
        },
    });
});
exports.getPopularItems = getPopularItems;
// Get Staff Performance based on OrderSession and Orders
const getStaffPerformance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const [staffPerformance, total] = yield Promise.all([
        __1.prismaDB.orderSession.groupBy({
            by: ["staffId"],
            where: {
                restaurantId: outletId,
                sessionStatus: "COMPLETED",
                staffId: { not: null },
            },
            _count: {
                id: true,
            },
            orderBy: {
                _count: {
                    id: "desc",
                },
            },
            take: limit,
            skip,
        }),
        __1.prismaDB.orderSession
            .groupBy({
            by: ["staffId"],
            where: {
                restaurantId: outletId,
                sessionStatus: "COMPLETED",
                staffId: { not: null },
            },
        })
            .then((staff) => staff.length),
    ]);
    // Get staff details
    const staffWithDetails = yield Promise.all(staffPerformance.map((perf) => __awaiter(void 0, void 0, void 0, function* () {
        const staff = yield __1.prismaDB.staff.findUnique({
            where: { id: perf.staffId },
            select: {
                name: true,
                role: true,
            },
        });
        return {
            name: (staff === null || staff === void 0 ? void 0 : staff.name) || "Unknown",
            role: (staff === null || staff === void 0 ? void 0 : staff.role) || "Unknown",
            orderCount: perf._count.id,
        };
    })));
    res.json({
        success: true,
        data: {
            staff: staffWithDetails,
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page,
            },
        },
    });
});
exports.getStaffPerformance = getStaffPerformance;
// Get Inventory Alerts based on RawMaterial
const getInventoryAlerts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    const [lowStockItems, total] = yield Promise.all([
        __1.prismaDB.rawMaterial.findMany({
            where: {
                restaurantId: outletId,
                currentStock: {
                    lte: 10, // Assuming low stock threshold is 10
                },
            },
            select: {
                name: true,
                currentStock: true,
                consumptionUnit: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                currentStock: "asc",
            },
            take: limit,
            skip,
        }),
        __1.prismaDB.rawMaterial.count({
            where: {
                restaurantId: outletId,
                currentStock: {
                    lte: 10,
                },
            },
        }),
    ]);
    res.json({
        success: true,
        data: {
            alerts: lowStockItems.map((item) => {
                var _a;
                return ({
                    itemName: item.name,
                    currentStock: (_a = item.currentStock) === null || _a === void 0 ? void 0 : _a.toFixed(2),
                    unit: item.consumptionUnit.name,
                    alertType: "LOW_STOCK",
                });
            }),
            pagination: {
                total,
                pages: Math.ceil(total / limit),
                currentPage: page,
            },
        },
    });
});
exports.getInventoryAlerts = getInventoryAlerts;
// Get Inventory Overview Statistics
const getInventoryOverview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    // Get total inventory value
    const totalInventoryValue = yield __1.prismaDB.rawMaterial.aggregate({
        where: {
            restaurantId: outletId,
        },
        _sum: {
            purchasedPricePerItem: true,
        },
    });
    // Get low stock items count
    const lowStockItems = yield __1.prismaDB.rawMaterial.count({
        where: {
            restaurantId: outletId,
            currentStock: {
                lte: __1.prismaDB.rawMaterial.fields.minimumStockLevel,
            },
        },
    });
    // Get active vendors count
    const activeVendors = yield __1.prismaDB.vendor.count({
        where: {
            restaurantId: outletId,
        },
    });
    // Calculate inventory turnover
    // First, get total purchases in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyPurchases = yield __1.prismaDB.purchase.aggregate({
        where: {
            restaurantId: outletId,
            createdAt: {
                gte: thirtyDaysAgo,
            },
            purchaseStatus: "COMPLETED",
        },
        _sum: {
            totalAmount: true,
        },
    });
    // Calculate turnover rate (monthly purchases / current inventory value)
    const turnoverRate = monthlyPurchases._sum.totalAmount &&
        totalInventoryValue._sum.purchasedPricePerItem
        ? (monthlyPurchases._sum.totalAmount /
            totalInventoryValue._sum.purchasedPricePerItem).toFixed(1)
        : 0;
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
    // Get category distribution
    const categoryDistribution = yield __1.prismaDB.rawMaterialCategory.findMany({
        where: {
            restaurantId: outletId,
        },
        include: {
            ramMaterial: {
                select: {
                    purchasedPricePerItem: true,
                    currentStock: true,
                },
            },
        },
    });
    const formattedCategoryDistribution = categoryDistribution.map((category) => ({
        category: category.name,
        value: category.ramMaterial.reduce((sum, item) => sum + (item.purchasedPricePerItem || 0) * (item.currentStock || 0), 0),
    }));
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
    res.json({
        success: true,
        data: {
            totalValue: totalInventoryValue._sum.purchasedPricePerItem || 0,
            lowStockItems,
            turnoverRate: Number(turnoverRate),
            activeVendors,
            stockMovementData: formattedStockMovement,
            categoryDistributionData: formattedCategoryDistribution,
        },
    });
});
exports.getInventoryOverview = getInventoryOverview;
// Get Stock Levels with search, category filter and pagination
const getStockLevels = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { search = "", pageIndex, pageSize } = req.query;
    try {
        const take = Number(pageSize) || 4;
        const skip = Number(pageIndex) * take;
        // Parse the filters from the nested query format
        let categoryFilters = [];
        if (req.query.filters && typeof req.query.filters === "object") {
            const filtersObj = req.query.filters;
            // Check if we have category filter
            if (filtersObj[0] &&
                filtersObj[0].id === "category" &&
                Array.isArray(filtersObj[0].value)) {
                categoryFilters = filtersObj[0].value;
            }
        }
        // Base query conditions
        const baseWhere = Object.assign(Object.assign({ restaurantId: outletId }, (search
            ? {
                name: {
                    contains: search,
                    mode: "insensitive",
                },
            }
            : {})), (categoryFilters.length > 0
            ? {
                OR: categoryFilters.map((category) => ({
                    rawMaterialCategory: {
                        name: category,
                    },
                })),
            }
            : {}));
        // Get categories for filter
        const categories = yield __1.prismaDB.rawMaterialCategory.findMany({
            where: {
                restaurantId: outletId,
            },
            select: {
                name: true,
            },
        });
        const formattedCategories = [...categories.map((c) => c.name)];
        // Get stock items with pagination
        const [items, total] = yield Promise.all([
            __1.prismaDB.rawMaterial.findMany({
                where: baseWhere,
                include: {
                    rawMaterialCategory: true,
                    consumptionUnit: true,
                    minimumStockUnit: true,
                    purchaseItems: {
                        orderBy: {
                            purchase: {
                                createdAt: "desc",
                            },
                        },
                        take: 1,
                        include: {
                            purchase: {
                                select: {
                                    createdAt: true,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    name: "asc",
                },
                skip,
                take,
            }),
            __1.prismaDB.rawMaterial.count({
                where: baseWhere,
            }),
        ]);
        // Format the response data
        const formattedItems = items.map((item) => {
            var _a, _b;
            return ({
                id: item.id,
                name: item.name,
                category: item.rawMaterialCategory.name,
                currentStock: ((_a = item.currentStock) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || 0,
                unit: item.consumptionUnit.name,
                minStockLevel: item.minimumStockLevel || 0,
                minStockUnit: item.minimumStockUnit.name,
                lastPurchasePrice: item.lastPurchasedPrice || item.purchasedPricePerItem || 0,
                lastPurchaseDate: ((_b = item.purchaseItems[0]) === null || _b === void 0 ? void 0 : _b.purchase.createdAt)
                    ? new Date(item.purchaseItems[0].purchase.createdAt)
                        .toISOString()
                        .split("T")[0]
                    : null,
                status: (item.currentStock || 0) <= (item.minimumStockLevel || 0)
                    ? "Critical"
                    : (item.currentStock || 0) <= (item.minimumStockLevel || 0) * 0.5
                        ? "Low"
                        : "Good",
            });
        });
        res.json({
            success: true,
            data: {
                totalCount: total,
                items: formattedItems,
                categories: formattedCategories,
                pagination: {
                    total,
                    pages: Math.ceil(total / take),
                    currentPage: pageIndex,
                },
            },
        });
    }
    catch (error) {
        console.error("Error in getStockLevels:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch stock levels",
        });
    }
});
exports.getStockLevels = getStockLevels;
// Get Purchase Order Statistics and Recent Orders
const getPurchaseOrderStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const today = new Date();
    const thirtyDaysAgo = (0, date_fns_1.subDays)(today, 30);
    const previousMonth = (0, date_fns_1.subMonths)(today, 1);
    // Get pending orders count and value
    const pendingOrders = yield __1.prismaDB.purchase.aggregate({
        where: {
            restaurantId: outletId,
            purchaseStatus: "REQUESTED",
        },
        _count: true,
        _sum: {
            totalAmount: true,
        },
    });
    // Get completed orders this month
    const completedOrders = yield __1.prismaDB.purchase.aggregate({
        where: {
            restaurantId: outletId,
            purchaseStatus: "COMPLETED",
            createdAt: {
                gte: thirtyDaysAgo,
            },
        },
        _count: true,
        _sum: {
            totalAmount: true,
        },
    });
    // Calculate average order value for last 30 days
    const averageOrderValue = completedOrders._count > 0
        ? (completedOrders._sum.totalAmount || 0) / completedOrders._count
        : 0;
    // Get purchase trends for last 6 months
    const purchaseTrends = yield __1.prismaDB.purchase.groupBy({
        by: ["createdAt"],
        where: {
            restaurantId: outletId,
            purchaseStatus: "COMPLETED",
            createdAt: {
                gte: (0, date_fns_1.subMonths)(today, 6),
            },
        },
        _sum: {
            totalAmount: true,
        },
    });
    // Format purchase trends by month
    const monthlyTrends = Array.from({ length: 6 }, (_, i) => {
        const month = (0, date_fns_1.subMonths)(today, i);
        const monthData = purchaseTrends.find((p) => new Date(p.createdAt).getMonth() === month.getMonth());
        return {
            month: month.toLocaleString("default", { month: "short" }),
            amount: (monthData === null || monthData === void 0 ? void 0 : monthData._sum.totalAmount) || 0,
        };
    }).reverse();
    // Get recent purchase orders
    const recentOrders = yield __1.prismaDB.purchase.findMany({
        where: {
            restaurantId: outletId,
        },
        include: {
            vendor: true,
            purchaseItems: true,
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 10,
    });
    // Format recent orders
    const formattedOrders = recentOrders.map((order) => ({
        id: order.invoiceNo,
        vendor: order.vendor.name,
        items: order.purchaseItems.length,
        total: order.totalAmount || 0,
        status: order.purchaseStatus,
        date: order.createdAt.toISOString().split("T")[0],
    }));
    res.json({
        success: true,
        data: {
            stats: {
                pendingOrders: {
                    count: pendingOrders._count,
                    value: pendingOrders._sum.totalAmount || 0,
                },
                completedOrders: {
                    count: completedOrders._count,
                    value: completedOrders._sum.totalAmount || 0,
                },
                averageOrderValue,
            },
            purchaseTrends: monthlyTrends,
            recentOrders: formattedOrders,
        },
    });
});
exports.getPurchaseOrderStats = getPurchaseOrderStats;
// Create new purchase order
const createPurchaseOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { vendorId, items } = req.body;
    try {
        // Generate invoice number
        const latestPO = yield __1.prismaDB.purchase.findFirst({
            where: { restaurantId: outletId },
            orderBy: { createdAt: "desc" },
        });
        const poNumber = latestPO
            ? `PO${String(parseInt(latestPO.invoiceNo.slice(2)) + 1).padStart(3, "0")}`
            : "PO001";
        // Create purchase order with items
        const purchaseOrder = yield __1.prismaDB.purchase.create({
            data: {
                restaurantId: outletId,
                vendorId,
                invoiceNo: poNumber,
                purchaseStatus: "REQUESTED",
                purchaseItems: {
                    create: items.map((item) => ({
                        rawMaterialId: item.rawMaterialId,
                        rawMaterialName: item.name,
                        purchaseUnitId: item.unitId,
                        purchaseUnitName: item.unit,
                        purchaseQuantity: item.quantity,
                        purchasePrice: item.price,
                        totalPrice: item.quantity * item.price,
                    })),
                },
            },
            include: {
                vendor: true,
                purchaseItems: true,
            },
        });
        res.json({
            success: true,
            data: purchaseOrder,
        });
    }
    catch (error) {
        console.error("Error in createPurchaseOrder:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create purchase order",
        });
    }
});
exports.createPurchaseOrder = createPurchaseOrder;
// Get purchase order details
const getPurchaseOrderDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, orderId } = req.params;
    try {
        const order = yield __1.prismaDB.purchase.findFirst({
            where: {
                restaurantId: outletId,
                invoiceNo: orderId,
            },
            include: {
                vendor: true,
                purchaseItems: {
                    include: {
                        purchaseUnit: true,
                        rawMaterial: true,
                    },
                },
            },
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                error: "Purchase order not found",
            });
        }
        res.json({
            success: true,
            data: order,
        });
    }
    catch (error) {
        console.error("Error in getPurchaseOrderDetails:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch purchase order details",
        });
    }
});
exports.getPurchaseOrderDetails = getPurchaseOrderDetails;
const getVendorStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { search = "" } = req.query;
    // Get total vendors count
    const totalVendors = yield __1.prismaDB.vendor.count({
        where: {
            restaurantId: outletId,
        },
    });
    // Get active orders count
    const activeOrders = yield __1.prismaDB.purchase.count({
        where: {
            restaurantId: outletId,
            purchaseStatus: {
                in: ["REQUESTED", "PROCESSED", "ACCEPTED"],
            },
        },
    });
    // Calculate average response time (time between REQUESTED and ACCEPTED status)
    const orders = yield __1.prismaDB.purchase.findMany({
        where: {
            restaurantId: outletId,
            purchaseStatus: "ACCEPTED",
            createdAt: {
                gte: (0, date_fns_1.subDays)(new Date(), 30), // Last 30 days
            },
        },
        select: {
            createdAt: true,
            updatedAt: true,
        },
    });
    const avgResponseTime = orders.length > 0
        ? orders.reduce((acc, order) => {
            const diff = order.updatedAt.getTime() - order.createdAt.getTime();
            return acc + diff;
        }, 0) /
            orders.length /
            (1000 * 60 * 60 * 24) // Convert to days
        : 0;
    // Get monthly spend
    const monthlySpend = yield __1.prismaDB.purchase.aggregate({
        where: {
            restaurantId: outletId,
            purchaseStatus: "COMPLETED",
            createdAt: {
                gte: (0, date_fns_1.startOfMonth)(new Date()),
            },
        },
        _sum: {
            totalAmount: true,
        },
    });
    // Get purchase history for last 6 months
    const purchaseHistory = yield __1.prismaDB.purchase.groupBy({
        by: ["createdAt"],
        where: {
            restaurantId: outletId,
            purchaseStatus: "COMPLETED",
            createdAt: {
                gte: (0, date_fns_1.subMonths)(new Date(), 6),
            },
        },
        _sum: {
            totalAmount: true,
        },
    });
    // Format purchase history
    const formattedHistory = Array.from({ length: 6 }, (_, i) => {
        const month = (0, date_fns_1.subMonths)(new Date(), i);
        const monthData = purchaseHistory.find((p) => new Date(p.createdAt).getMonth() === month.getMonth());
        return {
            month: month.toLocaleString("default", { month: "short" }),
            amount: (monthData === null || monthData === void 0 ? void 0 : monthData._sum.totalAmount) || 0,
        };
    }).reverse();
    // Get vendors list with their performance metrics
    const vendors = yield __1.prismaDB.vendor.findMany({
        where: {
            restaurantId: outletId,
            name: {
                contains: search,
                mode: "insensitive",
            },
        },
        include: {
            purchases: {
                where: {
                    purchaseStatus: "COMPLETED",
                },
                orderBy: {
                    createdAt: "desc",
                },
                take: 1,
            },
        },
    });
    // Calculate vendor metrics
    const vendorsWithMetrics = yield Promise.all(vendors.map((vendor) => __awaiter(void 0, void 0, void 0, function* () {
        var _t;
        // Get total orders
        const totalOrders = yield __1.prismaDB.purchase.count({
            where: {
                vendorId: vendor.id,
                purchaseStatus: "COMPLETED",
            },
        });
        // Calculate average rating (you might need to add a rating system to your schema)
        const rating = 4.5; // Placeholder - implement actual rating logic
        return {
            id: vendor.id,
            name: vendor.name,
            category: "Missing", // You might want to add category to your vendor schema
            contact: "Missing", // Add to schema if needed
            phone: "Missing", // Add to schema if needed
            email: "Missing", // Add to schema if needed
            totalOrders,
            lastOrder: ((_t = vendor.purchases[0]) === null || _t === void 0 ? void 0 : _t.createdAt.toISOString().split("T")[0]) || null,
            rating,
            status: "ACTIVE", // Add status field to schema if needed
            createdAt: vendor.createdAt,
            updatedAt: vendor.updatedAt,
        };
    })));
    res.json({
        success: true,
        data: {
            stats: {
                totalVendors,
                activeOrders,
                avgResponseTime: Number(avgResponseTime.toFixed(1)),
                monthlySpend: monthlySpend._sum.totalAmount || 0,
            },
            purchaseHistory: formattedHistory,
            vendors: vendorsWithMetrics,
        },
    });
});
exports.getVendorStats = getVendorStats;
const getPOSDashboardStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _u;
    const { outletId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!getOutlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const totalRawMaterials = yield __1.prismaDB.rawMaterial.count({
        where: {
            restaurantId: outletId,
            currentStock: {
                gt: 0,
            },
        },
    });
    const totalCategories = yield __1.prismaDB.rawMaterialCategory.count({
        where: {
            restaurantId: outletId,
        },
    });
    const totalSales = yield __1.prismaDB.order.aggregate({
        where: {
            restaurantId: outletId,
            orderStatus: "COMPLETED",
            createdAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
                lt: new Date(new Date().setHours(23, 59, 59, 999)),
            },
        },
        _sum: {
            totalAmount: true,
        },
    });
    const yesterdaySales = yield __1.prismaDB.order.aggregate({
        where: {
            restaurantId: outletId,
            orderStatus: "COMPLETED",
            createdAt: {
                gte: (0, date_fns_1.subDays)(new Date(), 1),
                lt: new Date(),
            },
        },
        _sum: {
            totalAmount: true,
        },
    });
    const recentStockPurchases = yield __1.prismaDB.purchase.findMany({
        where: {
            restaurantId: outletId,
            purchaseStatus: "COMPLETED",
            createdAt: {
                gte: (0, date_fns_1.subDays)(new Date(), 1),
                lte: new Date(),
            },
        },
        orderBy: {
            updatedAt: "desc",
        },
    });
    res.json({
        success: true,
        data: {
            inventory: {
                totalRawMaterials,
                totalCategories,
            },
            sales: {
                totalSales: totalSales._sum.totalAmount || 0,
                yesterdayChange: calculatePercentageChange(yesterdaySales._sum.totalAmount || 0, totalSales._sum.totalAmount || 0),
                yesterdaySales: yesterdaySales._sum.totalAmount || 0,
            },
            stock: {
                recentStockPurchases: recentStockPurchases.length,
                lastUpdateTime: (_u = recentStockPurchases[0]) === null || _u === void 0 ? void 0 : _u.updatedAt.toISOString(),
            },
        },
    });
});
exports.getPOSDashboardStats = getPOSDashboardStats;
const orderAndStockDeduction = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!getOutlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const page = parseInt(req.query.page || "0");
    const pageSize = parseInt(req.query.pageSize || "3");
    const skip = page * pageSize;
    // Get orders with their items and recipes
    const orders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outletId,
            active: true,
        },
        select: {
            id: true,
            generatedOrderId: true,
            createdAt: true,
            totalAmount: true,
            orderItems: {
                select: {
                    id: true,
                    quantity: true,
                    menuItem: {
                        select: {
                            name: true,
                            itemRecipe: {
                                select: {
                                    ingredients: {
                                        select: {
                                            quantity: true,
                                            rawMaterial: {
                                                select: {
                                                    name: true,
                                                    currentStock: true,
                                                    consumptionUnit: {
                                                        select: {
                                                            name: true,
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
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        take: pageSize,
        skip: skip,
    });
    // Transform the data to include stock deductions
    const stockDeductions = orders.map((order) => ({
        id: order.id,
        orderId: order.generatedOrderId,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        items: order.orderItems.map((item) => {
            var _a;
            return ({
                name: item.menuItem.name,
                quantity: item.quantity,
                ingredients: ((_a = item.menuItem.itemRecipe) === null || _a === void 0 ? void 0 : _a.ingredients.map((ingredient) => ({
                    name: ingredient.rawMaterial.name,
                    deductedAmount: ingredient.quantity * item.quantity,
                    currentStock: ingredient.rawMaterial.currentStock,
                    unit: ingredient.rawMaterial.consumptionUnit.name,
                }))) || [],
            });
        }),
    }));
    // Get total count for pagination
    const totalCount = yield __1.prismaDB.order.count({
        where: {
            restaurantId: outletId,
            active: true,
        },
    });
    res.json({
        items: stockDeductions,
        pagination: {
            total: totalCount,
            pageSize,
            page,
        },
    });
});
exports.orderAndStockDeduction = orderAndStockDeduction;
