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
exports.getFetchAllStaffOrderSessionToRedis = exports.getFetchAllOrdersToRedis = exports.getFetchAllOrderSessionToRedis = exports.getFetchActiveOrderSessionToRedis = exports.getFetchLiveOrderToRedis = void 0;
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
const getFetchAllOrderSessionToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const activeOrders = yield __1.prismaDB.orderSession.findMany({
        where: {
            restaurantId: outletId,
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
    yield redis_1.redis.set(`all-os-${outletId}`, JSON.stringify(activeOrders));
    return activeOrders;
});
exports.getFetchAllOrderSessionToRedis = getFetchAllOrderSessionToRedis;
const getFetchAllOrdersToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const getOrders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outletId,
        },
        include: {
            orderSession: true,
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
        orderBy: {
            createdAt: "desc",
        },
    });
    yield redis_1.redis.set(`all-orders-${outletId}`, JSON.stringify(getOrders));
    return getOrders;
});
exports.getFetchAllOrdersToRedis = getFetchAllOrdersToRedis;
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
    yield redis_1.redis.set(`all-order-staff-${outletId}`, JSON.stringify(getAllOrders));
    return getAllOrders;
});
exports.getFetchAllStaffOrderSessionToRedis = getFetchAllStaffOrderSessionToRedis;
