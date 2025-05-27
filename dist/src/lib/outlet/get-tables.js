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
exports.getFetchAllAreastoRedis = exports.getFetchAllTablesToRedis = void 0;
const __1 = require("../..");
const redis_1 = require("../../services/redis");
const getFetchAllTablesToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const tables = yield __1.prismaDB.table.findMany({
        where: {
            restaurantId: outletId,
        },
        include: {
            orderSession: {
                include: {
                    orders: {
                        include: { orderItems: true },
                    },
                },
            },
            areas: true,
        },
        orderBy: {
            createdAt: "asc",
        },
    });
    yield redis_1.redis.set(`tables-${outletId}`, JSON.stringify(tables), "EX", 60 * 60); // 1 hour
    return tables;
});
exports.getFetchAllTablesToRedis = getFetchAllTablesToRedis;
const getFetchAllAreastoRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const allAreas = yield __1.prismaDB.areas.findMany({
        where: {
            restaurantId: outletId,
        },
        include: {
            table: {
                include: {
                    orderSession: {
                        include: {
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
                                                    images: true,
                                                    category: true,
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
                                                    itemRecipe: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            table: true,
                        },
                    },
                },
            },
        },
    });
    const filteredAreas = allAreas.map((area) => ({
        id: area.id,
        restaurantId: area.restaurantId,
        name: area.name,
        createdAt: area.createdAt,
        updatedAt: area.updatedAt,
        table: area.table.map((tab) => ({
            id: tab.id,
            restaurantId: tab.restaurantId,
            name: tab.name,
            shortCode: tab.shortCode,
            capacity: tab.capacity,
            uniqueId: tab.uniqueId,
            inviteCode: tab.inviteCode,
            qrcode: tab.qrcode,
            areaId: tab.areaId,
            currentOrderSessionId: tab.currentOrderSessionId,
            staffId: tab.staffId,
            customerId: tab.customerId,
            createdAt: tab.createdAt,
            occupied: tab.occupied,
            orderSession: tab.orderSession.map((orderSess) => {
                var _a;
                return ({
                    id: orderSess.id,
                    userName: orderSess.username,
                    billNo: orderSess.billId,
                    phoneNo: orderSess.phoneNo,
                    sessionStatus: orderSess.sessionStatus,
                    isPaid: orderSess.isPaid,
                    paymentmethod: orderSess.paymentMethod,
                    active: orderSess.active,
                    orderBy: orderSess.createdBy,
                    orderMode: orderSess.orderType,
                    table: (_a = orderSess.table) === null || _a === void 0 ? void 0 : _a.name,
                    subTotal: orderSess.subTotal,
                    orders: orderSess.orders.map((order) => ({
                        id: order.id,
                        generatedOrderId: order.generatedOrderId,
                        mode: order.orderType,
                        orderStatus: order.orderStatus,
                        paid: order.isPaid,
                        totalNetPrice: order === null || order === void 0 ? void 0 : order.totalNetPrice,
                        gstPrice: order === null || order === void 0 ? void 0 : order.gstPrice,
                        totalGrossProfit: order === null || order === void 0 ? void 0 : order.totalGrossProfit,
                        totalAmount: order.totalAmount,
                        createdAt: order.createdAt,
                        date: order.createdAt,
                        orderItems: order.orderItems.map((item) => {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                            return ({
                                id: item.id,
                                menuItem: {
                                    id: item.menuItem.id,
                                    name: item.menuItem.name,
                                    shortCode: item.menuItem.shortCode,
                                    description: item.menuItem.description,
                                    images: item.menuItem.images,
                                    categoryId: item.menuItem.categoryId,
                                    categoryName: (_a = item.menuItem.category) === null || _a === void 0 ? void 0 : _a.name,
                                    price: item.menuItem.price,
                                    netPrice: item.menuItem.netPrice,
                                    chooseProfit: item.menuItem.chooseProfit,
                                    gst: item.menuItem.gst,
                                    itemRecipe: item.menuItem.itemRecipe,
                                    grossProfit: item.menuItem.grossProfit,
                                    isVariants: item.menuItem.isVariants,
                                    menuItemVariants: (_c = (_b = item === null || item === void 0 ? void 0 : item.menuItem) === null || _b === void 0 ? void 0 : _b.menuItemVariants) === null || _c === void 0 ? void 0 : _c.map((variant) => {
                                        var _a;
                                        return ({
                                            id: variant.id,
                                            variantName: (_a = variant.variant) === null || _a === void 0 ? void 0 : _a.name,
                                            price: variant.price,
                                            netPrice: variant.netPrice,
                                            gst: variant.gst,
                                            grossProfit: variant.grossProfit,
                                            type: variant.variant.variantCategory,
                                        });
                                    }),
                                    menuGroupAddOns: item.menuItem.menuGroupAddOns.map((addOn) => ({
                                        id: addOn.id,
                                        addOnGroupName: addOn.addOnGroups.title,
                                        description: addOn.addOnGroups.description,
                                        addonVariants: addOn.addOnGroups.addOnVariants.map((variant) => ({
                                            id: variant.id,
                                            name: variant.name,
                                            price: variant.price,
                                            type: variant.type,
                                        })),
                                    })),
                                },
                                name: item.name,
                                quantity: item.quantity,
                                originalRate: item.originalRate,
                                isVariants: item.isVariants,
                                totalPrice: item.totalPrice,
                                selectedVariant: {
                                    id: (_d = item.selectedVariant) === null || _d === void 0 ? void 0 : _d.id,
                                    sizeVariantId: (_e = item.selectedVariant) === null || _e === void 0 ? void 0 : _e.sizeVariantId,
                                    name: (_f = item.selectedVariant) === null || _f === void 0 ? void 0 : _f.name,
                                    type: (_g = item.selectedVariant) === null || _g === void 0 ? void 0 : _g.type,
                                    price: (_h = item.selectedVariant) === null || _h === void 0 ? void 0 : _h.price,
                                    gst: (_j = item.selectedVariant) === null || _j === void 0 ? void 0 : _j.gst,
                                    netPrice: (_k = item.selectedVariant) === null || _k === void 0 ? void 0 : _k.netPrice,
                                    grossProfit: (_l = item.selectedVariant) === null || _l === void 0 ? void 0 : _l.grossProfit,
                                },
                                addOnSelected: item.addOnSelected.map((addOn) => ({
                                    id: addOn.id,
                                    name: addOn.name,
                                    addOnId: addOn.addOnId,
                                    selectedAddOnVariantsId: addOn.selectedAddOnVariantsId.map((variant) => ({
                                        id: variant.id,
                                        selectedAddOnVariantId: variant.selectedAddOnVariantId,
                                        name: variant.name,
                                        type: variant.type,
                                        price: variant.price,
                                    })),
                                })),
                            });
                        }),
                        updatedAt: order.updatedAt,
                    })),
                    date: orderSess.createdAt,
                });
            }),
        })),
    }));
    yield redis_1.redis.set(`a-${outletId}`, JSON.stringify(filteredAreas), "EX", 60 * 60); // 1 hour
    return filteredAreas;
});
exports.getFetchAllAreastoRedis = getFetchAllAreastoRedis;
