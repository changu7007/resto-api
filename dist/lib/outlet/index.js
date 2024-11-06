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
exports.getCategoryByOutletId = exports.getAddOnByOutletId = exports.getVariantByOutletId = exports.getItemByOutletId = exports.generatedOrderId = exports.getOrderSessionById = exports.getOrderByOutketId = exports.generateBillNo = exports.getOutletByIdForStaff = exports.getOutletByAdminId = exports.getOutletById = void 0;
const __1 = require("../..");
const not_found_1 = require("../../exceptions/not-found");
const root_1 = require("../../exceptions/root");
const getOutletById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const getOutlet = yield __1.prismaDB.restaurant.findFirst({
            where: {
                id: id,
            },
        });
        if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
            throw new not_found_1.NotFoundException("Outlet Not Found In", root_1.ErrorCode.OUTLET_NOT_FOUND);
        }
        return getOutlet;
    }
    catch (error) {
        console.log("Something Went Wrong");
    }
});
exports.getOutletById = getOutletById;
const getOutletByAdminId = (id, adminId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const getOutlet = yield __1.prismaDB.restaurant.findFirst({
            where: {
                id: id,
                adminId: adminId,
            },
        });
        if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
            throw new not_found_1.NotFoundException("Outlet Not Found In", root_1.ErrorCode.OUTLET_NOT_FOUND);
        }
        return getOutlet;
    }
    catch (error) {
        console.log("Something Went Wrong");
    }
});
exports.getOutletByAdminId = getOutletByAdminId;
const getOutletByIdForStaff = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const getOutlet = yield __1.prismaDB.restaurant.findFirst({
        where: {
            id,
        },
    });
    return getOutlet;
});
exports.getOutletByIdForStaff = getOutletByIdForStaff;
const getTodayOrdersCount = (restaurantId) => __awaiter(void 0, void 0, void 0, function* () {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const outlet = yield (0, exports.getOutletByIdForStaff)(restaurantId);
    const getOrdersCount = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            createdAt: {
                gte: startOfDay,
                lt: endOfDay,
            },
        },
    });
    return getOrdersCount.length;
});
const getTotalOrderSession = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const orderCount = yield __1.prismaDB.orderSession.findMany({
        where: {
            restaurantId: outletId,
        },
    });
    return orderCount.length;
});
const generateBillNo = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const orderCount = yield getTotalOrderSession(outletId);
    const billId = `#${orderCount + 1}`;
    return billId;
});
exports.generateBillNo = generateBillNo;
const getOrderByOutketId = (outletId, orderId) => __awaiter(void 0, void 0, void 0, function* () {
    const getOrder = yield __1.prismaDB.order.findFirst({
        where: {
            restaurantId: outletId,
            id: orderId,
        },
    });
    return getOrder;
});
exports.getOrderByOutketId = getOrderByOutketId;
const getOrderSessionById = (outletId, orderSessionId) => __awaiter(void 0, void 0, void 0, function* () {
    const getOrderSession = yield __1.prismaDB.orderSession.findFirst({
        where: {
            restaurantId: outletId,
            id: orderSessionId,
        },
        include: {
            table: true,
        },
    });
    return getOrderSession;
});
exports.getOrderSessionById = getOrderSessionById;
const generatedOrderId = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const getOrdersCount = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outletId,
            createdAt: {
                gte: startOfDay,
                lt: endOfDay,
            },
        },
    });
    const length = getOrdersCount.length;
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // last 2 digits of the year
    const month = String(now.getMonth() + 1).padStart(2, "0"); // month with leading zero
    const day = String(now.getDate()).padStart(2, "0"); // day with leading zero
    const orderNumber = String(length + 1).padStart(4, "0"); // incrementing number with leading zeros
    const orderId = `${day}${month}${year}${orderNumber}`;
    return orderId;
});
exports.generatedOrderId = generatedOrderId;
const getItemByOutletId = (outletId, itemId) => __awaiter(void 0, void 0, void 0, function* () {
    const getItem = yield __1.prismaDB.menuItem.findUnique({
        where: {
            restaurantId: outletId,
            id: itemId,
        },
        include: {
            images: true,
            menuItemVariants: true,
            menuGroupAddOns: true,
        },
    });
    return getItem;
});
exports.getItemByOutletId = getItemByOutletId;
const getVariantByOutletId = (outletId, variantId) => __awaiter(void 0, void 0, void 0, function* () {
    const getVariant = yield __1.prismaDB.variants.findUnique({
        where: {
            restaurantId: outletId,
            id: variantId,
        },
    });
    return getVariant;
});
exports.getVariantByOutletId = getVariantByOutletId;
const getAddOnByOutletId = (outletId, addOnId) => __awaiter(void 0, void 0, void 0, function* () {
    const getAddon = yield __1.prismaDB.addOns.findUnique({
        where: {
            restaurantId: outletId,
            id: addOnId,
        },
        include: {
            addOnVariants: true,
        },
    });
    return getAddon;
});
exports.getAddOnByOutletId = getAddOnByOutletId;
const getCategoryByOutletId = (outletId, categoryId) => __awaiter(void 0, void 0, void 0, function* () {
    const category = yield __1.prismaDB.category.findUnique({
        where: {
            restaurantId: outletId,
            id: categoryId,
        },
    });
    return category;
});
exports.getCategoryByOutletId = getCategoryByOutletId;
