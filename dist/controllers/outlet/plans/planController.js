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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPlans = exports.buyPlan = exports.paymentRazorpayVerification = exports.CreateRazorPayOrder = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const bad_request_1 = require("../../../exceptions/bad-request");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const not_found_1 = require("../../../exceptions/not-found");
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});
function CreateRazorPayOrder(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { amount } = req.body;
        const order = yield razorpay.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: "receipt_" + Math.random().toString(36).substring(7),
        });
        return res.json({
            success: true,
            orderId: order.id,
        });
    });
}
exports.CreateRazorPayOrder = CreateRazorPayOrder;
const paymentRazorpayVerification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto_1.default
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");
    const isAuthentic = expectedSignature === razorpaySignature;
    if (isAuthentic) {
        console.log(razorpayPaymentId);
        res.json({ success: true, message: "Payment Successfull" });
    }
    else {
        res.status(400).json({
            success: false,
        });
    }
});
exports.paymentRazorpayVerification = paymentRazorpayVerification;
const buyPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { paymentId, subscriptionId } = req.body;
    // @ts-ignore
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!paymentId || !subscriptionId) {
        throw new bad_request_1.BadRequestsException("Payment ID not Verfied", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const findOwner = yield __1.prismaDB.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!(findOwner === null || findOwner === void 0 ? void 0 : findOwner.id)) {
        throw new not_found_1.NotFoundException("User Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const findSubscription = yield __1.prismaDB.subsciption.findFirst({
        where: {
            id: subscriptionId,
        },
    });
    if (!findSubscription) {
        throw new bad_request_1.BadRequestsException("No Subscription Found", root_1.ErrorCode.NOT_FOUND);
    }
    let validDate = new Date();
    if (findSubscription.planType === "MONTHLY") {
        validDate.setMonth(validDate.getMonth() + 1);
    }
    else if (findSubscription.planType === "ANNUALLY") {
        validDate.setFullYear(validDate.getFullYear() + 1);
    }
    yield __1.prismaDB.subscriptionBilling.create({
        data: {
            userId: findOwner.id,
            isSubscription: true,
            paymentId: paymentId,
            subscribedDate: new Date(),
            planType: findSubscription.planType,
            subscriptionPlan: findSubscription.subscriptionPlan,
            validDate: validDate,
        },
    });
    yield __1.prismaDB.user.update({
        where: {
            id: findOwner.id,
        },
        data: {
            isSubscribed: true,
            subscribedDate: new Date(),
        },
    });
    return res.json({
        success: true,
        message: "Your Subscription is now Active",
    });
});
exports.buyPlan = buyPlan;
const getAllPlans = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const plans = yield __1.prismaDB.subsciption.findMany();
    return res.json({
        success: true,
        plans,
    });
});
exports.getAllPlans = getAllPlans;
