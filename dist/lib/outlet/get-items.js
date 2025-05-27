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
exports.getFetchAllNotificationToRedis = exports.getOAllCategories = exports.getOAllItems = exports.getOAllItemsForOnlineAndDelivery = exports.getOAllMenuCategoriesForOnlineAndDeliveryToRedis = exports.getOAllMenuCategoriesToRedis = void 0;
const __1 = require("../..");
const redis_1 = require("../../services/redis");
const get_inventory_1 = require("./get-inventory");
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
                select: {
                    _count: true,
                },
            },
            printLocationId: true,
        },
    });
    const formattedCategories = getCategories
        .filter((cat) => { var _a; return ((_a = cat.menuItems) === null || _a === void 0 ? void 0 : _a.length) > 0; })
        .map((category) => {
        var _a;
        return ({
            id: category.id,
            name: category.name,
            description: category.description,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
            menuItems: (_a = category === null || category === void 0 ? void 0 : category.menuItems) === null || _a === void 0 ? void 0 : _a.length,
            printLocationId: category === null || category === void 0 ? void 0 : category.printLocationId,
        });
    });
    yield redis_1.redis.set(`o-${outletId}-categories`, JSON.stringify(formattedCategories), "EX", 300);
    return formattedCategories;
});
exports.getOAllMenuCategoriesToRedis = getOAllMenuCategoriesToRedis;
const getOAllMenuCategoriesForOnlineAndDeliveryToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
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
                where: {
                    isOnline: true,
                    isDelivery: true,
                },
            },
            printLocationId: true,
        },
    });
    const formattedCategories = getCategories
        .filter((cat) => { var _a; return ((_a = cat.menuItems) === null || _a === void 0 ? void 0 : _a.length) > 0; })
        .map((category) => {
        var _a;
        return ({
            id: category.id,
            name: category.name,
            description: category.description,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
            menuItems: (_a = category === null || category === void 0 ? void 0 : category.menuItems) === null || _a === void 0 ? void 0 : _a.length,
            printLocationId: category === null || category === void 0 ? void 0 : category.printLocationId,
        });
    });
    yield redis_1.redis.set(`o-d-${outletId}-categories`, JSON.stringify(formattedCategories), "EX", 300);
    return formattedCategories;
});
exports.getOAllMenuCategoriesForOnlineAndDeliveryToRedis = getOAllMenuCategoriesForOnlineAndDeliveryToRedis;
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
    const formattedItems = yield Promise.all((_a = getItems === null || getItems === void 0 ? void 0 : getItems.filter((i) => (i === null || i === void 0 ? void 0 : i.isDineIn) === true)) === null || _a === void 0 ? void 0 : _a.map((menuItem) => __awaiter(void 0, void 0, void 0, function* () {
        var _b, _c, _d, _e, _f, _g, _h, _j;
        const servings = (menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipeId)
            ? yield (0, get_inventory_1.calculateFoodServerForItemRecipe)(menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipeId, outletId)
            : 0;
        return {
            id: menuItem === null || menuItem === void 0 ? void 0 : menuItem.id,
            name: menuItem === null || menuItem === void 0 ? void 0 : menuItem.name,
            shortCode: menuItem === null || menuItem === void 0 ? void 0 : menuItem.shortCode,
            isFeatured: menuItem === null || menuItem === void 0 ? void 0 : menuItem.isFeatured,
            inStock: menuItem === null || menuItem === void 0 ? void 0 : menuItem.isInStock,
            upSale: menuItem === null || menuItem === void 0 ? void 0 : menuItem.isUpSale,
            sku: servings,
            description: menuItem === null || menuItem === void 0 ? void 0 : menuItem.description,
            images: (_b = menuItem === null || menuItem === void 0 ? void 0 : menuItem.images) === null || _b === void 0 ? void 0 : _b.map((image) => ({
                id: image.id,
                url: image.url,
            })),
            categoryId: menuItem === null || menuItem === void 0 ? void 0 : menuItem.categoryId,
            categoryName: (_c = menuItem === null || menuItem === void 0 ? void 0 : menuItem.category) === null || _c === void 0 ? void 0 : _c.name,
            price: menuItem.price,
            netPrice: (menuItem === null || menuItem === void 0 ? void 0 : menuItem.netPrice) || "0",
            chooseProfit: menuItem === null || menuItem === void 0 ? void 0 : menuItem.chooseProfit,
            gst: (menuItem === null || menuItem === void 0 ? void 0 : menuItem.gst) || 0,
            itemRecipe: {
                id: (_d = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _d === void 0 ? void 0 : _d.id,
                menuId: ((_e = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _e === void 0 ? void 0 : _e.menuId) || null,
                menuVariantId: ((_f = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _f === void 0 ? void 0 : _f.menuVariantId) || null,
                addonItemVariantId: ((_g = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _g === void 0 ? void 0 : _g.addonItemVariantId) || null,
            },
            grossProfit: menuItem === null || menuItem === void 0 ? void 0 : menuItem.grossProfit,
            isVariants: menuItem === null || menuItem === void 0 ? void 0 : menuItem.isVariants,
            isAddOns: menuItem === null || menuItem === void 0 ? void 0 : menuItem.isAddons,
            menuItemVariants: (_h = menuItem === null || menuItem === void 0 ? void 0 : menuItem.menuItemVariants) === null || _h === void 0 ? void 0 : _h.map((variant) => {
                var _a;
                return ({
                    id: variant === null || variant === void 0 ? void 0 : variant.id,
                    variantName: (_a = variant === null || variant === void 0 ? void 0 : variant.variant) === null || _a === void 0 ? void 0 : _a.name,
                    price: variant === null || variant === void 0 ? void 0 : variant.price,
                    netPrice: variant === null || variant === void 0 ? void 0 : variant.netPrice,
                    gst: variant === null || variant === void 0 ? void 0 : variant.gst,
                    grossProfit: variant === null || variant === void 0 ? void 0 : variant.grossProfit,
                    type: variant === null || variant === void 0 ? void 0 : variant.foodType,
                });
            }),
            menuGroupAddOns: (_j = menuItem === null || menuItem === void 0 ? void 0 : menuItem.menuGroupAddOns) === null || _j === void 0 ? void 0 : _j.map((addOns) => {
                var _a, _b, _c, _d;
                return ({
                    id: addOns === null || addOns === void 0 ? void 0 : addOns.id,
                    addOnGroupName: (_a = addOns === null || addOns === void 0 ? void 0 : addOns.addOnGroups) === null || _a === void 0 ? void 0 : _a.title,
                    description: (_b = addOns === null || addOns === void 0 ? void 0 : addOns.addOnGroups) === null || _b === void 0 ? void 0 : _b.description,
                    addonVariants: (_d = (_c = addOns === null || addOns === void 0 ? void 0 : addOns.addOnGroups) === null || _c === void 0 ? void 0 : _c.addOnVariants) === null || _d === void 0 ? void 0 : _d.map((addOnVariant) => ({
                        id: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.id,
                        name: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.name,
                        netPrice: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.netPrice,
                        gst: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.gst,
                        price: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.price,
                        type: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.type,
                    })),
                });
            }),
            favourite: true,
            type: menuItem === null || menuItem === void 0 ? void 0 : menuItem.type,
        };
    })));
    yield redis_1.redis.set(`${outletId}-all-items-online-and-delivery`, JSON.stringify(formattedItems), "EX", 300);
    return formattedItems;
});
exports.getOAllItemsForOnlineAndDelivery = getOAllItemsForOnlineAndDelivery;
const getOAllItems = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    var _k;
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
    const formattedItems = yield Promise.all((_k = getItems === null || getItems === void 0 ? void 0 : getItems.filter((i) => (i === null || i === void 0 ? void 0 : i.isDineIn) === true)) === null || _k === void 0 ? void 0 : _k.map((menuItem) => __awaiter(void 0, void 0, void 0, function* () {
        var _l, _m, _o, _p, _q, _r, _s, _t;
        const servings = (menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipeId)
            ? yield (0, get_inventory_1.calculateFoodServerForItemRecipe)(menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipeId, outletId)
            : 0;
        return {
            id: menuItem === null || menuItem === void 0 ? void 0 : menuItem.id,
            name: menuItem === null || menuItem === void 0 ? void 0 : menuItem.name,
            shortCode: menuItem === null || menuItem === void 0 ? void 0 : menuItem.shortCode,
            isFeatured: menuItem === null || menuItem === void 0 ? void 0 : menuItem.isFeatured,
            inStock: menuItem === null || menuItem === void 0 ? void 0 : menuItem.isInStock,
            upSale: menuItem === null || menuItem === void 0 ? void 0 : menuItem.isUpSale,
            sku: servings,
            description: menuItem === null || menuItem === void 0 ? void 0 : menuItem.description,
            images: (_l = menuItem === null || menuItem === void 0 ? void 0 : menuItem.images) === null || _l === void 0 ? void 0 : _l.map((image) => ({
                id: image.id,
                url: image.url,
            })),
            categoryId: menuItem === null || menuItem === void 0 ? void 0 : menuItem.categoryId,
            categoryName: (_m = menuItem === null || menuItem === void 0 ? void 0 : menuItem.category) === null || _m === void 0 ? void 0 : _m.name,
            price: menuItem.price,
            netPrice: (menuItem === null || menuItem === void 0 ? void 0 : menuItem.netPrice) || "0",
            chooseProfit: menuItem === null || menuItem === void 0 ? void 0 : menuItem.chooseProfit,
            gst: (menuItem === null || menuItem === void 0 ? void 0 : menuItem.gst) || 0,
            itemRecipe: {
                id: (_o = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _o === void 0 ? void 0 : _o.id,
                menuId: ((_p = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _p === void 0 ? void 0 : _p.menuId) || null,
                menuVariantId: ((_q = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _q === void 0 ? void 0 : _q.menuVariantId) || null,
                addonItemVariantId: ((_r = menuItem === null || menuItem === void 0 ? void 0 : menuItem.itemRecipe) === null || _r === void 0 ? void 0 : _r.addonItemVariantId) || null,
            },
            grossProfit: menuItem === null || menuItem === void 0 ? void 0 : menuItem.grossProfit,
            isVariants: menuItem === null || menuItem === void 0 ? void 0 : menuItem.isVariants,
            isAddOns: menuItem === null || menuItem === void 0 ? void 0 : menuItem.isAddons,
            menuItemVariants: (_s = menuItem === null || menuItem === void 0 ? void 0 : menuItem.menuItemVariants) === null || _s === void 0 ? void 0 : _s.map((variant) => {
                var _a;
                return ({
                    id: variant === null || variant === void 0 ? void 0 : variant.id,
                    variantName: (_a = variant === null || variant === void 0 ? void 0 : variant.variant) === null || _a === void 0 ? void 0 : _a.name,
                    price: variant === null || variant === void 0 ? void 0 : variant.price,
                    netPrice: variant === null || variant === void 0 ? void 0 : variant.netPrice,
                    gst: variant === null || variant === void 0 ? void 0 : variant.gst,
                    grossProfit: variant === null || variant === void 0 ? void 0 : variant.grossProfit,
                    type: variant === null || variant === void 0 ? void 0 : variant.foodType,
                });
            }),
            menuGroupAddOns: (_t = menuItem === null || menuItem === void 0 ? void 0 : menuItem.menuGroupAddOns) === null || _t === void 0 ? void 0 : _t.map((addOns) => {
                var _a, _b, _c, _d;
                return ({
                    id: addOns === null || addOns === void 0 ? void 0 : addOns.id,
                    addOnGroupName: (_a = addOns === null || addOns === void 0 ? void 0 : addOns.addOnGroups) === null || _a === void 0 ? void 0 : _a.title,
                    description: (_b = addOns === null || addOns === void 0 ? void 0 : addOns.addOnGroups) === null || _b === void 0 ? void 0 : _b.description,
                    addonVariants: (_d = (_c = addOns === null || addOns === void 0 ? void 0 : addOns.addOnGroups) === null || _c === void 0 ? void 0 : _c.addOnVariants) === null || _d === void 0 ? void 0 : _d.map((addOnVariant) => ({
                        id: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.id,
                        name: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.name,
                        netPrice: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.netPrice,
                        gst: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.gst,
                        price: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.price,
                        type: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.type,
                    })),
                });
            }),
            favourite: true,
            type: menuItem === null || menuItem === void 0 ? void 0 : menuItem.type,
        };
    })));
    yield redis_1.redis.set(`${outletId}-all-items`, JSON.stringify(formattedItems), "EX", 300);
    return formattedItems;
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
