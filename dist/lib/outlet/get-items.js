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
exports.getFetchAllNotificationToRedis = exports.getOAllCategories = exports.getOAllItems = exports.getOAllItemsForOnlineAndDelivery = exports.getOAllMenuCategoriesToRedis = void 0;
const __1 = require("../..");
const redis_1 = require("../../services/redis");
const getOAllMenuCategoriesToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const getCategories = yield __1.prismaDB.category.findMany({
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            menuItems: {
                include: {
                    _count: true,
                },
            },
        },
    });
    const formattedCategories = getCategories.map((category) => {
        var _a;
        return ({
            id: category.id,
            name: category.name,
            description: category.description,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
            menuItems: (_a = category === null || category === void 0 ? void 0 : category.menuItems) === null || _a === void 0 ? void 0 : _a.length,
        });
    });
    yield redis_1.redis.set(`o-${outletId}-categories`, JSON.stringify(formattedCategories));
    return getCategories;
});
exports.getOAllMenuCategoriesToRedis = getOAllMenuCategoriesToRedis;
const getOAllItemsForOnlineAndDelivery = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
    const formattedItems = (_a = getItems === null || getItems === void 0 ? void 0 : getItems.filter((i) => i.isDelivery === true || i.isOnline === true)) === null || _a === void 0 ? void 0 : _a.map((menuItem) => {
        var _a, _b, _c, _d;
        return ({
            id: menuItem.id,
            shortCode: menuItem.shortCode,
            categoryId: menuItem.categoryId,
            categoryName: menuItem.category.name,
            name: menuItem.name,
            images: menuItem.images.map((image) => ({
                id: image.id,
                url: image.url,
            })),
            type: menuItem.type,
            price: menuItem.price,
            netPrice: menuItem === null || menuItem === void 0 ? void 0 : menuItem.netPrice,
            itemRecipe: {
                id: (_a = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _a === void 0 ? void 0 : _a.id,
                menuId: (_b = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _b === void 0 ? void 0 : _b.menuId,
                menuVariantId: (_c = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _c === void 0 ? void 0 : _c.menuVariantId,
                addonItemVariantId: (_d = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _d === void 0 ? void 0 : _d.addonItemVariantId,
            },
            gst: menuItem === null || menuItem === void 0 ? void 0 : menuItem.gst,
            grossProfit: menuItem === null || menuItem === void 0 ? void 0 : menuItem.grossProfit,
            isVariants: menuItem.isVariants,
            isAddOns: menuItem.isAddons,
            menuItemVariants: menuItem.menuItemVariants.map((variant) => ({
                id: variant.id,
                variantName: variant.variant.name,
                price: variant.price,
                netPrice: variant === null || variant === void 0 ? void 0 : variant.netPrice,
                gst: variant === null || variant === void 0 ? void 0 : variant.gst,
                grossProfit: variant === null || variant === void 0 ? void 0 : variant.grossProfit,
                type: variant.foodType,
            })),
            favourite: true,
            menuGroupAddOns: menuItem.menuGroupAddOns.map((addOns) => ({
                id: addOns.id,
                addOnGroupName: addOns.addOnGroups.title,
                description: addOns.addOnGroups.description,
                addonVariants: addOns.addOnGroups.addOnVariants.map((addOnVariant) => ({
                    id: addOnVariant.id,
                    name: addOnVariant.name,
                    price: addOnVariant.price,
                    type: addOnVariant.type,
                })),
            })),
        });
    });
    yield redis_1.redis.set(`${outletId}-all-items-online-and-delivery`, JSON.stringify(formattedItems));
    return getItems;
});
exports.getOAllItemsForOnlineAndDelivery = getOAllItemsForOnlineAndDelivery;
const getOAllItems = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
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
    const formattedItems = (_b = getItems === null || getItems === void 0 ? void 0 : getItems.filter((i) => i.isDineIn === true)) === null || _b === void 0 ? void 0 : _b.map((menuItem) => {
        var _a, _b, _c, _d;
        return ({
            id: menuItem.id,
            shortCode: menuItem.shortCode,
            categoryId: menuItem.categoryId,
            categoryName: menuItem.category.name,
            name: menuItem.name,
            images: menuItem.images.map((image) => ({
                id: image.id,
                url: image.url,
            })),
            type: menuItem.type,
            price: menuItem.price,
            netPrice: menuItem === null || menuItem === void 0 ? void 0 : menuItem.netPrice,
            itemRecipe: {
                id: (_a = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _a === void 0 ? void 0 : _a.id,
                menuId: (_b = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _b === void 0 ? void 0 : _b.menuId,
                menuVariantId: (_c = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _c === void 0 ? void 0 : _c.menuVariantId,
                addonItemVariantId: (_d = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _d === void 0 ? void 0 : _d.addonItemVariantId,
            },
            gst: menuItem === null || menuItem === void 0 ? void 0 : menuItem.gst,
            grossProfit: menuItem === null || menuItem === void 0 ? void 0 : menuItem.grossProfit,
            isVariants: menuItem.isVariants,
            isAddOns: menuItem.isAddons,
            menuItemVariants: menuItem.menuItemVariants.map((variant) => ({
                id: variant.id,
                variantName: variant.variant.name,
                price: variant.price,
                netPrice: variant === null || variant === void 0 ? void 0 : variant.netPrice,
                gst: variant === null || variant === void 0 ? void 0 : variant.gst,
                grossProfit: variant === null || variant === void 0 ? void 0 : variant.grossProfit,
                type: variant.foodType,
            })),
            favourite: true,
            menuGroupAddOns: menuItem.menuGroupAddOns.map((addOns) => ({
                id: addOns.id,
                addOnGroupName: addOns.addOnGroups.title,
                description: addOns.addOnGroups.description,
                addonVariants: addOns.addOnGroups.addOnVariants.map((addOnVariant) => ({
                    id: addOnVariant.id,
                    name: addOnVariant.name,
                    price: addOnVariant.price,
                    type: addOnVariant.type,
                })),
            })),
        });
    });
    yield redis_1.redis.set(`${outletId}-all-items`, JSON.stringify(formattedItems));
    return getItems;
});
exports.getOAllItems = getOAllItems;
const getOAllCategories = (outletId) => __awaiter(void 0, void 0, void 0, function* () { });
exports.getOAllCategories = getOAllCategories;
const getFetchAllNotificationToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const notifications = yield __1.prismaDB.notification.findMany({
        take: 150,
        where: {
            restaurantId: outletId,
            status: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    yield redis_1.redis.set(`o-n-${outletId}`, JSON.stringify(notifications));
    return notifications;
});
exports.getFetchAllNotificationToRedis = getFetchAllNotificationToRedis;
