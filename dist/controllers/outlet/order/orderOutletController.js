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
exports.printKotOrder = exports.inviteCode = exports.getAllOrderByStaff = exports.orderStatusPatch = exports.existingOrderPatchApp = exports.existingOrderPatch = exports.postOrderForUser = exports.postOrderForStaf = exports.postOrderForOwner = exports.getTodayOrdersCount = exports.getAllOrders = exports.getAllSessionOrders = exports.getAllActiveSessionOrders = exports.getLiveOrders = void 0;
const client_1 = require("@prisma/client");
const __1 = require("../../..");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const outlet_1 = require("../../../lib/outlet");
const bad_request_1 = require("../../../exceptions/bad-request");
const get_users_1 = require("../../../lib/get-users");
const redis_1 = require("../../../services/redis");
const ws_1 = require("../../../services/ws");
const get_order_1 = require("../../../lib/outlet/get-order");
const get_tables_1 = require("../../../lib/outlet/get-tables");
const firebase_1 = require("../../../services/firebase");
const getLiveOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisLiveOrder = yield redis_1.redis.get(`liv-o-${outletId}`);
    if (redisLiveOrder) {
        return res.json({
            success: true,
            liveOrders: JSON.parse(redisLiveOrder),
            message: "FETCHED UP ⚡",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const liveOrders = yield (0, get_order_1.getFetchLiveOrderToRedis)(outlet.id);
    return res.json({
        success: true,
        liveOrders,
        message: "Fetching ✅",
    });
});
exports.getLiveOrders = getLiveOrders;
const getAllActiveSessionOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisOrderActiveSession = yield redis_1.redis.get(`active-os-${outletId}`);
    if (redisOrderActiveSession) {
        return res.json({
            success: true,
            activeOrders: JSON.parse(redisOrderActiveSession),
            message: "FETCHED UP ⚡",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const activeOrders = yield (0, get_order_1.getFetchActiveOrderSessionToRedis)(outlet.id);
    return res.json({
        success: true,
        activeOrders: activeOrders,
        message: "Fetched ✅",
    });
});
exports.getAllActiveSessionOrders = getAllActiveSessionOrders;
const getAllSessionOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisAllOrderSession = yield redis_1.redis.get(`all-os-${outletId}`);
    if (redisAllOrderSession) {
        return res.json({
            success: true,
            activeOrders: JSON.parse(redisAllOrderSession),
            message: "Fetched ✅",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const activeOrders = yield (0, get_order_1.getFetchAllOrderSessionToRedis)(outlet.id);
    return res.json({
        success: true,
        activeOrders,
        message: "Fetched ✅",
    });
});
exports.getAllSessionOrders = getAllSessionOrders;
const getAllOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisAllOrder = yield redis_1.redis.get(`all-orders-${outletId}`);
    if (redisAllOrder) {
        return res.json({
            success: true,
            orders: JSON.parse(redisAllOrder),
            message: "Fetched UP ⚡",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getOrders = yield (0, get_order_1.getFetchAllOrdersToRedis)(outlet.id);
    return res.json({
        success: true,
        orders: getOrders,
        message: "Fetched ✅",
    });
});
exports.getAllOrders = getAllOrders;
const getTodayOrdersCount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const getOrdersCount = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            createdAt: {
                gte: startOfDay,
                lt: endOfDay,
            },
        },
    });
    const length = getOrdersCount.length;
    return res.status(200).json({
        success: true,
        length,
        message: "Fetched Successfully",
    });
});
exports.getTodayOrdersCount = getTodayOrdersCount;
const postOrderForOwner = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { outletId } = req.params;
    const validTypes = Object.values(client_1.OrderType);
    const { adminId, username, isPaid, phoneNo, orderType, totalAmount, orderItems, tableId, orderMode, } = req.body;
    // @ts-ignore
    if (adminId !== ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findUser = yield __1.prismaDB.user.findFirst({
        where: {
            id: adminId,
        },
    });
    if (!(findUser === null || findUser === void 0 ? void 0 : findUser.id)) {
        throw new bad_request_1.BadRequestsException("You Need to login & place the order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (orderType === "DINEIN" && !tableId) {
        throw new bad_request_1.BadRequestsException("Please Assign the table , if you have choose order type has DINEIN", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validTypes.includes(orderType)) {
        throw new bad_request_1.BadRequestsException("Please Select Order Type", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!outletId) {
        throw new bad_request_1.BadRequestsException("Outlet Id is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const orderId = yield (0, outlet_1.generatedOrderId)(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id);
    const billNo = yield (0, outlet_1.generateBillNo)(getOutlet.id);
    const orderStatus = orderMode === "KOT"
        ? "INCOMMING"
        : orderMode === "EXPRESS"
            ? "FOODREADY"
            : "SERVED";
    const orderSession = yield __1.prismaDB.orderSession.create({
        data: {
            billId: billNo,
            orderType: orderType,
            username: username !== null && username !== void 0 ? username : findUser.name,
            phoneNo: phoneNo !== null && phoneNo !== void 0 ? phoneNo : null,
            adminId: findUser.id,
            tableId: tableId,
            isPaid: isPaid,
            restaurantId: getOutlet.id,
            orders: {
                create: {
                    restaurantId: getOutlet.id,
                    isPaid: isPaid,
                    active: true,
                    orderStatus: orderStatus,
                    totalAmount: totalAmount.toString(),
                    generatedOrderId: orderId,
                    orderType: orderType,
                    orderItems: {
                        create: orderItems.map((item) => ({
                            menuId: item.menuId,
                            quantity: item.quantity.toString(),
                            sizeVariantsId: item.sizeVariantsId,
                            addOnSelected: {
                                create: item.addOnSelected.map((addon) => ({
                                    addOnId: addon.id,
                                    selectedAddOnVariantsId: {
                                        create: addon.selectedVariantsId.map((variant) => ({
                                            selectedAddOnVariantId: variant.id,
                                        })),
                                    },
                                })),
                            },
                            price: item.price.toString(),
                        })),
                    },
                },
            },
        },
    });
    if (tableId) {
        const findTable = yield __1.prismaDB.table.findFirst({
            where: {
                id: tableId,
                restaurantId: getOutlet.id,
            },
        });
        if (!(findTable === null || findTable === void 0 ? void 0 : findTable.id)) {
            throw new not_found_1.NotFoundException("No Table found", root_1.ErrorCode.NOT_FOUND);
        }
        else {
            yield __1.prismaDB.table.update({
                where: {
                    id: findTable.id,
                    restaurantId: getOutlet.id,
                },
                data: {
                    occupied: true,
                    inviteCode: (0, exports.inviteCode)(),
                    currentOrderSessionId: orderSession.id,
                },
            });
            yield __1.prismaDB.notification.create({
                data: {
                    restaurantId: getOutlet.id,
                    orderId: orderId,
                    message: "You have a new Order",
                    orderType: findTable.name,
                },
            });
            yield Promise.all([
                (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
                (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
                (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
                (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
                (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
                (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
            ]);
            ws_1.websocketManager.notifyClients(JSON.stringify({
                type: "NEW_ORDER_SESSION_CREATED",
                orderId: orderSession.id,
            }));
            return res.json({
                success: true,
                orderSessionId: orderSession.id,
                message: "Order Created from Admin ✅",
            });
        }
    }
    else {
        yield __1.prismaDB.notification.create({
            data: {
                restaurantId: getOutlet.id,
                orderId: orderId,
                message: "You have a new Order",
                orderType: orderType,
            },
        });
        yield Promise.all([
            (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
            (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
            (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
            (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
            (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
            (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
        ]);
        ws_1.websocketManager.notifyClients(JSON.stringify({
            type: "NEW_ORDER_SESSION_CREATED",
            orderId: orderSession.id,
        }));
        return res.json({
            success: true,
            orderSessionId: orderSession.id,
            message: "Order Created from Admin ✅",
        });
    }
});
exports.postOrderForOwner = postOrderForOwner;
const postOrderForStaf = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { outletId } = req.params;
    const validTypes = Object.values(client_1.OrderType);
    const { billerId, username, isPaid, phoneNo, orderType, totalAmount, orderItems, tableId, orderMode, } = req.body;
    // @ts-ignore
    if (billerId !== ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findBiller = yield __1.prismaDB.staff.findFirst({
        where: {
            id: billerId,
        },
    });
    if (!(findBiller === null || findBiller === void 0 ? void 0 : findBiller.id)) {
        throw new bad_request_1.BadRequestsException("You Need to login & place the order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (orderType === "DINEIN" && !tableId) {
        throw new bad_request_1.BadRequestsException("Please Assign the table , if you have choose order type has DINEIN", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validTypes.includes(orderType)) {
        throw new bad_request_1.BadRequestsException("Please Select Order Type", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!outletId) {
        throw new bad_request_1.BadRequestsException("Outlet Id is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const orderId = yield (0, outlet_1.generatedOrderId)(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id);
    const billNo = yield (0, outlet_1.generateBillNo)(getOutlet.id);
    const orderStatus = orderMode === "KOT"
        ? "INCOMMING"
        : orderMode === "EXPRESS"
            ? "FOODREADY"
            : "SERVED";
    const orderSession = yield __1.prismaDB.orderSession.create({
        data: {
            billId: billNo,
            orderType: orderType,
            username: username !== null && username !== void 0 ? username : findBiller.name,
            phoneNo: phoneNo !== null && phoneNo !== void 0 ? phoneNo : null,
            staffId: findBiller.id,
            tableId: tableId,
            isPaid: isPaid,
            restaurantId: getOutlet.id,
            orders: {
                create: {
                    staffId: findBiller.id,
                    restaurantId: getOutlet.id,
                    isPaid: isPaid,
                    active: true,
                    orderStatus: orderStatus,
                    totalAmount: totalAmount.toString(),
                    generatedOrderId: orderId,
                    orderType: orderType,
                    orderItems: {
                        create: orderItems.map((item) => ({
                            menuId: item.menuId,
                            quantity: item.quantity.toString(),
                            sizeVariantsId: item.sizeVariantsId,
                            addOnSelected: {
                                create: item.addOnSelected.map((addon) => ({
                                    addOnId: addon.id,
                                    selectedAddOnVariantsId: {
                                        create: addon.selectedVariantsId.map((variant) => ({
                                            selectedAddOnVariantId: variant.id,
                                        })),
                                    },
                                })),
                            },
                            price: item.price.toString(),
                        })),
                    },
                },
            },
        },
    });
    if (tableId) {
        const findTable = yield __1.prismaDB.table.findFirst({
            where: {
                id: tableId,
                restaurantId: getOutlet.id,
            },
        });
        if (!(findTable === null || findTable === void 0 ? void 0 : findTable.id)) {
            throw new not_found_1.NotFoundException("No Table found", root_1.ErrorCode.NOT_FOUND);
        }
        else {
            yield __1.prismaDB.table.update({
                where: {
                    id: findTable.id,
                    restaurantId: getOutlet.id,
                },
                data: {
                    occupied: true,
                    currentOrderSessionId: orderSession.id,
                },
            });
            yield __1.prismaDB.notification.create({
                data: {
                    restaurantId: getOutlet.id,
                    orderId: orderId,
                    message: "You have a new Order",
                    orderType: findTable.name,
                },
            });
            yield Promise.all([
                (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
                (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
                (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
                (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
                (0, get_order_1.getFetchAllStaffOrderSessionToRedis)(outletId, findBiller.id),
                (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
                (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
            ]);
            ws_1.websocketManager.notifyClients(JSON.stringify({
                type: "NEW_ORDER_SESSION_CREATED",
                orderId: orderSession.id,
            }));
            return res.json({
                success: true,
                orderSessionId: orderSession.id,
                message: "Order Created from Biller ✅",
            });
        }
    }
    else {
        yield __1.prismaDB.notification.create({
            data: {
                restaurantId: getOutlet.id,
                orderId: orderId,
                message: "You have a new Order",
                orderType: orderType,
            },
        });
        yield Promise.all([
            (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
            (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
            (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
            (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
            (0, get_order_1.getFetchAllStaffOrderSessionToRedis)(outletId, findBiller.id),
            (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
            (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
        ]);
        ws_1.websocketManager.notifyClients(JSON.stringify({
            type: "NEW_ORDER_SESSION_CREATED",
            orderId: orderSession.id,
        }));
        return res.json({
            success: true,
            orderSessionId: orderSession.id,
            message: "Order Created from Biller ✅",
        });
    }
});
exports.postOrderForStaf = postOrderForStaf;
const postOrderForUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const { outletId } = req.params;
    const validTypes = Object.values(client_1.OrderType);
    const { customerId, isPaid, orderType, totalAmount, orderItems, tableId } = req.body;
    // @ts-ignore
    if (customerId !== ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    const validCustomer = yield __1.prismaDB.customer.findFirst({
        where: {
            id: customerId,
        },
    });
    if (!(validCustomer === null || validCustomer === void 0 ? void 0 : validCustomer.id)) {
        throw new bad_request_1.BadRequestsException("You Need to login & place the order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (orderType === "DINEIN" && !tableId) {
        throw new bad_request_1.BadRequestsException("Please logout & Scan the QR code again to place the order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validTypes.includes(orderType)) {
        throw new bad_request_1.BadRequestsException("You Need to choose either HOME DELIVERY / TAKEAWAY ", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!outletId) {
        throw new bad_request_1.BadRequestsException("Outlet Id is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const orderId = yield (0, outlet_1.generatedOrderId)(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id);
    const billNo = yield (0, outlet_1.generateBillNo)(getOutlet.id);
    let orderSession;
    // Helper function to create order data
    const createOrderData = (restaurantId, isPaid, orderId, orderType, totalAmount, orderStatus, orderItems) => {
        return {
            active: true,
            restaurantId: restaurantId,
            isPaid: isPaid,
            generatedOrderId: orderId,
            orderType: orderType,
            totalAmount: totalAmount.toString(),
            orderStatus: orderStatus,
            orderItems: {
                create: orderItems.map((item) => ({
                    menuId: item.menuId,
                    quantity: item.quantity.toString(),
                    sizeVariantsId: item.sizeVariantsId,
                    addOnSelected: {
                        create: item.addOnSelected.map((addon) => ({
                            addOnId: addon.id,
                            selectedAddOnVariantsId: {
                                create: addon.selectedVariantsId.map((variant) => ({
                                    selectedAddOnVariantId: variant.id,
                                })),
                            },
                        })),
                    },
                    price: item.price.toString(),
                })),
            },
        };
    };
    if (orderType === client_1.OrderType.DINEIN) {
        if (!tableId) {
            throw new bad_request_1.BadRequestsException("Table ID is required for DINEIN orders", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        const checkTable = yield __1.prismaDB.table.findFirst({
            where: { id: tableId, occupied: true },
        });
        if (!checkTable) {
            throw new bad_request_1.BadRequestsException("You Need to scan the Qr Code again to place Order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        // Check if there's an existing order session for DINEIN
        if (checkTable.currentOrderSessionId) {
            // If there's an existing session, add the order to it
            orderSession = yield __1.prismaDB.orderSession.update({
                where: { id: checkTable.currentOrderSessionId },
                data: {
                    orders: {
                        create: createOrderData(getOutlet.id, isPaid, orderId, orderType, totalAmount, "INCOMMING", orderItems),
                    },
                },
            });
        }
        else {
            // If there's no existing session, create a new one
            orderSession = yield __1.prismaDB.orderSession.create({
                data: {
                    billId: billNo,
                    username: validCustomer.name,
                    phoneNo: validCustomer.phoneNo,
                    customerId: validCustomer.id,
                    tableId: tableId,
                    restaurantId: getOutlet.id,
                    orderType: orderType,
                    orders: {
                        create: createOrderData(getOutlet.id, isPaid, orderId, orderType, totalAmount, "INCOMMING", orderItems),
                    },
                },
            });
            // Update the table with the new orderSessionId
            yield __1.prismaDB.table.update({
                where: { id: tableId },
                data: { currentOrderSessionId: orderSession.id },
            });
        }
        yield firebase_1.NotificationService.sendNotification(getOutlet.fcmToken, `You have got new Order from ${checkTable.name}`, `Order: ${orderItems === null || orderItems === void 0 ? void 0 : orderItems.length}`);
    }
    else {
        // For TAKEAWAY or DELIVERY, always create a new order session
        orderSession = yield __1.prismaDB.orderSession.create({
            data: {
                billId: billNo,
                orderType: orderType,
                username: validCustomer.name,
                phoneNo: validCustomer === null || validCustomer === void 0 ? void 0 : validCustomer.phoneNo,
                customerId: validCustomer.id,
                restaurantId: getOutlet.id,
                orders: {
                    create: createOrderData(getOutlet.id, isPaid, orderId, orderType, totalAmount, "INCOMMING", orderItems),
                },
            },
        });
        yield firebase_1.NotificationService.sendNotification(getOutlet.fcmToken, `${orderType}: You have got new Order from ${validCustomer === null || validCustomer === void 0 ? void 0 : validCustomer.name}`, `Order: ${orderItems === null || orderItems === void 0 ? void 0 : orderItems.length}`);
    }
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
    ]);
    return res.json({
        success: true,
        sessionId: orderSession.id,
        message: "Order Created by Customer ✅",
    });
});
exports.postOrderForUser = postOrderForUser;
const existingOrderPatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _d, _e;
    const { outletId, orderId } = req.params;
    const { billerId, isPaid, totalAmount, orderItems, orderMode } = req.body;
    // @ts-ignore
    if (billerId !== ((_d = req.user) === null || _d === void 0 ? void 0 : _d.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findBiller = yield __1.prismaDB.staff.findFirst({
        where: {
            id: billerId,
        },
    });
    if (!(findBiller === null || findBiller === void 0 ? void 0 : findBiller.id)) {
        throw new bad_request_1.BadRequestsException("You Need to login & place the order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!outletId) {
        throw new bad_request_1.BadRequestsException("Outlet Id is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const getOrder = yield (0, outlet_1.getOrderSessionById)(getOutlet.id, orderId);
    if (!(getOrder === null || getOrder === void 0 ? void 0 : getOrder.id)) {
        throw new not_found_1.NotFoundException("No Current Order to Add Items", root_1.ErrorCode.NOT_FOUND);
    }
    const generatedId = yield (0, outlet_1.generatedOrderId)(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id);
    const orderStatus = orderMode === "KOT"
        ? "INCOMMING"
        : orderMode === "EXPRESS"
            ? "FOODREADY"
            : "SERVED";
    const orderSession = yield __1.prismaDB.orderSession.update({
        where: {
            restaurantId: getOutlet.id,
            id: getOrder.id,
        },
        data: {
            orderType: getOrder.orderType,
            staffId: findBiller.id,
            isPaid: isPaid,
            restaurantId: getOutlet.id,
            orders: {
                create: {
                    active: true,
                    staffId: findBiller.id,
                    restaurantId: getOutlet.id,
                    isPaid: isPaid,
                    orderStatus: orderStatus,
                    totalAmount: totalAmount.toString(),
                    generatedOrderId: generatedId,
                    orderType: getOrder.orderType,
                    orderItems: {
                        create: orderItems.map((item) => ({
                            menuId: item.menuId,
                            quantity: item.quantity.toString(),
                            sizeVariantsId: item.sizeVariantsId,
                            addOnSelected: {
                                create: item.addOnSelected.map((addon) => ({
                                    addOnId: addon.id,
                                    selectedAddOnVariantsId: {
                                        create: addon.selectedVariantsId.map((variant) => ({
                                            selectedAddOnVariantId: variant.id,
                                        })),
                                    },
                                })),
                            },
                            price: item.price.toString(),
                        })),
                    },
                },
            },
        },
    });
    yield __1.prismaDB.notification.create({
        data: {
            restaurantId: getOutlet.id,
            orderId: generatedId,
            message: "You have a new Order",
            orderType: getOrder.orderType === "DINEIN"
                ? (_e = getOrder.table) === null || _e === void 0 ? void 0 : _e.name
                : getOrder.orderType,
        },
    });
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_order_1.getFetchAllStaffOrderSessionToRedis)(outletId, findBiller.id),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
    ]);
    ws_1.websocketManager.notifyClients(JSON.stringify({
        type: "NEW_ORDER_SESSION_UPDATED",
        orderId: orderSession.id,
    }));
    return res.json({
        success: true,
        orderSessionId: orderSession.id,
        message: "Order Added from Biller ✅",
    });
});
exports.existingOrderPatch = existingOrderPatch;
const existingOrderPatchApp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _f, _g;
    const { outletId, orderId } = req.params;
    const { billerId, isPaid, totalAmount, orderItems, orderMode } = req.body;
    // @ts-ignore
    if (billerId !== ((_f = req.user) === null || _f === void 0 ? void 0 : _f.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findBiller = yield __1.prismaDB.user.findFirst({
        where: {
            id: billerId,
        },
    });
    if (!(findBiller === null || findBiller === void 0 ? void 0 : findBiller.id)) {
        throw new bad_request_1.BadRequestsException("You Need to login & place the order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!outletId) {
        throw new bad_request_1.BadRequestsException("Outlet Id is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const getOrder = yield (0, outlet_1.getOrderSessionById)(getOutlet.id, orderId);
    if (!(getOrder === null || getOrder === void 0 ? void 0 : getOrder.id)) {
        throw new not_found_1.NotFoundException("No Current Order to Add Items", root_1.ErrorCode.NOT_FOUND);
    }
    const generatedId = yield (0, outlet_1.generatedOrderId)(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id);
    const orderStatus = orderMode === "KOT"
        ? "INCOMMING"
        : orderMode === "EXPRESS"
            ? "FOODREADY"
            : "SERVED";
    const orderSession = yield __1.prismaDB.orderSession.update({
        where: {
            restaurantId: getOutlet.id,
            id: getOrder.id,
        },
        data: {
            orderType: getOrder.orderType,
            adminId: findBiller.id,
            isPaid: isPaid,
            restaurantId: getOutlet.id,
            orders: {
                create: {
                    active: true,
                    restaurantId: getOutlet.id,
                    isPaid: isPaid,
                    orderStatus: orderStatus,
                    totalAmount: totalAmount.toString(),
                    generatedOrderId: generatedId,
                    orderType: getOrder.orderType,
                    orderItems: {
                        create: orderItems.map((item) => ({
                            menuId: item.menuId,
                            quantity: item.quantity.toString(),
                            sizeVariantsId: item.sizeVariantsId,
                            addOnSelected: {
                                create: item.addOnSelected.map((addon) => ({
                                    addOnId: addon.id,
                                    selectedAddOnVariantsId: {
                                        create: addon.selectedVariantsId.map((variant) => ({
                                            selectedAddOnVariantId: variant.id,
                                        })),
                                    },
                                })),
                            },
                            price: item.price.toString(),
                        })),
                    },
                },
            },
        },
    });
    yield __1.prismaDB.notification.create({
        data: {
            restaurantId: getOutlet.id,
            orderId: generatedId,
            message: "You have a new Order",
            orderType: getOrder.orderType === "DINEIN"
                ? (_g = getOrder.table) === null || _g === void 0 ? void 0 : _g.name
                : getOrder.orderType,
        },
    });
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
    ]);
    ws_1.websocketManager.notifyClients(JSON.stringify({
        type: "NEW_ORDER_SESSION_UPDATED",
        orderId: orderSession.id,
    }));
    return res.json({
        success: true,
        orderSessionId: orderSession.id,
        message: "Order Added from Admin App ✅",
    });
});
exports.existingOrderPatchApp = existingOrderPatchApp;
const orderStatusPatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId, outletId } = req.params;
    const validTypes = Object.values(client_1.OrderStatus);
    const { orderStatus } = req.body;
    if (!validTypes.includes(orderStatus)) {
        throw new bad_request_1.BadRequestsException("OrderStatus is Invalid", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getOrderById = yield (0, outlet_1.getOrderByOutketId)(outlet.id, orderId);
    if (!(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.id)) {
        throw new not_found_1.NotFoundException("No Order Found to Update", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.order.updateMany({
        where: {
            id: getOrderById.id,
            restaurantId: outlet.id,
        },
        data: {
            orderStatus: orderStatus,
        },
    });
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
    ]);
    ws_1.websocketManager.notifyClients(JSON.stringify({
        type: "ORDER_UPDATED",
    }));
    return res.json({
        success: true,
        message: "Order Status Update Success ✅",
    });
});
exports.orderStatusPatch = orderStatusPatch;
const getAllOrderByStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _h;
    const { outletId } = req.params;
    const redisOrderByStaff = yield redis_1.redis.get(`all-order-staff-${outletId}`);
    if (redisOrderByStaff) {
        return res.json({
            success: true,
            orders: JSON.parse(redisOrderByStaff),
            message: "Fetched Up ⚡",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // @ts-ignore
    const staff = yield (0, get_users_1.getStaffById)(outletId, (_h = req.user) === null || _h === void 0 ? void 0 : _h.id);
    if (!(staff === null || staff === void 0 ? void 0 : staff.id)) {
        throw new not_found_1.NotFoundException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const getAllOrders = yield (0, get_order_1.getFetchAllStaffOrderSessionToRedis)(outlet.id, staff.id);
    return res.json({
        success: true,
        orders: getAllOrders,
        message: "Fetched ✅",
    });
});
exports.getAllOrderByStaff = getAllOrderByStaff;
const inviteCode = () => {
    let code = "";
    const MAX_LENGTH = 5;
    const alphabets = "ABCDEFGHIHJKLMNOPQRSTUVWXYZ0123456789";
    for (let i = 0; i < MAX_LENGTH; i++) {
        code += alphabets[Math.floor(Math.random() * alphabets.length)];
    }
    return code;
};
exports.inviteCode = inviteCode;
const printKotOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderItems } = req.body;
});
exports.printKotOrder = printKotOrder;
