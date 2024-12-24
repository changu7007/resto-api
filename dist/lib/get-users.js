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
exports.getCustomerById = exports.getFormatStaffAndSendToRedis = exports.getFormatUserAndSendToRedis = exports.getOwnerById = exports.getStaffById = exports.getOwnerUserByEmail = void 0;
const date_fns_1 = require("date-fns");
const __1 = require("..");
const utils_1 = require("./utils");
const not_found_1 = require("../exceptions/not-found");
const root_1 = require("../exceptions/root");
const redis_1 = require("../services/redis");
const getOwnerUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield __1.prismaDB.user.findFirst({
        where: {
            email: email,
        },
        include: { restaurant: true, billings: true },
    });
    return user;
});
exports.getOwnerUserByEmail = getOwnerUserByEmail;
const getStaffById = (outletId, id) => __awaiter(void 0, void 0, void 0, function* () {
    const staff = yield __1.prismaDB.staff.findFirst({
        where: {
            id: id,
            restaurantId: outletId,
        },
    });
    return staff;
});
exports.getStaffById = getStaffById;
const getOwnerById = (adminId) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield __1.prismaDB.user.findFirst({
        where: {
            id: adminId,
        },
    });
    return user;
});
exports.getOwnerById = getOwnerById;
const getFormatUserAndSendToRedis = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const findOwner = yield __1.prismaDB.user.findFirst({
        where: {
            id: userId,
        },
        include: {
            restaurant: true,
            billings: {
                orderBy: {
                    createdAt: "desc",
                },
            },
        },
    });
    if (!(findOwner === null || findOwner === void 0 ? void 0 : findOwner.id)) {
        throw new not_found_1.NotFoundException("User not found", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findSubscription = findOwner === null || findOwner === void 0 ? void 0 : findOwner.billings.find((billing) => (billing === null || billing === void 0 ? void 0 : billing.userId) === findOwner.id);
    const renewalDay = (findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.userId) === findOwner.id
        ? (0, utils_1.getDaysRemaining)(findSubscription.validDate)
        : 0;
    const formatToSend = {
        id: findOwner === null || findOwner === void 0 ? void 0 : findOwner.id,
        name: findOwner === null || findOwner === void 0 ? void 0 : findOwner.name,
        email: findOwner === null || findOwner === void 0 ? void 0 : findOwner.email,
        emailVerified: findOwner === null || findOwner === void 0 ? void 0 : findOwner.emailVerified,
        phoneNo: findOwner === null || findOwner === void 0 ? void 0 : findOwner.phoneNo,
        image: findOwner === null || findOwner === void 0 ? void 0 : findOwner.image,
        role: findOwner === null || findOwner === void 0 ? void 0 : findOwner.role,
        onboardingStatus: findOwner === null || findOwner === void 0 ? void 0 : findOwner.onboardingStatus,
        isSubscribed: renewalDay > 0 ? true : false,
        favItems: findOwner === null || findOwner === void 0 ? void 0 : findOwner.favItems,
        isTwoFA: findOwner === null || findOwner === void 0 ? void 0 : findOwner.isTwoFactorEnabled,
        subscriptions: findOwner === null || findOwner === void 0 ? void 0 : findOwner.billings.map((billing) => ({
            id: billing.id,
            planName: billing.subscriptionPlan,
            paymentId: billing.paymentId,
            startDate: billing.subscribedDate,
            validDate: billing.validDate,
            amount: billing.paidAmount,
            validityDays: (0, date_fns_1.differenceInDays)(new Date(billing.validDate), new Date(billing.subscribedDate)),
            purchased: billing.paymentId ? "PURCHASED" : "NOT PURCHASED",
            status: renewalDay === 0 ? "EXPIRED" : "VALID",
        })),
        toRenewal: renewalDay,
        plan: findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.subscriptionPlan,
        outlets: findOwner === null || findOwner === void 0 ? void 0 : findOwner.restaurant.map((outlet) => ({
            id: outlet.id,
            name: outlet.name,
            image: outlet.imageUrl,
        })),
    };
    yield redis_1.redis.set(userId, JSON.stringify(formatToSend));
    return formatToSend;
});
exports.getFormatUserAndSendToRedis = getFormatUserAndSendToRedis;
const getFormatStaffAndSendToRedis = (staffId) => __awaiter(void 0, void 0, void 0, function* () {
    const findStaff = yield __1.prismaDB.staff.findFirst({
        where: {
            id: staffId,
        },
        include: {
            restaurant: true,
        },
    });
    if (!(findStaff === null || findStaff === void 0 ? void 0 : findStaff.id)) {
        throw new not_found_1.NotFoundException("Staff not found", root_1.ErrorCode.UNAUTHORIZED);
    }
    const getOutlet = yield __1.prismaDB.restaurant.findFirst({
        where: {
            id: findStaff === null || findStaff === void 0 ? void 0 : findStaff.restaurantId,
        },
    });
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const findOwner = yield __1.prismaDB.user.findFirst({
        where: {
            id: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.adminId,
        },
        include: {
            restaurant: true,
            billings: true,
        },
    });
    if (!(findOwner === null || findOwner === void 0 ? void 0 : findOwner.id)) {
        throw new not_found_1.NotFoundException("Restaurant Owner not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const findSubscription = findOwner === null || findOwner === void 0 ? void 0 : findOwner.billings.find((billing) => (billing === null || billing === void 0 ? void 0 : billing.userId) === findOwner.id);
    const renewalDay = (findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.userId) === findOwner.id
        ? (0, utils_1.getDaysRemaining)(findSubscription.validDate)
        : 0;
    const formatToSend = {
        id: findStaff === null || findStaff === void 0 ? void 0 : findStaff.id,
        name: findStaff === null || findStaff === void 0 ? void 0 : findStaff.name,
        email: findStaff === null || findStaff === void 0 ? void 0 : findStaff.email,
        emailVerified: findStaff === null || findStaff === void 0 ? void 0 : findStaff.emailVerified,
        phoneNo: findStaff === null || findStaff === void 0 ? void 0 : findStaff.phoneNo,
        // image: findStaff?.image,
        role: findStaff === null || findStaff === void 0 ? void 0 : findStaff.role,
        // onboardingStatus: findStaff?.onboardingStatus,
        isSubscribed: renewalDay > 0 ? true : false,
        // isTwoFA: findStaff?.isTwoFactorEnabled,
        toRenewal: renewalDay,
        plan: findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.subscriptionPlan,
        restaurantId: findStaff === null || findStaff === void 0 ? void 0 : findStaff.restaurantId,
    };
    yield redis_1.redis.set(findStaff === null || findStaff === void 0 ? void 0 : findStaff.id, JSON.stringify(formatToSend));
    return formatToSend;
});
exports.getFormatStaffAndSendToRedis = getFormatStaffAndSendToRedis;
const getCustomerById = (id, outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const customer = yield __1.prismaDB.customer.findFirst({
        where: {
            id: id,
            restaurantId: outletId,
        },
        include: {
            orderSession: {
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
    return customer;
});
exports.getCustomerById = getCustomerById;
