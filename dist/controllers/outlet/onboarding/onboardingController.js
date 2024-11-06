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
exports.updateOnboardingStatus = exports.createOutlet = exports.saveOnBoarding = exports.getOnBoarding = void 0;
const get_users_1 = require("../../../lib/get-users");
const bad_request_1 = require("../../../exceptions/bad-request");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const redis_1 = require("../../../services/redis");
const getOnBoarding = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // @ts-ignore
    const user = yield (0, get_users_1.getOwnerById)((_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.id);
    if (!(user === null || user === void 0 ? void 0 : user.id)) {
        throw new bad_request_1.BadRequestsException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const onboarding = yield __1.prismaDB.onboardingStatus.findFirst({
        where: { userId: user.id },
    });
    return res.json({
        success: true,
        onboarding: onboarding,
        message: "Fetched Onboarding",
    });
});
exports.getOnBoarding = getOnBoarding;
const saveOnBoarding = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    console.log("reqbody", req.body);
    const { userId, step, data } = req.body;
    console.log("UserId", "step", "data", userId, step, data);
    // @ts-ignore
    if (userId !== ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id)) {
        throw new bad_request_1.BadRequestsException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    yield __1.prismaDB.onboardingStatus.upsert({
        where: { userId },
        update: { currentStep: step, restaurantData: data },
        create: { userId, currentStep: step, restaurantData: data },
    });
    return res.json({
        success: true,
        message: "Saved Onboarding",
    });
});
exports.saveOnBoarding = saveOnBoarding;
const createOutlet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const { userId, body } = req.body;
    // @ts-ignore
    if (userId !== ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id)) {
        throw new bad_request_1.BadRequestsException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    if (!body.appName) {
        throw new bad_request_1.BadRequestsException("Outlet Short Name Is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!body.type || !body.planType) {
        throw new bad_request_1.BadRequestsException("Please Select neccessary plan & Outlet Type", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const findRestaurant = yield __1.prismaDB.restaurant.findFirst({
        where: {
            adminId: userId,
        },
    });
    if (findRestaurant === null || findRestaurant === void 0 ? void 0 : findRestaurant.id) {
        const outlet = yield __1.prismaDB.restaurant.update({
            where: {
                id: findRestaurant.id,
                adminId: userId,
            },
            data: {
                name: body.appName,
                address: body.address,
                pincode: body.pincode,
                GSTIN: body.gstin,
                // isSubscription: true,
                outletType: body.type,
                // subscriptionPlan: body.planType,
            },
        });
        return res.json({
            success: true,
            outletId: outlet.id,
            message: "Outlet Created",
        });
    }
    else {
        const outlet = yield __1.prismaDB.restaurant.create({
            data: {
                name: body.appName,
                adminId: userId,
                address: body.address,
                pincode: body.pincode,
                GSTIN: body.gstin,
                // isSubscription: true,
                outletType: body.type,
                // subscriptionPlan: body.planType,
            },
        });
        return res.json({
            success: true,
            outletId: outlet.id,
            message: "Outlet Created",
        });
    }
});
exports.createOutlet = createOutlet;
const updateOnboardingStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    console.log(req.body);
    const { userId } = req.body;
    // @ts-ignore
    if (userId !== ((_d = req.user) === null || _d === void 0 ? void 0 : _d.id)) {
        throw new bad_request_1.BadRequestsException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const updatedUser = yield __1.prismaDB.user.update({
        where: {
            id: userId,
        },
        data: {
            onboardingStatus: true,
        },
    });
    redis_1.redis.set(updatedUser.id, JSON.stringify(updatedUser));
    return res.json({
        success: true,
        message: "Update Success",
    });
});
exports.updateOnboardingStatus = updateOnboardingStatus;
