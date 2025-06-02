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
exports.clearPhonePeCache = exports.posAmountPhoneCheck = exports.orderAmountPhoneCheck = exports.posOutletPhonePeOrder = exports.createDomainPhonePeOrder = void 0;
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const outlet_1 = require("../../../lib/outlet");
const secrets_1 = require("../../../secrets");
const bad_request_1 = require("../../../exceptions/bad-request");
const planController_1 = require("./planController");
const phonepe_service_1 = require("../../../services/phonepe/phonepe-service");
const phonePeService = phonepe_service_1.PhonePeService.getInstance();
// const outletPhonePeClient = async (outletId: string) => {
//   try {
//     const getOutlet = await getOutletById(outletId);
//     if (!getOutlet?.id) {
//       throw new NotFoundException(
//         "Outlet Not found",
//         ErrorCode.OUTLET_NOT_FOUND
//       );
//     }
//     const phonePeIntegration = await prismaDB.integration.findFirst({
//       where: {
//         restaurantId: outletId,
//         name: "PHONEPE",
//       },
//       select: {
//         phonePeAPIId: true,
//         phonePeAPISecretKey: true,
//       },
//     });
//     if (!phonePeIntegration) {
//       throw new NotFoundException(
//         "PhonePe Connection Error, Contact Support",
//         ErrorCode.UNPROCESSABLE_ENTITY
//       );
//     }
//     if (
//       !phonePeIntegration?.phonePeAPIId ||
//       !phonePeIntegration?.phonePeAPISecretKey
//     ) {
//       throw new NotFoundException(
//         "PhonePe Not Configured for this outlet",
//         ErrorCode.UNPROCESSABLE_ENTITY
//       );
//     }
//     const clientId = decryptData(phonePeIntegration?.phonePeAPIId);
//     const clientSecret = decryptData(phonePeIntegration?.phonePeAPISecretKey);
//     // Check if client already exists for this outlet
//     const clientKey = `${outletId}_${clientId}`;
//     if (phonePeClients.has(clientKey)) {
//       return phonePeClients.get(clientKey);
//     }
//     // Create new client instance for this outlet
//     try {
//       const client = StandardCheckoutClient.getInstance(
//         clientId,
//         clientSecret,
//         1,
//         ENV === "development" ? Env.SANDBOX : Env.PRODUCTION
//       );
//       // Store the client for reuse
//       phonePeClients.set(clientKey, client);
//       return client;
//     } catch (error) {
//       // If getInstance fails due to re-initialization, try alternative approach
//       console.log(
//         "StandardCheckoutClient re-initialization error, using workaround"
//       );
//       // Alternative: Create a custom client wrapper or use direct API calls
//       // For now, we'll throw a more descriptive error
//       throw new BadRequestsException(
//         "PhonePe client initialization conflict. Please contact support.",
//         ErrorCode.INTERNAL_EXCEPTION
//       );
//     }
//   } catch (error) {
//     console.log("outletPhonePeClient error:", error);
//     if (
//       error instanceof NotFoundException ||
//       error instanceof BadRequestsException
//     ) {
//       throw error;
//     }
//     throw new BadRequestsException(
//       "Something went wrong in the server",
//       ErrorCode.INTERNAL_EXCEPTION
//     );
//   }
// };
function createDomainPhonePeOrder(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { outletId } = req.params;
            const { amount, orderSessionId, from, domain } = req.body;
            // @ts-ignore
            const userId = req.user.id;
            // Validation
            if (!amount) {
                throw new not_found_1.NotFoundException("Amount is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
            }
            if (!from) {
                throw new not_found_1.NotFoundException("PhonePe Initialization Failed", root_1.ErrorCode.INTERNAL_EXCEPTION);
            }
            if (from === "paybill" && !orderSessionId) {
                throw new not_found_1.NotFoundException("Order is Missing", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
            }
            if (!domain) {
                throw new not_found_1.NotFoundException("Domain Not found", root_1.ErrorCode.NOT_FOUND);
            }
            // Verify outlet exists
            const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
            if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
                throw new not_found_1.NotFoundException("Outlet Not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
            }
            // Verify order if from paybill
            if (from === "paybill") {
                const getOrder = yield (0, outlet_1.getOrderSessionById)(outletId, orderSessionId);
                if ((getOrder === null || getOrder === void 0 ? void 0 : getOrder.active) === false && getOrder.isPaid) {
                    throw new bad_request_1.BadRequestsException("Bill Already Cleared", root_1.ErrorCode.INTERNAL_EXCEPTION);
                }
            }
            // Get PhonePe client for outlet
            const phonePeClient = yield phonePeService.getOutletClient(outletId);
            const merchantOrderId = phonePeClient.generatePhonePeOrderId("OUTLET");
            let redirectUrl;
            if (from === "paybill") {
                redirectUrl = `${planController_1.API}/outlet/${outletId}/check-phonepe-status?merchantOrderId=${merchantOrderId}&from=${from}&orderSessionId=${orderSessionId}&userId=${userId}&domain=${domain}`;
            }
            else {
                redirectUrl = `${planController_1.API}/outlet/${outletId}/check-phonepe-status?merchantOrderId=${merchantOrderId}&from=${from}&userId=${userId}&domain=${domain}`;
            }
            // Create payment
            const paymentResponse = yield phonePeClient.createPayment({
                merchantOrderId,
                amount,
                redirectUrl,
                userId,
                metadata: { outletId, from, domain },
            });
            if (!paymentResponse.success) {
                throw new bad_request_1.BadRequestsException(paymentResponse.error || "Payment creation failed", root_1.ErrorCode.INTERNAL_EXCEPTION);
            }
            return res.json({
                success: true,
                redirectUrl: paymentResponse.redirectUrl,
            });
        }
        catch (error) {
            console.error("createDomainPhonePeOrder error:", error);
            if (error instanceof not_found_1.NotFoundException ||
                error instanceof bad_request_1.BadRequestsException) {
                throw error;
            }
            throw new bad_request_1.BadRequestsException("Something went wrong in payment processing", root_1.ErrorCode.INTERNAL_EXCEPTION);
        }
    });
}
exports.createDomainPhonePeOrder = createDomainPhonePeOrder;
function posOutletPhonePeOrder(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
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
            const phonePeClient = yield phonePeService.getOutletClient(outletId);
            const merchantOrderId = phonePeClient.generatePhonePeOrderId("POS");
            const redirectUrl = `${planController_1.API}/outlet/${outletId}/check-pos-phonepe-status?merchantOrderId=${merchantOrderId}&userId=${userId}`;
            const paymentResponse = yield phonePeClient.createPayment({
                merchantOrderId,
                amount,
                redirectUrl,
                userId,
                metadata: { outletId, type: "pos" },
            });
            if (!paymentResponse.success) {
                throw new bad_request_1.BadRequestsException(paymentResponse.error || "Payment creation failed", root_1.ErrorCode.INTERNAL_EXCEPTION);
            }
            return res.json({
                success: true,
                redirectUrl: paymentResponse.redirectUrl,
            });
        }
        catch (error) {
            console.error("posOutletPhonePeOrder error:", error);
            if (error instanceof not_found_1.NotFoundException ||
                error instanceof bad_request_1.BadRequestsException) {
                throw error;
            }
            throw new bad_request_1.BadRequestsException("Something went wrong in payment processing", root_1.ErrorCode.INTERNAL_EXCEPTION);
        }
    });
}
exports.posOutletPhonePeOrder = posOutletPhonePeOrder;
function orderAmountPhoneCheck(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { outletId } = req.params;
            const { merchantOrderId, orderSessionId, from, userId, domain } = req.query;
            if (!merchantOrderId) {
                throw new not_found_1.NotFoundException("Merchant OrderId is Missing", root_1.ErrorCode.UNAUTHORIZED);
            }
            if (!orderSessionId && from === "paybill") {
                throw new not_found_1.NotFoundException("OrderId is Missing", root_1.ErrorCode.UNAUTHORIZED);
            }
            const phonePeClient = yield phonePeService.getOutletClient(outletId);
            const statusResponse = yield phonePeClient.getOrderStatus(merchantOrderId);
            const host = secrets_1.ENV === "production"
                ? `https://${domain}.restobytes.in/${outletId}`
                : `http://${domain}.localhost:2000/${outletId}`;
            const orderSession = yield (0, outlet_1.getOrderSessionById)(outletId, orderSessionId);
            if (!orderSession) {
                throw new not_found_1.NotFoundException("Order Not Found", root_1.ErrorCode.NOT_FOUND);
            }
            if (statusResponse.state === "COMPLETED") {
                if (!userId) {
                    throw new bad_request_1.BadRequestsException("User is Missing", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
                }
                if (from === "paybill") {
                    return res.redirect(`${host}/paybill/${orderSession === null || orderSession === void 0 ? void 0 : orderSession.tableId}?payment=success&paymentId=${statusResponse === null || statusResponse === void 0 ? void 0 : statusResponse.orderId}&amount=${((statusResponse === null || statusResponse === void 0 ? void 0 : statusResponse.amount) || 0) / 100}`);
                }
                else {
                    return res.redirect(`${host}/cart?payment=success&paymentId=${statusResponse === null || statusResponse === void 0 ? void 0 : statusResponse.orderId}&amount=${((statusResponse === null || statusResponse === void 0 ? void 0 : statusResponse.amount) || 0) / 100}`);
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
        }
        catch (error) {
            console.error("orderAmountPhoneCheck error:", error);
            const host = secrets_1.ENV === "production"
                ? `https://${req.query.domain}.restobytes.in/${req.params.outletId}`
                : `http://${req.query.domain}.localhost:2000/${req.params.outletId}`;
            return res.redirect(`${host}/cart?payment=error`);
        }
    });
}
exports.orderAmountPhoneCheck = orderAmountPhoneCheck;
function posAmountPhoneCheck(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { outletId } = req.params;
            const { merchantOrderId } = req.query;
            if (!merchantOrderId) {
                throw new not_found_1.NotFoundException("Merchant OrderId is Missing", root_1.ErrorCode.UNAUTHORIZED);
            }
            const phonePeClient = yield phonePeService.getOutletClient(outletId);
            const statusResponse = yield phonePeClient.getOrderStatus(merchantOrderId);
            const host = secrets_1.ENV === "production"
                ? `https://pos.restobytes.in/${outletId}/billing`
                : `http://localhost:5173/${outletId}/billing`;
            if (statusResponse.state === "COMPLETED") {
                return res.redirect(`${host}?payment=success&paymentId=${statusResponse === null || statusResponse === void 0 ? void 0 : statusResponse.orderId}&amount=${((statusResponse === null || statusResponse === void 0 ? void 0 : statusResponse.amount) || 0) / 100}`);
            }
            else {
                return res.redirect(`${host}?payment=failure`);
            }
        }
        catch (error) {
            console.error("posAmountPhoneCheck error:", error);
            const host = secrets_1.ENV === "production"
                ? `https://pos.restobytes.in/${req.params.outletId}/billing`
                : `http://localhost:5173/${req.params.outletId}/billing`;
            return res.redirect(`${host}?payment=error`);
        }
    });
}
exports.posAmountPhoneCheck = posAmountPhoneCheck;
// Utility endpoint for cache management (optional)
function clearPhonePeCache(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { outletId } = req.params;
            if (outletId) {
                phonePeService.clearOutletCache(outletId);
            }
            else {
                phonePeService.clearAllCache();
            }
            return res.json({
                success: true,
                message: outletId
                    ? `Cache cleared for outlet ${outletId}`
                    : "All cache cleared",
                stats: phonePeService.getCacheStats(),
            });
        }
        catch (error) {
            return res.json({
                success: false,
                error: error.message,
            });
        }
    });
}
exports.clearPhonePeCache = clearPhonePeCache;
