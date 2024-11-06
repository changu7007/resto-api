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
exports.outletTopSellingItems = exports.orderStatsForOutletByStaff = exports.orderStatsForOutlet = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const utils_1 = require("../../../lib/utils");
const get_users_1 = require("../../../lib/get-users");
const orderStatsForOutlet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
exports.orderStatsForOutlet = orderStatsForOutlet;
const orderStatsForOutletByStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { outletId } = req.params;
    const { period } = req.query;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    //@ts-ignore
    const staff = yield (0, get_users_1.getStaffById)(outlet.id, (_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
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
                imageUrl: item.menuItem.images[0].url, // Adjust as needed
            };
        }
        aggregated[foodId].orders += Number(item.quantity);
        aggregated[foodId].revenue += Number(item.price);
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
