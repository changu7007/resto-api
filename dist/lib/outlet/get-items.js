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
exports.getFetchAllNotificationToRedis = exports.getOAllCategories = exports.getOAllItems = void 0;
const __1 = require("../..");
const redis_1 = require("../../services/redis");
const getOAllItems = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const getItems = yield __1.prismaDB.menuItem.findMany({
        where: {
            restaurantId: outletId,
        },
        include: {
            category: true,
            images: true,
            menuItemVariants: {
                include: {
                    variant: true,
                },
            },
            menuGroupAddOns: {
                include: {
                    addOnGroups: {
                        include: {
                            addOnVariants: true,
                        },
                    },
                },
            },
            itemRecipe: {
                include: {
                    menuItem: true,
                    menuItemVariant: true,
                    addOnItemVariant: true,
                },
            },
        },
    });
    if ((getItems === null || getItems === void 0 ? void 0 : getItems.length) > 0) {
        yield redis_1.redis.set(`${outletId}-all-items`, JSON.stringify(getItems));
    }
    else {
        yield redis_1.redis.del(`${outletId}-all-items`);
    }
    return getItems;
});
exports.getOAllItems = getOAllItems;
const getOAllCategories = (outletId) => __awaiter(void 0, void 0, void 0, function* () { });
exports.getOAllCategories = getOAllCategories;
const getFetchAllNotificationToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const notifications = yield __1.prismaDB.notification.findMany({
        where: {
            restaurantId: outletId,
            status: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    if ((notifications === null || notifications === void 0 ? void 0 : notifications.length) > 0) {
        yield redis_1.redis.set(`o-n-${outletId}`, JSON.stringify(notifications));
    }
    else {
        yield redis_1.redis.del(`o-n-${outletId}`);
    }
    return notifications;
});
exports.getFetchAllNotificationToRedis = getFetchAllNotificationToRedis;
