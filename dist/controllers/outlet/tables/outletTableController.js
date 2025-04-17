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
exports.createBulkTables = exports.transferTableOrder = exports.markTableAsUnoccupied = exports.getTableCurrentOrders = exports.getTableByUniqueId = exports.verifyTable = exports.connectTable = exports.deleteArea = exports.updateArea = exports.createArea = exports.deleteTable = exports.updateTable = exports.createTable = exports.getAllAreas = exports.getAllTables = exports.getAllAreasForTable = exports.getAllTablesForTable = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const redis_1 = require("../../../services/redis");
const bad_request_1 = require("../../../exceptions/bad-request");
const get_tables_1 = require("../../../lib/outlet/get-tables");
const orderOutletController_1 = require("../order/orderOutletController");
const utils_1 = require("../../../lib/utils");
const zod_1 = require("zod");
const getAllTablesForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    const totalCount = yield __1.prismaDB.table.count({
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const tables = yield __1.prismaDB.table.findMany({
        skip,
        take,
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
            name: true,
            areaId: true,
            qrcode: true,
            uniqueId: true,
            shortCode: true,
            areas: {
                select: {
                    name: true,
                },
            },
            capacity: true,
            occupied: true,
        },
        orderBy,
    });
    const formattedTable = tables === null || tables === void 0 ? void 0 : tables.map((table) => {
        var _a;
        return ({
            id: table === null || table === void 0 ? void 0 : table.id,
            name: table === null || table === void 0 ? void 0 : table.name,
            areaId: table === null || table === void 0 ? void 0 : table.areaId,
            qrcode: table === null || table === void 0 ? void 0 : table.qrcode,
            uniqueId: table === null || table === void 0 ? void 0 : table.uniqueId,
            shortCode: table === null || table === void 0 ? void 0 : table.shortCode,
            area: (_a = table === null || table === void 0 ? void 0 : table.areas) === null || _a === void 0 ? void 0 : _a.name,
            capacity: table === null || table === void 0 ? void 0 : table.capacity,
            occupied: table === null || table === void 0 ? void 0 : table.occupied,
        });
    });
    return res.json({
        success: true,
        data: {
            totalCount,
            tables: formattedTable,
        },
        message: "Fetched ✅",
    });
});
exports.getAllTablesForTable = getAllTablesForTable;
const getAllAreasForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
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
    const totalCount = yield __1.prismaDB.areas.count({
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const areas = yield ((_a = __1.prismaDB === null || __1.prismaDB === void 0 ? void 0 : __1.prismaDB.areas) === null || _a === void 0 ? void 0 : _a.findMany({
        skip,
        take,
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy,
    }));
    return res.json({
        success: true,
        data: { totalCount, areas: areas },
        message: "Powered Up ",
    });
});
exports.getAllAreasForTable = getAllAreasForTable;
const getAllTables = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const rTables = yield redis_1.redis.get(`tables-${outletId}`);
    if (rTables) {
        return res.json({
            success: true,
            tables: JSON.parse(rTables),
            message: "Powered In ",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const tables = yield (0, get_tables_1.getFetchAllTablesToRedis)(outlet.id);
    return res.json({
        success: true,
        tables,
        message: "Fetched ✅",
    });
});
exports.getAllTables = getAllTables;
const getAllAreas = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const rAreas = yield redis_1.redis.get(`a-${outletId}`);
    if (rAreas) {
        return res.json({
            success: true,
            areas: JSON.parse(rAreas),
            message: "Powered In ",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const allAreas = yield (0, get_tables_1.getFetchAllAreastoRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
    return res.json({
        success: true,
        areas: allAreas,
        message: "Powered Up ",
    });
});
exports.getAllAreas = getAllAreas;
const createTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const { name, shortCode, capacity, qrcode, uniqueId, areaId } = req.body;
    if (!name) {
        throw new bad_request_1.BadRequestsException("Table Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!capacity) {
        throw new bad_request_1.BadRequestsException("Capacity is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!shortCode) {
        throw new bad_request_1.BadRequestsException("ShortCode for Table Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!areaId) {
        throw new bad_request_1.BadRequestsException("Area type is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const slug = (0, utils_1.generateSlug)(name);
    // Check if table with same slug already exists
    const existingTable = yield __1.prismaDB.table.findFirst({
        where: {
            restaurantId: getOutlet.id,
            slug: slug,
        },
    });
    if (existingTable) {
        throw new bad_request_1.BadRequestsException("A table with this name already exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.table.create({
        data: {
            name,
            slug: slug,
            capacity,
            uniqueId,
            shortCode,
            areaId,
            qrcode,
            restaurantId: getOutlet.id,
        },
    });
    yield (0, get_tables_1.getFetchAllTablesToRedis)(getOutlet.id);
    return res.json({
        success: true,
        message: "Table Created ✅",
    });
});
exports.createTable = createTable;
const generateFileName = (bytes = 32) => {
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return Array.from(array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};
const updateTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, tableId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const table = yield __1.prismaDB.table.findFirst({
        where: {
            id: tableId,
            restaurantId: getOutlet.id,
        },
    });
    if (!(table === null || table === void 0 ? void 0 : table.id)) {
        throw new not_found_1.NotFoundException("Table Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const { name, shortCode, capacity, qrcode, uniqueId, areaId } = req.body;
    if (!name) {
        throw new bad_request_1.BadRequestsException("Table Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!capacity) {
        throw new bad_request_1.BadRequestsException("Capacity is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!shortCode) {
        throw new bad_request_1.BadRequestsException("ShortCode for Table Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!areaId) {
        throw new bad_request_1.BadRequestsException("Area type is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const slug = (0, utils_1.generateSlug)(name);
    // Check if another table has the same slug (excluding current table)
    const existingTable = yield __1.prismaDB.table.findFirst({
        where: {
            restaurantId: getOutlet.id,
            slug: slug,
            id: {
                not: tableId,
            },
        },
    });
    if (existingTable) {
        throw new bad_request_1.BadRequestsException("A table with this name already exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.table.updateMany({
        where: {
            id: table.id,
        },
        data: {
            name,
            slug: slug,
            capacity,
            shortCode,
            areaId,
            qrcode,
        },
    });
    yield (0, get_tables_1.getFetchAllTablesToRedis)(getOutlet.id);
    return res.json({
        success: true,
        message: "Table Updated Success ✅",
    });
});
exports.updateTable = updateTable;
const deleteTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, tableId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const table = yield __1.prismaDB.table.findFirst({
        where: {
            id: tableId,
            restaurantId: getOutlet.id,
        },
    });
    if (!(table === null || table === void 0 ? void 0 : table.id)) {
        throw new not_found_1.NotFoundException("Table Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.table.delete({
        where: {
            id: table.id,
            restaurantId: getOutlet.id,
        },
    });
    yield (0, get_tables_1.getFetchAllTablesToRedis)(getOutlet.id);
    return res.json({
        success: true,
        message: "Table Delleted Success ✅",
    });
});
exports.deleteTable = deleteTable;
const createArea = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const { name } = req.body;
    if (!name) {
        throw new bad_request_1.BadRequestsException("Area Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.areas.create({
        data: {
            name,
            slug: (0, utils_1.generateSlug)(name),
            restaurantId: getOutlet.id,
        },
    });
    yield (0, get_tables_1.getFetchAllAreastoRedis)(getOutlet.id);
    return res.json({
        success: true,
        message: "Area Created ✅",
    });
});
exports.createArea = createArea;
const updateArea = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, areaId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const area = yield __1.prismaDB.areas.findFirst({
        where: {
            id: areaId,
            restaurantId: getOutlet.id,
        },
    });
    if (!(area === null || area === void 0 ? void 0 : area.id)) {
        throw new not_found_1.NotFoundException("Area Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const { name } = req.body;
    if (!name) {
        throw new bad_request_1.BadRequestsException("Area Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.areas.updateMany({
        where: {
            id: area.id,
        },
        data: {
            name,
        },
    });
    yield (0, get_tables_1.getFetchAllAreastoRedis)(getOutlet.id);
    return res.json({
        success: true,
        message: "Area Updated Success ✅",
    });
});
exports.updateArea = updateArea;
const deleteArea = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, areaId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const area = yield __1.prismaDB.areas.findFirst({
        where: {
            id: areaId,
            restaurantId: getOutlet.id,
        },
    });
    if (!(area === null || area === void 0 ? void 0 : area.id)) {
        throw new not_found_1.NotFoundException("Area Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.areas.delete({
        where: {
            id: area.id,
            restaurantId: getOutlet.id,
        },
    });
    yield (0, get_tables_1.getFetchAllAreastoRedis)(getOutlet.id);
    return res.json({
        success: true,
        message: "Area Delleted Success ✅",
    });
});
exports.deleteArea = deleteArea;
const connectTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, tableId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const _table = yield __1.prismaDB.table.findFirst({
        where: {
            id: tableId,
            restaurantId: getOutlet.id,
        },
    });
    if (!(_table === null || _table === void 0 ? void 0 : _table.id)) {
        throw new not_found_1.NotFoundException("Table Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const inviteCodes = (0, orderOutletController_1.inviteCode)();
    const table = yield __1.prismaDB.table.updateMany({
        where: {
            id: _table.id,
            restaurantId: getOutlet.id,
        },
        data: {
            inviteCode: inviteCodes,
        },
    });
    yield (0, get_tables_1.getFetchAllAreastoRedis)(getOutlet.id);
    yield (0, get_tables_1.getFetchAllTablesToRedis)(getOutlet.id);
    return res.json({ success: true, inviteCode: inviteCodes });
});
exports.connectTable = connectTable;
const verifyTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, tableId } = req.params;
    const { uniqueCode } = req.body;
    if (!uniqueCode) {
        throw new bad_request_1.BadRequestsException("Code Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const table = yield __1.prismaDB.table.findFirst({
        where: {
            id: tableId,
            restaurantId: getOutlet.id,
        },
    });
    if (!(table === null || table === void 0 ? void 0 : table.id)) {
        throw new not_found_1.NotFoundException("Table Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    if (table.inviteCode === null || table.inviteCode === undefined) {
        console.log("Table has no inviteCode");
        throw new not_found_1.NotFoundException("Table has no invite code set", root_1.ErrorCode.NOT_FOUND);
        // Decide how to handle this case. For example:
    }
    const trimmedTableCode = table.inviteCode.trim();
    const trimmedUniqueCode = uniqueCode.trim();
    console.log(trimmedTableCode, trimmedUniqueCode);
    if (trimmedTableCode === trimmedUniqueCode) {
        yield (0, get_tables_1.getFetchAllAreastoRedis)(getOutlet.id);
        yield (0, get_tables_1.getFetchAllTablesToRedis)(getOutlet.id);
        return res.json({
            success: true,
            message: "verified",
            customerId: table.customerId,
            inviteCode: table.inviteCode,
        });
    }
    throw new not_found_1.NotFoundException("Invalid Code", root_1.ErrorCode.NOT_FOUND);
});
exports.verifyTable = verifyTable;
const getTableByUniqueId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, uniqueId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const table = yield __1.prismaDB.table.findFirst({
        where: {
            restaurantId: getOutlet.id,
            uniqueId: uniqueId,
        },
    });
    return res.json({ success: true, table });
});
exports.getTableByUniqueId = getTableByUniqueId;
const getTableCurrentOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { outletId, tableId, customerId } = req.params;
    // @ts-ignore
    if (customerId !== ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    const validCustomer = yield __1.prismaDB.customerRestaurantAccess.findFirst({
        where: {
            customerId: customerId,
        },
    });
    if (!(validCustomer === null || validCustomer === void 0 ? void 0 : validCustomer.id)) {
        throw new bad_request_1.BadRequestsException("You Need to login again", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const table = yield __1.prismaDB.table.findFirst({
        where: {
            id: tableId,
            restaurantId: getOutlet.id,
        },
    });
    if (!(table === null || table === void 0 ? void 0 : table.id)) {
        throw new not_found_1.NotFoundException("Table Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const getTableOrders = yield __1.prismaDB.table.findFirst({
        where: {
            id: table.id,
            restaurantId: getOutlet.id,
        },
        include: {
            orderSession: {
                where: {
                    id: table.currentOrderSessionId,
                },
                include: {
                    orders: {
                        include: {
                            orderItems: {
                                include: {
                                    menuItem: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    const formattedOrders = {
        id: getTableOrders === null || getTableOrders === void 0 ? void 0 : getTableOrders.orderSession[0].id,
        tableId: getTableOrders === null || getTableOrders === void 0 ? void 0 : getTableOrders.orderSession[0].tableId,
        orders: getTableOrders === null || getTableOrders === void 0 ? void 0 : getTableOrders.orderSession[0].orders.map((orderItem) => ({
            id: orderItem.id,
            dineType: orderItem.orderType,
            orderStatus: orderItem.orderStatus,
            orderItems: orderItem.orderItems.map((foodItem) => ({
                id: foodItem.id,
                name: foodItem.name,
                type: foodItem.menuItem.type,
                quantity: foodItem.quantity,
                basePrice: foodItem.originalRate,
                price: foodItem.totalPrice,
            })),
            totalAmount: orderItem.totalAmount,
        })),
    };
    return res.json({
        success: true,
        orders: formattedOrders,
    });
});
exports.getTableCurrentOrders = getTableCurrentOrders;
const markTableAsUnoccupied = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, tableId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const table = yield __1.prismaDB.table.findFirst({
        where: {
            id: tableId,
            restaurantId: getOutlet.id,
        },
    });
    if (!(table === null || table === void 0 ? void 0 : table.id)) {
        throw new not_found_1.NotFoundException("Table Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    if (table.currentOrderSessionId !== null) {
        throw new bad_request_1.BadRequestsException("Table has an active order session", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.table.updateMany({
        where: {
            id: table.id,
        },
        data: {
            occupied: false,
            currentOrderSessionId: null,
            inviteCode: null,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`tables-${getOutlet.id}`),
        redis_1.redis.del(`a-${getOutlet.id}`),
    ]);
    return res.json({ success: true, message: "Table marked as unoccupied" });
});
exports.markTableAsUnoccupied = markTableAsUnoccupied;
const tableTransferSchema = zod_1.z.object({
    transferTableId: zod_1.z.string({
        required_error: "Transfer Table ID is required",
    }),
});
const transferTableOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, tableId } = req.params;
    const { data, error } = tableTransferSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const table = yield __1.prismaDB.table.findFirst({
        where: { id: tableId, restaurantId: getOutlet.id },
    });
    if (!(table === null || table === void 0 ? void 0 : table.id)) {
        throw new not_found_1.NotFoundException("Table Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const transferTable = yield __1.prismaDB.table.findFirst({
        where: {
            id: data.transferTableId,
            restaurantId: getOutlet.id,
            occupied: false,
        },
    });
    if (!(transferTable === null || transferTable === void 0 ? void 0 : transferTable.id)) {
        throw new not_found_1.NotFoundException("Transfer Table Not Found / Table is Occupied", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        yield tx.table.updateMany({
            where: { id: transferTable.id },
            data: {
                currentOrderSessionId: table.currentOrderSessionId,
                occupied: true,
                inviteCode: (0, orderOutletController_1.inviteCode)(),
            },
        });
        yield tx.table.updateMany({
            where: { id: table.id },
            data: {
                occupied: false,
                currentOrderSessionId: null,
                inviteCode: null,
            },
        });
        const findOrderSession = yield tx.orderSession.findFirst({
            where: { id: table.currentOrderSessionId },
        });
        if (!(findOrderSession === null || findOrderSession === void 0 ? void 0 : findOrderSession.id)) {
            throw new not_found_1.NotFoundException("No Order Session Found, you can mark table as unoccupied", root_1.ErrorCode.NOT_FOUND);
        }
        // updateOrdersession
        yield tx.orderSession.update({
            where: { id: findOrderSession.id },
            data: {
                tableId: transferTable.id,
            },
        });
    }));
    yield Promise.all([
        redis_1.redis.del(`active-os-${outletId}`),
        redis_1.redis.del(`liv-o-${outletId}`),
        redis_1.redis.del(`tables-${outletId}`),
        redis_1.redis.del(`a-${outletId}`),
        redis_1.redis.del(`o-n-${outletId}`),
        redis_1.redis.del(`${outletId}-stocks`),
    ]);
    return res.json({ success: true, message: "Table Order Transferred" });
});
exports.transferTableOrder = transferTableOrder;
const createBulkTables = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const { tables } = req.body;
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
        throw new bad_request_1.BadRequestsException("Tables array is required and must not be empty", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Validate each table in the array
    for (const table of tables) {
        if (!table.name) {
            throw new bad_request_1.BadRequestsException("Table Name is Required for all tables", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        if (!table.capacity) {
            throw new bad_request_1.BadRequestsException("Capacity is Required for all tables", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        if (!table.shortCode) {
            throw new bad_request_1.BadRequestsException("ShortCode for Table Name is Required for all tables", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        if (!table.areaId) {
            throw new bad_request_1.BadRequestsException("Area type is Required for all tables", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    // Generate slugs and check for duplicates
    const slugs = new Set();
    const tablesWithSlugs = tables.map((table) => {
        const slug = (0, utils_1.generateSlug)(table.name);
        if (slugs.has(slug)) {
            throw new bad_request_1.BadRequestsException("Duplicate table names are not allowed", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        slugs.add(slug);
        return Object.assign(Object.assign({}, table), { slug });
    });
    // Check if any of the slugs already exist in the database
    const existingTables = yield __1.prismaDB.table.findMany({
        where: {
            restaurantId: getOutlet.id,
            slug: {
                in: Array.from(slugs),
            },
        },
    });
    if (existingTables.length > 0) {
        throw new bad_request_1.BadRequestsException("Some table names already exist", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Create all tables in a transaction
    yield __1.prismaDB.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        for (const table of tablesWithSlugs) {
            yield tx.table.create({
                data: {
                    name: table.name,
                    slug: table.slug,
                    capacity: table.capacity,
                    uniqueId: generateFileName(),
                    shortCode: table.shortCode,
                    areaId: table.areaId,
                    qrcode: table.qrcode || null,
                    restaurantId: getOutlet.id,
                },
            });
        }
    }));
    // Update Redis cache
    yield redis_1.redis.del(`tables-${outletId}`);
    return res.json({
        success: true,
        message: `${tables.length} Tables Created Successfully ✅`,
    });
});
exports.createBulkTables = createBulkTables;
