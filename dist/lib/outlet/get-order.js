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
exports.getFetchAllStaffOrderSessionToRedis = exports.getFetchActiveOrderSessionToRedis = exports.getFetchLiveOrderByStaffToRedis = exports.getFetchAllOrderByStaffToRedis = exports.getFetchLiveOrderToRedis = void 0;
const date_fns_1 = require("date-fns");
const __1 = require("../..");
const redis_1 = require("../../services/redis");
const getFetchLiveOrderToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const liveOrders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outletId,
            orderStatus: {
                in: ["INCOMMING", "PREPARING", "FOODREADY"],
            },
            active: true,
        },
        include: {
            orderSession: {
                include: {
                    table: true,
                },
            },
            orderItems: {
                include: {
                    selectedVariant: true,
                    addOnSelected: {
                        include: {
                            selectedAddOnVariantsId: true,
                        },
                    },
                    menuItem: {
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
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    yield redis_1.redis.set(`liv-o-${outletId}`, JSON.stringify(liveOrders));
    return liveOrders;
});
exports.getFetchLiveOrderToRedis = getFetchLiveOrderToRedis;
const getFetchAllOrderByStaffToRedis = (outletId, staffId) => __awaiter(void 0, void 0, void 0, function* () {
    const liveOrders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outletId,
            staffId: staffId,
        },
        include: {
            orderSession: {
                include: {
                    table: true,
                },
            },
            orderItems: {
                include: {
                    selectedVariant: true,
                    addOnSelected: {
                        include: {
                            selectedAddOnVariantsId: true,
                        },
                    },
                    menuItem: {
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
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    const formattedLiveOrders = liveOrders === null || liveOrders === void 0 ? void 0 : liveOrders.map((order) => {
        var _a, _b;
        return ({
            id: order.id,
            generatedOrderId: order.generatedOrderId,
            name: (_a = order === null || order === void 0 ? void 0 : order.orderSession) === null || _a === void 0 ? void 0 : _a.username,
            mode: order.orderType,
            table: (_b = order.orderSession.table) === null || _b === void 0 ? void 0 : _b.name,
            orderItems: order.orderItems.map((item) => ({
                id: item.id,
                menuItem: {
                    id: item.menuItem.id,
                    name: item.menuItem.name,
                    shortCode: item.menuItem.shortCode,
                    categoryId: item.menuItem.category.id,
                    categoryName: item.menuItem.category.name,
                    type: item.menuItem.type,
                    price: item.menuItem.price,
                    isVariants: item.menuItem.isVariants,
                    isAddOns: item.menuItem.isAddons,
                    images: item.menuItem.images.map((image) => ({
                        id: image.id,
                        url: image.url,
                    })),
                    menuItemVariants: item.menuItem.menuItemVariants.map((variant) => ({
                        id: variant.id,
                        variantName: variant.variant.name,
                        gst: variant === null || variant === void 0 ? void 0 : variant.gst,
                        netPrice: variant === null || variant === void 0 ? void 0 : variant.netPrice,
                        grossProfit: variant === null || variant === void 0 ? void 0 : variant.grossProfit,
                        price: variant.price,
                        type: variant.price,
                    })),
                    menuGroupAddOns: item.menuItem.menuGroupAddOns.map((groupAddOn) => ({
                        id: groupAddOn.id,
                        addOnGroupName: groupAddOn.addOnGroups.title,
                        description: groupAddOn.addOnGroups.description,
                        addonVariants: groupAddOn.addOnGroups.addOnVariants.map((addOnVariant) => ({
                            id: addOnVariant.id,
                            name: addOnVariant.name,
                            price: addOnVariant.price,
                            type: addOnVariant.type,
                        })),
                    })),
                },
                name: item.name,
                quantity: item.quantity,
                netPrice: item.netPrice,
                gst: item.gst,
                gstPrice: (item.originalRate - parseFloat(item.netPrice)) * Number(item.quantity),
                grossProfit: item.grossProfit,
                originalRate: item.originalRate,
                isVariants: item.isVariants,
                totalPrice: item.totalPrice,
                selectedVariant: item.selectedVariant,
                addOnSelected: item.addOnSelected,
            })),
            createdBy: order === null || order === void 0 ? void 0 : order.createdBy,
            orderStatus: order.orderStatus,
            paid: order.isPaid,
            totalAmount: Number(order.totalAmount),
            createdAt: (0, date_fns_1.formatDistanceToNow)(new Date(order.createdAt), {
                addSuffix: true,
            }),
            date: (0, date_fns_1.format)(order.createdAt, "PP"),
        });
    });
    yield redis_1.redis.set(`all-staff-orders-${outletId}-${staffId}`, JSON.stringify(formattedLiveOrders));
    return formattedLiveOrders;
});
exports.getFetchAllOrderByStaffToRedis = getFetchAllOrderByStaffToRedis;
const getFetchLiveOrderByStaffToRedis = (outletId, staffId) => __awaiter(void 0, void 0, void 0, function* () {
    const liveOrders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outletId,
            orderStatus: {
                in: ["INCOMMING", "PREPARING", "FOODREADY"],
            },
            staffId: staffId,
            active: true,
        },
        include: {
            orderSession: {
                include: {
                    table: true,
                },
            },
            orderItems: {
                include: {
                    selectedVariant: true,
                    addOnSelected: {
                        include: {
                            selectedAddOnVariantsId: true,
                        },
                    },
                    menuItem: {
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
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    const formattedLiveOrders = liveOrders === null || liveOrders === void 0 ? void 0 : liveOrders.map((order) => {
        var _a, _b;
        return ({
            id: order.id,
            generatedOrderId: order.generatedOrderId,
            name: (_a = order === null || order === void 0 ? void 0 : order.orderSession) === null || _a === void 0 ? void 0 : _a.username,
            mode: order.orderType,
            table: (_b = order.orderSession.table) === null || _b === void 0 ? void 0 : _b.name,
            orderItems: order.orderItems.map((item) => ({
                id: item.id,
                menuItem: {
                    id: item.menuItem.id,
                    name: item.menuItem.name,
                    shortCode: item.menuItem.shortCode,
                    categoryId: item.menuItem.category.id,
                    categoryName: item.menuItem.category.name,
                    type: item.menuItem.type,
                    price: item.menuItem.price,
                    isVariants: item.menuItem.isVariants,
                    isAddOns: item.menuItem.isAddons,
                    images: item.menuItem.images.map((image) => ({
                        id: image.id,
                        url: image.url,
                    })),
                    menuItemVariants: item.menuItem.menuItemVariants.map((variant) => ({
                        id: variant.id,
                        variantName: variant.variant.name,
                        gst: variant === null || variant === void 0 ? void 0 : variant.gst,
                        netPrice: variant === null || variant === void 0 ? void 0 : variant.netPrice,
                        grossProfit: variant === null || variant === void 0 ? void 0 : variant.grossProfit,
                        price: variant.price,
                        type: variant.price,
                    })),
                    menuGroupAddOns: item.menuItem.menuGroupAddOns.map((groupAddOn) => ({
                        id: groupAddOn.id,
                        addOnGroupName: groupAddOn.addOnGroups.title,
                        description: groupAddOn.addOnGroups.description,
                        addonVariants: groupAddOn.addOnGroups.addOnVariants.map((addOnVariant) => ({
                            id: addOnVariant.id,
                            name: addOnVariant.name,
                            price: addOnVariant.price,
                            type: addOnVariant.type,
                        })),
                    })),
                },
                name: item.name,
                quantity: item.quantity,
                netPrice: item.netPrice,
                gst: item.gst,
                gstPrice: (item.originalRate - parseFloat(item.netPrice)) * Number(item.quantity),
                grossProfit: item.grossProfit,
                originalRate: item.originalRate,
                isVariants: item.isVariants,
                totalPrice: item.totalPrice,
                selectedVariant: item.selectedVariant,
                addOnSelected: item.addOnSelected,
            })),
            createdBy: order === null || order === void 0 ? void 0 : order.createdBy,
            orderStatus: order.orderStatus,
            paid: order.isPaid,
            totalAmount: Number(order.totalAmount),
            createdAt: (0, date_fns_1.formatDistanceToNow)(new Date(order.createdAt), {
                addSuffix: true,
            }),
            date: (0, date_fns_1.format)(order.createdAt, "PP"),
        });
    });
    yield redis_1.redis.set(`liv-o-${outletId}-${staffId}`, JSON.stringify(formattedLiveOrders));
    return formattedLiveOrders;
});
exports.getFetchLiveOrderByStaffToRedis = getFetchLiveOrderByStaffToRedis;
const getFetchActiveOrderSessionToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const activeOrders = yield __1.prismaDB.orderSession.findMany({
        where: {
            restaurantId: outletId,
            active: true,
        },
        include: {
            table: true,
            orders: {
                include: {
                    orderItems: {
                        include: {
                            selectedVariant: true,
                            addOnSelected: {
                                include: {
                                    selectedAddOnVariantsId: true,
                                },
                            },
                            menuItem: {
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
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    yield redis_1.redis.set(`active-os-${outletId}`, JSON.stringify(activeOrders));
    return activeOrders;
});
exports.getFetchActiveOrderSessionToRedis = getFetchActiveOrderSessionToRedis;
const getFetchAllStaffOrderSessionToRedis = (outletId, staffId) => __awaiter(void 0, void 0, void 0, function* () {
    const getAllOrders = yield __1.prismaDB.orderSession.findMany({
        where: {
            restaurantId: outletId,
            staffId: staffId,
        },
        include: {
            table: true,
            orders: {
                include: {
                    orderItems: {
                        include: {
                            addOnSelected: {
                                include: {
                                    selectedAddOnVariantsId: true,
                                },
                            },
                            menuItem: {
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
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    return getAllOrders;
});
exports.getFetchAllStaffOrderSessionToRedis = getFetchAllStaffOrderSessionToRedis;
