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
exports.orderAmountPhoneCheck = exports.posAmountPhoneCheck = exports.posOutletPhonePeOrder = exports.createDomainPhonePeOrder = void 0;
const pg_sdk_node_1 = require("pg-sdk-node");
const __1 = require("../../..");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const outlet_1 = require("../../../lib/outlet");
const utils_1 = require("../../../lib/utils");
const secrets_1 = require("../../../secrets");
const bad_request_1 = require("../../../exceptions/bad-request");
const crypto_1 = require("crypto");
const planController_1 = require("./planController");
const outletPhonePeClient = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
        if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
            throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
        }
        const phonePeIntegration = yield __1.prismaDB.integration.findFirst({
            where: {
                restaurantId: outletId,
                name: "PHONEPE",
            },
            select: {
                phonePeAPIId: true,
                phonePeAPISecretKey: true,
            },
        });
        if (!phonePeIntegration) {
            throw new not_found_1.NotFoundException("PhonePe Connection Error, Contact Support", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        const clientId = (0, utils_1.decryptData)(phonePeIntegration === null || phonePeIntegration === void 0 ? void 0 : phonePeIntegration.phonePeAPIId);
        const clientSecret = (0, utils_1.decryptData)(phonePeIntegration === null || phonePeIntegration === void 0 ? void 0 : phonePeIntegration.phonePeAPISecretKey);
        return pg_sdk_node_1.StandardCheckoutClient.getInstance(clientId, clientSecret, 1, secrets_1.ENV === "development" ? pg_sdk_node_1.Env.SANDBOX : pg_sdk_node_1.Env.PRODUCTION);
    }
    catch (error) {
        console.log(error);
        throw new bad_request_1.BadRequestsException("Something Went wrong in the server", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
});
function createDomainPhonePeOrder(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { outletId } = req.params;
        const { amount, orderSessionId, from, domain } = req.body;
        // @ts-ignore
        const userId = req.user.id;
        if (!amount) {
            throw new not_found_1.NotFoundException("Amount is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        if (!from) {
            throw new not_found_1.NotFoundException("PhonePe Initiialization Failed", root_1.ErrorCode.INTERNAL_EXCEPTION);
        }
        if (from === "paybill" && !orderSessionId) {
            throw new not_found_1.NotFoundException("Order is Missing", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        if (!domain) {
            throw new not_found_1.NotFoundException("Domain Not found", root_1.ErrorCode.NOT_FOUND);
        }
        const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
        if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
            throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
        }
        const ophonePeClient = yield outletPhonePeClient(outletId);
        const merchantOrderId = (0, crypto_1.randomUUID)();
        if (from === "paybill") {
            const getOrder = yield (0, outlet_1.getOrderSessionById)(outletId, orderSessionId);
            if ((getOrder === null || getOrder === void 0 ? void 0 : getOrder.active) === false && getOrder.isPaid) {
                throw new bad_request_1.BadRequestsException("Bill Already Cleared", root_1.ErrorCode.INTERNAL_EXCEPTION);
            }
            const redirectUrl = `${planController_1.API}/outlet/${outletId}/check-phonepe-status?merchantOrderId=${merchantOrderId}&from=${from}&orderSessionId=${orderSessionId}&userId=${userId}&domain=${domain}`;
            const request = pg_sdk_node_1.StandardCheckoutPayRequest.builder()
                .merchantOrderId(merchantOrderId)
                .amount(amount)
                .redirectUrl(redirectUrl)
                .build();
            const response = yield ophonePeClient.pay(request);
            return res.json({
                success: true,
                redirectUrl: response.redirectUrl,
            });
        }
        else {
            const redirectUrl = `${planController_1.API}/outlet/${outletId}/check-phonepe-status?merchantOrderId=${merchantOrderId}&from=${from}&userId=${userId}&domain=${domain}`;
            const request = pg_sdk_node_1.StandardCheckoutPayRequest.builder()
                .merchantOrderId(merchantOrderId)
                .amount(amount)
                .redirectUrl(redirectUrl)
                .build();
            const response = yield ophonePeClient.pay(request);
            return res.json({
                success: true,
                redirectUrl: response.redirectUrl,
            });
        }
    });
}
exports.createDomainPhonePeOrder = createDomainPhonePeOrder;
function posOutletPhonePeOrder(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { outletId } = req.params;
        const { amount } = req.body;
        // @ts-ignore
        const userId = req.user.id;
        if (!amount) {
            throw new not_found_1.NotFoundException("Amount is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
        if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
            throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
        }
        const ophonePeClient = yield outletPhonePeClient(outletId);
        const merchantOrderId = (0, crypto_1.randomUUID)();
        const redirectUrl = `${planController_1.API}/outlet/${outletId}/check-pos-phonepe-status?merchantOrderId=${merchantOrderId}&&userId=${userId}`;
        const request = pg_sdk_node_1.StandardCheckoutPayRequest.builder()
            .merchantOrderId(merchantOrderId)
            .amount(amount)
            .redirectUrl(redirectUrl)
            .build();
        const response = yield ophonePeClient.pay(request);
        return res.json({
            success: true,
            redirectUrl: response.redirectUrl,
        });
    });
}
exports.posOutletPhonePeOrder = posOutletPhonePeOrder;
function posAmountPhoneCheck(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { outletId } = req.params;
        const { merchantOrderId } = req.query;
        if (!merchantOrderId) {
            throw new not_found_1.NotFoundException("Merchant OrderId is Missing", root_1.ErrorCode.UNAUTHORIZED);
        }
        const ophonePeClient = yield outletPhonePeClient(outletId);
        const response = yield ophonePeClient.getOrderStatus(merchantOrderId);
        const status = response.state;
        let host = secrets_1.ENV === "production"
            ? `https://pos.restobytes.in/${outletId}/billing`
            : `http://localhost:5173/${outletId}/billing`;
        if (status === "COMPLETED") {
            // Create subscription similar to buyPlan function
            return res.redirect(`${host}?payment=success&paymentId=${response === null || response === void 0 ? void 0 : response.orderId}&amount=${(response === null || response === void 0 ? void 0 : response.amount) / 100}`);
        }
        else {
            return res.redirect(`${host}?payment=failure`);
        }
    });
}
exports.posAmountPhoneCheck = posAmountPhoneCheck;
function orderAmountPhoneCheck(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { outletId } = req.params;
        const { merchantOrderId, orderSessionId, from, userId, domain } = req.query;
        if (!merchantOrderId) {
            throw new not_found_1.NotFoundException("Merchant OrderId is Missing", root_1.ErrorCode.UNAUTHORIZED);
        }
        if (!orderSessionId && from === "paybill") {
            throw new not_found_1.NotFoundException(" OrderId is Missing", root_1.ErrorCode.UNAUTHORIZED);
        }
        const ophonePeClient = yield outletPhonePeClient(outletId);
        const response = yield ophonePeClient.getOrderStatus(merchantOrderId);
        const status = response.state;
        const host = secrets_1.ENV === "production"
            ? `https://${domain}.restobytes.in/${outletId}`
            : `http://${domain}.localhost:2000/${outletId}`;
        const orderSession = yield (0, outlet_1.getOrderSessionById)(outletId, orderSessionId);
        if (!orderSession) {
            throw new not_found_1.NotFoundException("Order Not Found", root_1.ErrorCode.NOT_FOUND);
        }
        if (status === "COMPLETED") {
            // Create subscription similar to buyPlan function
            if (!userId) {
                throw new bad_request_1.BadRequestsException("User is Missing", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
            }
            if (from === "paybill") {
                return res.redirect(`${host}/paybill/${orderSession === null || orderSession === void 0 ? void 0 : orderSession.tableId}?payment=success&paymentId=${response === null || response === void 0 ? void 0 : response.orderId}&amount=${(response === null || response === void 0 ? void 0 : response.amount) / 100}`);
            }
            else {
                return res.redirect(`${host}/cart?payment=success&paymentId=${response === null || response === void 0 ? void 0 : response.orderId}&amount=${(response === null || response === void 0 ? void 0 : response.amount) / 100}`);
            }
        }
        else {
            if (from === "paybill") {
                return res.redirect(`${host}/paybill/${orderSession === null || orderSession === void 0 ? void 0 : orderSession.tableId}?payment=failure`);
            }
            else {
                return res.redirect(`${host}/cart?payment=failure`);
            }
        }
    });
}
exports.orderAmountPhoneCheck = orderAmountPhoneCheck;
