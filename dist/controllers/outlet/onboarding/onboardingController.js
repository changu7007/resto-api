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
    if (!body.type) {
        throw new bad_request_1.BadRequestsException("Please Select neccessary Outlet Type", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        yield prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                pan: body.pan,
                address: (body === null || body === void 0 ? void 0 : body.isAddress) ? body === null || body === void 0 ? void 0 : body.legalAddress : body.address,
            },
        });
        const findRestaurant = yield prisma.restaurant.findFirst({
            where: {
                adminId: userId,
            },
        });
        if (findRestaurant === null || findRestaurant === void 0 ? void 0 : findRestaurant.id) {
            const outlet = yield prisma.restaurant.update({
                where: {
                    id: findRestaurant.id,
                    adminId: userId,
                },
                data: {
                    name: body.appName,
                    address: body.address,
                    restaurantName: body.name,
                    pincode: body.pincode,
                    GSTIN: body.gstin,
                    city: body.city,
                    fssai: body.fssai,
                    businessType: body === null || body === void 0 ? void 0 : body.businessType,
                    state: body.state,
                    country: body.country,
                    outletType: body.type,
                },
            });
            yield (0, get_users_1.getFormatUserAndSendToRedis)(userId);
            return res.json({
                success: true,
                outletId: outlet.id,
                message: "Outlet Created",
            });
        }
        else {
            const outlet = yield prisma.restaurant.create({
                data: {
                    name: body.appName,
                    restaurantName: body.name,
                    adminId: userId,
                    address: body.address,
                    pincode: body.pincode,
                    GSTIN: body.gstin,
                    city: body.city,
                    fssai: body.fssai,
                    state: body.state,
                    businessType: body === null || body === void 0 ? void 0 : body.businessType,
                    country: body.country,
                    outletType: body.type,
                },
            });
            yield prisma.integration.create({
                data: {
                    name: "RAZORAPY",
                    description: "Integrate your own payment for receiveing the Order",
                    logo: "https://app-restobytes.s3.ap-south-1.amazonaws.com/66710f2af99f1affa13031a5/menu/e9aecb204a19b3ff05a920ecc002e9a9a9d385dfe676a8ef5ff85dcf083165af",
                    connected: false,
                    status: true,
                    restaurantId: outlet.id,
                },
            });
            yield prisma.integration.create({
                data: {
                    name: "ZOMATO",
                    connected: false,
                    description: "Manage your Zomato Orders through our portal",
                    logo: "https://app-restobytes.s3.ap-south-1.amazonaws.com/66710f2af99f1affa13031a5/menu/6d11d26fb03ca31b3d71090afee2d3d6fc6705c4b0cc46279b094c85c1575c2a",
                    status: false,
                    restaurantId: outlet.id,
                },
            });
            yield prisma.integration.create({
                data: {
                    name: "SWIGGY",
                    connected: false,
                    description: "Manage your Swiggy Orders through our portal",
                    logo: "https://app-restobytes.s3.ap-south-1.amazonaws.com/66710f2af99f1affa13031a5/menu/0f334bb9850c0e913c5a969f5a464cf26ca55df63fe269121dae04ad802dd8bc",
                    status: false,
                    restaurantId: outlet.id,
                },
            });
            yield prisma.integration.create({
                data: {
                    name: "PHONEPE",
                    connected: false,
                    description: "To start receving payment integrate your client ID and client Secret",
                    logo: "https://app-restobytes.s3.ap-south-1.amazonaws.com/66710f2af99f1affa13031a5/menu/dac84bca0161c7e447ef9b4aff8f9b5a38632aead75e146b9911da862aa10abf",
                    status: false,
                    restaurantId: outlet.id,
                },
            });
            yield __1.prismaDB.invoice.create({
                data: {
                    restaurantId: outlet.id,
                    isGSTEnabled: true,
                    isPrefix: false,
                    invoiceNo: 1,
                    prefix: "",
                },
            });
            yield (0, get_users_1.getFormatUserAndSendToRedis)(userId);
            return res.json({
                success: true,
                outletId: outlet.id,
                message: "Outlet Created",
            });
        }
    }));
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
    yield (0, get_users_1.getFormatUserAndSendToRedis)(updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.id);
    return res.json({
        success: true,
        message: "Update Success",
    });
});
exports.updateOnboardingStatus = updateOnboardingStatus;
