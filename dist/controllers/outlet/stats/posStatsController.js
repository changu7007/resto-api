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
exports.getInventoryAlerts = exports.getStaffPerformance = exports.getPopularItems = exports.getPosStats = void 0;
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
    return ((current - previous) / previous) * 100;
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
            updatedAt: {
                gte: lastMonth,
                lte: today,
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
                    orderStatus: "COMPLETED",
                    updatedAt: {
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
                        orderStatus: { $eq: "COMPLETED" },
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
                        orderStatus: "COMPLETED",
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
                updatedAt: {
                    gte: (0, date_fns_1.startOfDay)(new Date()),
                },
            },
            _count: true,
        });
        const yesterday = yield __1.prismaDB.order.groupBy({
            by: ["orderType"],
            where: {
                restaurantId: outletId,
                updatedAt: {
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
    res.json({
        success: true,
        data: {
            totalSalesRevenue: {
                amount: currentRevenue._sum.totalAmount || 0,
                percentageChange: calculatePercentageChange(currentRevenue._sum.totalAmount || 0, previousRevenue._sum.totalAmount || 0),
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
                growth,
                todays: todayOrdersByHour,
                daily: dailyStats,
                weekly: weeklyStats,
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
