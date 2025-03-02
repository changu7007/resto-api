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
exports.acknowledgeAlert = exports.getAlerts = void 0;
const outlet_1 = require("../../../lib/outlet");
const redis_1 = require("../../../services/redis");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const getAlerts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisAlerts = yield redis_1.redis.get(`alerts-${outletId}`);
    if (redisAlerts) {
        return res.json({
            success: true,
            alerts: JSON.parse(redisAlerts),
        });
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const alerts = yield __1.prismaDB.alert.findMany({
        where: {
            restaurantId: outletId,
            status: {
                in: ["PENDING"],
            },
        },
        select: {
            id: true,
            type: true,
            status: true,
            priority: true,
            message: true,
            createdAt: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    yield redis_1.redis.set(`alerts-${outletId}`, JSON.stringify(alerts));
    return res.json({
        success: true,
        alerts: alerts,
        message: "Alerts",
    });
});
exports.getAlerts = getAlerts;
const acknowledgeAlert = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { id } = req.body;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const findalerts = yield __1.prismaDB.alert.findFirst({
        where: {
            restaurantId: outletId,
            id,
        },
    });
    if (!(findalerts === null || findalerts === void 0 ? void 0 : findalerts.id)) {
        throw new not_found_1.NotFoundException("Alert Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.alert.update({
        where: {
            id: findalerts === null || findalerts === void 0 ? void 0 : findalerts.id,
            restaurantId: outletId,
        },
        data: {
            status: "ACKNOWLEDGED",
        },
    });
    const alerts = yield __1.prismaDB.alert.findMany({
        where: {
            restaurantId: outletId,
            status: {
                in: ["PENDING"],
            },
        },
        select: {
            id: true,
            type: true,
            status: true,
            priority: true,
            message: true,
            createdAt: true,
        },
    });
    yield redis_1.redis.set(`alerts-${outletId}`, JSON.stringify(alerts));
    return res.json({
        success: true,
        message: "Alert Acknowledged ✅",
    });
});
exports.acknowledgeAlert = acknowledgeAlert;
