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
exports.getCustomerById = exports.getFormatStaffPOSAndSendToRedis = exports.getFormatStaffAndSendToRedis = exports.getFormatUserAndSendToRedis = exports.getOwnerById = exports.getStaffById = exports.getOwnerUserByEmail = void 0;
const date_fns_1 = require("date-fns");
const __1 = require("..");
const utils_1 = require("./utils");
const not_found_1 = require("../exceptions/not-found");
const root_1 = require("../exceptions/root");
const redis_1 = require("../services/redis");
const unauthorized_1 = require("../exceptions/unauthorized");
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
            restaurant: {
                include: {
                    users: true,
                },
            },
            restaurants: {
                include: {
                    restaurant: {
                        include: {
                            users: {
                                include: {
                                    billings: {
                                        orderBy: {
                                            createdAt: "desc",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
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
    // Helper function to calculate subscription status
    const calculateSubscriptionStatus = (billings) => {
        const latestBilling = billings[0];
        if (!latestBilling)
            return { isSubscribed: false, renewalDay: 0, plan: null };
        const renewalDay = (0, utils_1.getDaysRemaining)(latestBilling.validDate);
        return {
            isSubscribed: renewalDay > 0,
            renewalDay,
            plan: latestBilling.subscriptionPlan,
            billing: latestBilling,
        };
    };
    // Handle owned restaurants (where user is admin)
    const ownedRestaurants = findOwner.restaurant.map((outlet) => {
        // For owned restaurants, use the owner's own subscription
        const ownerSubscription = calculateSubscriptionStatus(findOwner.billings);
        return {
            id: outlet.id,
            name: outlet.name,
            image: outlet.imageUrl,
            isOwner: true,
            role: "ADMIN",
            accessType: "FULL_ACCESS",
            permissions: ["FULL_ACCESS"],
            subscriptionStatus: ownerSubscription,
        };
    });
    // Handle restaurants where user has access (not owner)
    const accessibleRestaurants = findOwner.restaurants.map((access) => {
        // Get the restaurant owner's subscription details
        const restaurantOwner = access.restaurant.users; // First user is the admin/owner
        const ownerSubscription = restaurantOwner
            ? calculateSubscriptionStatus(restaurantOwner.billings)
            : { isSubscribed: false, renewalDay: 0, plan: null };
        return {
            id: access.restaurant.id,
            name: access.restaurant.name,
            image: access.restaurant.imageUrl,
            isOwner: false,
            role: access.role,
            accessType: access.accessType,
            permissions: access.permissions || [],
            subscriptionStatus: ownerSubscription,
        };
    });
    // Merge restaurants, removing duplicates
    const allRestaurants = [
        ...ownedRestaurants,
        ...accessibleRestaurants.filter((accessible) => !ownedRestaurants.some((owned) => owned.id === accessible.id)),
    ];
    // For the user's primary subscription status:
    // If they own any restaurants, use their own subscription
    // If they only have access to restaurants, use the first valid subscription from any restaurant they have access to
    const userSubscription = findOwner.billings.length > 0
        ? calculateSubscriptionStatus(findOwner.billings)
        : allRestaurants.reduce((validSub, restaurant) => {
            if (validSub.isSubscribed)
                return validSub;
            return restaurant.subscriptionStatus;
        }, { isSubscribed: false, renewalDay: 0, plan: null });
    const formatToSend = {
        id: findOwner === null || findOwner === void 0 ? void 0 : findOwner.id,
        name: findOwner === null || findOwner === void 0 ? void 0 : findOwner.name,
        email: findOwner === null || findOwner === void 0 ? void 0 : findOwner.email,
        emailVerified: findOwner === null || findOwner === void 0 ? void 0 : findOwner.emailVerified,
        phoneNo: findOwner === null || findOwner === void 0 ? void 0 : findOwner.phoneNo,
        image: findOwner === null || findOwner === void 0 ? void 0 : findOwner.image,
        role: findOwner === null || findOwner === void 0 ? void 0 : findOwner.role,
        onboardingStatus: findOwner === null || findOwner === void 0 ? void 0 : findOwner.onboardingStatus,
        isSubscribed: userSubscription.isSubscribed,
        favItems: findOwner === null || findOwner === void 0 ? void 0 : findOwner.favItems,
        isTwoFA: findOwner === null || findOwner === void 0 ? void 0 : findOwner.isTwoFactorEnabled,
        subscriptions: findOwner.billings.map((billing) => ({
            id: billing.id,
            planName: billing.subscriptionPlan,
            paymentId: billing.paymentId,
            startDate: billing.subscribedDate,
            validDate: billing.validDate,
            amount: billing.paidAmount,
            validityDays: (0, date_fns_1.differenceInDays)(new Date(billing === null || billing === void 0 ? void 0 : billing.validDate), new Date(billing === null || billing === void 0 ? void 0 : billing.subscribedDate)),
            purchased: billing.paymentId ? "PURCHASED" : "NOT PURCHASED",
            status: (0, utils_1.getDaysRemaining)(billing.validDate) <= 0 ? "EXPIRED" : "VALID",
        })),
        toRenewal: userSubscription.renewalDay,
        plan: userSubscription.plan,
        outlets: allRestaurants.map((restaurant) => ({
            id: restaurant.id,
            name: restaurant.name,
            image: restaurant.image,
            role: restaurant.role,
            isOwner: restaurant.isOwner,
            accessType: restaurant.accessType,
            permissions: restaurant.permissions,
            subscription: {
                isValid: restaurant.subscriptionStatus.isSubscribed,
                renewalDays: restaurant.subscriptionStatus.renewalDay,
                plan: restaurant.subscriptionStatus.plan,
            },
        })),
    };
    yield redis_1.redis.set(userId, JSON.stringify(formatToSend), "EX", 3 * 60 * 60); // 3 hours
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
            payroll: true,
            checkIns: {
                orderBy: {
                    checkInTime: "desc",
                },
            },
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
            billings: {
                orderBy: {
                    createdAt: "desc",
                },
            },
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
        image: findStaff === null || findStaff === void 0 ? void 0 : findStaff.image,
        role: findStaff === null || findStaff === void 0 ? void 0 : findStaff.role,
        // onboardingStatus: findStaff?.onboardingStatus,
        isSubscribed: renewalDay > 0 ? true : false,
        // isTwoFA: findStaff?.isTwoFactorEnabled,
        toRenewal: renewalDay,
        expiryDate: findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.validDate,
        plan: findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.subscriptionPlan,
        checkIns: findStaff === null || findStaff === void 0 ? void 0 : findStaff.checkIns[0],
        payroll: findStaff === null || findStaff === void 0 ? void 0 : findStaff.payroll,
        restaurant: {
            id: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id,
            name: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.name,
            image: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.imageUrl,
            adminId: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.adminId,
            address: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.address,
            phoneNo: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.phoneNo,
            email: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.email,
            outletType: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.outletType,
            restaurantName: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.restaurantName,
        },
    };
    yield redis_1.redis.set(findStaff === null || findStaff === void 0 ? void 0 : findStaff.id, JSON.stringify(formatToSend));
    return formatToSend;
});
exports.getFormatStaffAndSendToRedis = getFormatStaffAndSendToRedis;
const getFormatStaffPOSAndSendToRedis = (staffId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const findStaff = yield __1.prismaDB.staff.findFirst({
        where: {
            id: staffId,
        },
        include: {
            restaurant: true,
            cashRegisters: {
                where: {
                    status: "OPEN",
                    openedBy: staffId,
                },
                orderBy: {
                    createdAt: "desc",
                },
                take: 1,
                include: {
                    transactions: {
                        orderBy: {
                            createdAt: "desc",
                        },
                        take: 5, // Get last 5 transactions
                    },
                },
            },
            payroll: true,
            checkIns: {
                orderBy: {
                    checkInTime: "desc",
                },
                take: 1,
            },
        },
    });
    if (!(findStaff === null || findStaff === void 0 ? void 0 : findStaff.id)) {
        throw new not_found_1.NotFoundException("Staff not found", root_1.ErrorCode.UNAUTHORIZED);
    }
    if (!(findStaff === null || findStaff === void 0 ? void 0 : findStaff.posAccess)) {
        throw new unauthorized_1.UnauthorizedException("Staff not authorized for POS access", root_1.ErrorCode.UNAUTHORIZED);
    }
    // Get active cash register for the restaurant
    const activeRegister = yield __1.prismaDB.cashRegister.findFirst({
        where: {
            staff: {
                id: findStaff.id,
            },
            restaurantId: findStaff.restaurantId,
            status: "OPEN",
        },
        include: {
            staff: true,
        },
    });
    const getOutlet = yield __1.prismaDB.restaurant.findFirst({
        where: {
            id: findStaff === null || findStaff === void 0 ? void 0 : findStaff.restaurantId,
        },
    });
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Subscription checks
    const findOwner = yield __1.prismaDB.user.findFirst({
        where: {
            id: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.adminId,
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
        throw new not_found_1.NotFoundException("Restaurant Owner not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const findSubscription = findOwner === null || findOwner === void 0 ? void 0 : findOwner.billings.find((billing) => (billing === null || billing === void 0 ? void 0 : billing.userId) === findOwner.id);
    const renewalDay = (findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.userId) === findOwner.id
        ? (0, utils_1.getDaysRemaining)(findSubscription.validDate)
        : 0;
    // Calculate cash register status and permissions
    const activeSession = findStaff.cashRegisters[0];
    const isCheckedIn = ((_a = findStaff.checkIns[0]) === null || _a === void 0 ? void 0 : _a.checkOutTime) === null;
    const registerStatus = {
        currentRegisterId: (activeSession === null || activeSession === void 0 ? void 0 : activeSession.id) || null,
        hasActiveSession: !!activeSession,
        isRestaurantRegisterOpen: !!activeRegister,
        currentOperator: ((_b = activeRegister === null || activeRegister === void 0 ? void 0 : activeRegister.staff) === null || _b === void 0 ? void 0 : _b.name) || null,
        lastTransaction: (activeSession === null || activeSession === void 0 ? void 0 : activeSession.transactions[0]) || null,
        sessionStarted: (activeSession === null || activeSession === void 0 ? void 0 : activeSession.openedAt) || null,
        openingBalance: (activeSession === null || activeSession === void 0 ? void 0 : activeSession.openingBalance) || 0,
        currentBalance: activeSession ? calculateCurrentBalance(activeSession) : 0,
    };
    const posAccess = {
        canAccessPOS: findStaff.posAccess,
        requiresCheckin: !isCheckedIn,
        requiresRegister: !activeSession && findStaff.posAccess,
        isBlocked: !isCheckedIn || !findStaff.posAccess || renewalDay <= 0,
        blockReason: getBlockReason({
            isCheckedIn,
            posAccess: findStaff.posAccess,
            hasValidSubscription: renewalDay > 0,
            hasActiveRegister: !!activeSession,
        }),
    };
    const formatToSend = {
        id: findStaff === null || findStaff === void 0 ? void 0 : findStaff.id,
        name: findStaff === null || findStaff === void 0 ? void 0 : findStaff.name,
        email: findStaff === null || findStaff === void 0 ? void 0 : findStaff.email,
        emailVerified: findStaff === null || findStaff === void 0 ? void 0 : findStaff.emailVerified,
        phoneNo: findStaff === null || findStaff === void 0 ? void 0 : findStaff.phoneNo,
        image: findStaff === null || findStaff === void 0 ? void 0 : findStaff.image,
        role: findStaff === null || findStaff === void 0 ? void 0 : findStaff.role,
        favItems: findStaff === null || findStaff === void 0 ? void 0 : findStaff.favoriteMenu,
        isSubscribed: renewalDay > 0 ? true : false,
        toRenewal: renewalDay,
        expiryDate: findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.validDate,
        plan: findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.subscriptionPlan,
        checkIns: findStaff === null || findStaff === void 0 ? void 0 : findStaff.checkIns[0],
        payroll: findStaff === null || findStaff === void 0 ? void 0 : findStaff.payroll,
        posStatus: Object.assign(Object.assign({}, registerStatus), posAccess),
        restaurant: {
            id: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id,
            name: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.name,
            image: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.imageUrl,
            adminId: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.adminId,
            address: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.address,
            phoneNo: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.phoneNo,
            email: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.email,
            outletType: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.outletType,
            restaurantName: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.restaurantName,
        },
    };
    yield redis_1.redis.set(`pos-${findStaff === null || findStaff === void 0 ? void 0 : findStaff.id}`, JSON.stringify(formatToSend), "EX", 3 * 60 * 60); // 3 hours
    return formatToSend;
});
exports.getFormatStaffPOSAndSendToRedis = getFormatStaffPOSAndSendToRedis;
// Helper functions
function calculateCurrentBalance(register) {
    const openingBalance = register.openingBalance || 0;
    const transactions = register.transactions || [];
    return transactions.reduce((balance, transaction) => {
        return transaction.type === "CASH_IN"
            ? balance + transaction.amount
            : balance - transaction.amount;
    }, 0);
}
function getBlockReason({ isCheckedIn, posAccess, hasValidSubscription, hasActiveRegister, }) {
    if (!isCheckedIn)
        return "Staff must check-in first";
    if (!posAccess)
        return "No POS access permission";
    if (!hasValidSubscription)
        return "Subscription expired";
    if (!hasActiveRegister)
        return "Cash register not opened";
    return null;
}
const getCustomerById = (id, outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const customer = yield __1.prismaDB.customerRestaurantAccess.findFirst({
        where: {
            customerId: id,
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
