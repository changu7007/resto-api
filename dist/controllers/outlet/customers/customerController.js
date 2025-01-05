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
exports.getAllCustomer = exports.getCustomersForTable = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const redis_1 = require("../../../services/redis");
const getCustomersForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.customer.count({
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const getCustomers = yield __1.prismaDB.customer.findMany({
        skip,
        take,
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        include: {
            orderSession: true,
        },
        orderBy,
    });
    const formattedCustomers = getCustomers === null || getCustomers === void 0 ? void 0 : getCustomers.map((staff) => {
        var _a;
        return ({
            id: staff === null || staff === void 0 ? void 0 : staff.id,
            name: staff === null || staff === void 0 ? void 0 : staff.name,
            email: staff === null || staff === void 0 ? void 0 : staff.email,
            phoneNo: staff === null || staff === void 0 ? void 0 : staff.phoneNo,
            orders: (_a = staff === null || staff === void 0 ? void 0 : staff.orderSession) === null || _a === void 0 ? void 0 : _a.length,
            createdAt: staff === null || staff === void 0 ? void 0 : staff.createdAt,
        });
    });
    return res.json({
        success: true,
        data: {
            totalCount: totalCount,
            customers: formattedCustomers,
        },
        message: "Fetched Items by database ✅",
    });
});
exports.getCustomersForTable = getCustomersForTable;
const getAllCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisCustomers = yield redis_1.redis.get(`customers-${outletId}`);
    if (redisCustomers) {
        return res.json({
            success: true,
            customers: JSON.parse(redisCustomers),
            message: "Powered In",
        });
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const customers = yield (0, outlet_1.getOutletCustomerAndFetchToRedis)(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id);
    return res.json({
        success: true,
        customers: customers,
    });
});
exports.getAllCustomer = getAllCustomer;
