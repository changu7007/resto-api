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
exports.getTableCurrentOrders = exports.getTableByUniqueId = exports.verifyTable = exports.connectTable = exports.deleteArea = exports.updateArea = exports.createArea = exports.deleteTable = exports.updateTable = exports.createTable = exports.getAllAreas = exports.getAllTables = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const redis_1 = require("../../../services/redis");
const bad_request_1 = require("../../../exceptions/bad-request");
const get_tables_1 = require("../../../lib/outlet/get-tables");
const orderOutletController_1 = require("../order/orderOutletController");
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
    yield __1.prismaDB.table.create({
        data: {
            name,
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
    yield __1.prismaDB.table.updateMany({
        where: {
            id: table.id,
        },
        data: {
            name,
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
    const table = yield __1.prismaDB.table.updateMany({
        where: {
            id: _table.id,
            restaurantId: getOutlet.id,
        },
        data: {
            inviteCode: (0, orderOutletController_1.inviteCode)(),
        },
    });
    yield (0, get_tables_1.getFetchAllAreastoRedis)(getOutlet.id);
    yield (0, get_tables_1.getFetchAllTablesToRedis)(getOutlet.id);
    return res.json({ success: true, table });
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
    if (!table.customerId) {
        throw new not_found_1.NotFoundException("No Table user found, Scan QR again Please", root_1.ErrorCode.NOT_FOUND);
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
    var _a;
    const { outletId, tableId, customerId } = req.params;
    // @ts-ignore
    if (customerId !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    const validCustomer = yield __1.prismaDB.customer.findFirst({
        where: {
            id: customerId,
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
            customerId: validCustomer.id,
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
                name: foodItem.menuItem.name,
                type: foodItem.menuItem.type,
                quantity: foodItem.quantity,
                basePrice: foodItem.menuItem.price,
                price: foodItem.price,
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