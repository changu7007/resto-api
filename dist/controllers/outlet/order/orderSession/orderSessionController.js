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
exports.billingOrderSession = void 0;
const outlet_1 = require("../../../../lib/outlet");
const not_found_1 = require("../../../../exceptions/not-found");
const root_1 = require("../../../../exceptions/root");
const client_1 = require("@prisma/client");
const bad_request_1 = require("../../../../exceptions/bad-request");
const __1 = require("../../../..");
const redis_1 = require("../../../../services/redis");
const ws_1 = require("../../../../services/ws");
const get_order_1 = require("../../../../lib/outlet/get-order");
const get_tables_1 = require("../../../../lib/outlet/get-tables");
const firebase_1 = require("../../../../services/firebase");
const billingOrderSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderSessionId, outletId } = req.params;
    const { subTotal, paymentMethod } = req.body;
    if (typeof subTotal !== "number" ||
        !Object.values(client_1.PaymentMethod).includes(paymentMethod)) {
        throw new bad_request_1.BadRequestsException("Invalid total or Choose Payment method", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const orderSession = yield (0, outlet_1.getOrderSessionById)(outlet.id, orderSessionId);
    if (!(orderSession === null || orderSession === void 0 ? void 0 : orderSession.id)) {
        throw new not_found_1.NotFoundException("Order Session not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const updatedOrderSession = yield __1.prismaDB.orderSession.update({
        where: {
            id: orderSession.id,
            restaurantId: outlet.id,
        },
        data: {
            active: false,
            isPaid: true,
            paymentMethod: paymentMethod,
            subTotal: String(subTotal),
            sessionStatus: "COMPLETED",
            orders: {
                updateMany: {
                    where: {
                        orderStatus: "SERVED",
                    },
                    data: {
                        active: false,
                        isPaid: true,
                        orderStatus: "COMPLETED",
                    },
                },
            },
        },
        include: {
            orders: true,
        },
    });
    if (!updatedOrderSession) {
        throw new bad_request_1.BadRequestsException("Something went wrong while recieveing the bill", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    if (updatedOrderSession.orderType === "DINEIN") {
        const findTable = yield __1.prismaDB.table.findFirst({
            where: {
                restaurantId: outlet.id,
                currentOrderSessionId: orderSession.id,
            },
        });
        if (!findTable) {
            throw new bad_request_1.BadRequestsException("Could not find the table bill your looking for", root_1.ErrorCode.INTERNAL_EXCEPTION);
        }
        const updateTable = yield __1.prismaDB.table.update({
            where: {
                id: findTable === null || findTable === void 0 ? void 0 : findTable.id,
                restaurantId: outlet.id,
            },
            data: {
                occupied: false,
                currentOrderSessionId: null,
                customerId: null,
            },
        });
        if (!updateTable) {
            throw new bad_request_1.BadRequestsException("Could not remove the table session", root_1.ErrorCode.INTERNAL_EXCEPTION);
        }
        yield (0, get_order_1.getFetchLiveOrderToRedis)(outletId);
        yield (0, get_tables_1.getFetchAllTablesToRedis)(outletId);
        yield (0, get_tables_1.getFetchAllAreastoRedis)(outletId);
    }
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
        redis_1.redis.del(`all-order-staff-${outletId}`),
    ]);
    yield firebase_1.NotificationService.sendNotification(outlet === null || outlet === void 0 ? void 0 : outlet.fcmToken, "Bill Recieved", `${subTotal}`);
    ws_1.websocketManager.notifyClients(JSON.stringify({
        type: "BILL_UPDATED",
    }));
    return res.json({
        success: true,
        message: "Bill Recieved & Saved Success ✅",
    });
});
exports.billingOrderSession = billingOrderSession;
