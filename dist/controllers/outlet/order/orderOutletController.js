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
exports.inviteCode = exports.deleteOrderItem = exports.orderItemModification = exports.menuCardSchema = exports.getAllOrderByStaff = exports.orderStatusPatch = exports.orderessionBatchDelete = exports.orderessionDeleteById = exports.orderessionCancelPatch = exports.orderessionNamePatch = exports.orderessionPaymentModePatch = exports.existingOrderPatchApp = exports.postOrderForUser = exports.postOrderForOwner = exports.getTodayOrdersCount = exports.getTableAllOrders = exports.getTableAllSessionOrders = exports.getAllActiveSessionOrders = exports.getLiveOrders = void 0;
const client_1 = require("@prisma/client");
const __1 = require("../../..");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const outlet_1 = require("../../../lib/outlet");
const bad_request_1 = require("../../../exceptions/bad-request");
const get_users_1 = require("../../../lib/get-users");
const redis_1 = require("../../../services/redis");
const ws_1 = require("../../../services/ws");
const get_order_1 = require("../../../lib/outlet/get-order");
const orderSessionController_1 = require("./orderSession/orderSessionController");
const date_fns_1 = require("date-fns");
const unauthorized_1 = require("../../../exceptions/unauthorized");
const zod_1 = require("zod");
const getLiveOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisLiveOrder = yield redis_1.redis.get(`liv-o-${outletId}`);
    if (redisLiveOrder) {
        return res.json({
            success: true,
            liveOrders: JSON.parse(redisLiveOrder),
            message: "FETCHED UP ⚡",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const liveOrders = yield (0, get_order_1.getFetchLiveOrderToRedis)(outlet.id);
    return res.json({
        success: true,
        liveOrders,
        message: "Fetching ✅",
    });
});
exports.getLiveOrders = getLiveOrders;
const getAllActiveSessionOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisOrderActiveSession = yield redis_1.redis.get(`active-os-${outletId}`);
    if (redisOrderActiveSession) {
        return res.json({
            success: true,
            activeOrders: JSON.parse(redisOrderActiveSession),
            message: "FETCHED UP ⚡",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const activeOrders = yield (0, get_order_1.getFetchActiveOrderSessionToRedis)(outlet.id);
    return res.json({
        success: true,
        activeOrders: activeOrders,
        message: "Fetched ✅",
    });
});
exports.getAllActiveSessionOrders = getAllActiveSessionOrders;
const getTableAllSessionOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { outletId } = req.params;
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const dateRange = req.body.dateRange;
    const filters = req.body.filters || [];
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.orderSession.count({
        where: Object.assign({ restaurantId: outletId, OR: [{ billId: { contains: search, mode: "insensitive" } }], AND: filterConditions }, (dateRange && {
            createdAt: {
                gt: new Date(dateRange.from),
                lt: new Date(dateRange.to),
            },
        })),
    });
    // Fetch counts for specific payment methods and order types
    const [sessionStatusCounts, paymentMethodCounts, orderTypeCounts] = yield Promise.all([
        __1.prismaDB.orderSession.groupBy({
            by: ["sessionStatus"],
            where: Object.assign(Object.assign({ restaurantId: outletId, OR: [{ billId: { contains: search, mode: "insensitive" } }], AND: filterConditions }, (dateRange && {
                createdAt: {
                    gt: new Date(dateRange.from),
                    lt: new Date(dateRange.to),
                },
            })), { sessionStatus: { in: ["COMPLETED", "CANCELLED", "ONPROGRESS"] } }),
            _count: {
                sessionStatus: true,
            },
            _sum: {
                subTotal: true, // Calculate total revenue per payment method
            },
        }),
        __1.prismaDB.orderSession.groupBy({
            by: ["paymentMethod"],
            where: Object.assign(Object.assign({ restaurantId: outletId, OR: [{ billId: { contains: search, mode: "insensitive" } }], AND: filterConditions }, (dateRange && {
                createdAt: {
                    gt: new Date(dateRange.from),
                    lt: new Date(dateRange.to),
                },
            })), { paymentMethod: { in: ["UPI", "CASH", "DEBIT", "CREDIT"] } }),
            _count: {
                paymentMethod: true,
            },
            _sum: {
                subTotal: true, // Calculate total revenue per payment method
            },
        }),
        __1.prismaDB.orderSession.groupBy({
            by: ["orderType"],
            where: Object.assign({ restaurantId: outletId, OR: [{ billId: { contains: search, mode: "insensitive" } }], AND: filterConditions }, (dateRange && {
                createdAt: {
                    gt: new Date(dateRange.from),
                    lt: new Date(dateRange.to),
                },
            })),
            _count: {
                orderType: true,
            },
            _sum: {
                subTotal: true,
            },
        }),
    ]);
    const activeOrders = yield __1.prismaDB.orderSession.findMany({
        take,
        skip,
        where: Object.assign({ restaurantId: outletId, OR: [
                { billId: { contains: (_a = search) !== null && _a !== void 0 ? _a : "" } },
                { username: { contains: (_b = search) !== null && _b !== void 0 ? _b : "" } },
            ], AND: filterConditions }, (dateRange && {
            createdAt: {
                gt: new Date(dateRange.from),
                lt: new Date(dateRange.to),
            },
        })),
        select: {
            id: true,
            billId: true,
            username: true,
            phoneNo: true,
            isPaid: true,
            active: true,
            invoiceUrl: true,
            paymentMethod: true,
            subTotal: true,
            sessionStatus: true,
            orderType: true,
            createdAt: true,
            updatedAt: true,
            table: {
                select: {
                    name: true,
                },
            },
            orders: {
                select: {
                    id: true,
                    generatedOrderId: true,
                    orderStatus: true,
                    orderType: true,
                    createdAt: true,
                    totalAmount: true,
                    orderItems: {
                        select: {
                            id: true,
                            name: true,
                            quantity: true,
                            totalPrice: true,
                        },
                    },
                },
            },
        },
        orderBy,
    });
    const data = {
        totalCount: totalCount,
        sessionStatusStats: sessionStatusCounts === null || sessionStatusCounts === void 0 ? void 0 : sessionStatusCounts.map((item) => ({
            status: item.sessionStatus,
            count: item._count.sessionStatus,
            revenue: item._sum.subTotal || 0, // Revenue for each payment method
        })),
        paymentMethodStats: paymentMethodCounts === null || paymentMethodCounts === void 0 ? void 0 : paymentMethodCounts.map((item) => ({
            paymentMethod: item.paymentMethod,
            count: item._count.paymentMethod,
            revenue: item._sum.subTotal || 0, // Revenue for each payment method
        })),
        orderTypeCounts: orderTypeCounts === null || orderTypeCounts === void 0 ? void 0 : orderTypeCounts.map((item) => ({
            orderType: item.orderType,
            count: item._count.orderType,
        })),
        activeOrders: activeOrders === null || activeOrders === void 0 ? void 0 : activeOrders.map((order) => {
            var _a, _b;
            return ({
                id: order === null || order === void 0 ? void 0 : order.id,
                billId: order === null || order === void 0 ? void 0 : order.billId,
                userName: order === null || order === void 0 ? void 0 : order.username,
                isPaid: order === null || order === void 0 ? void 0 : order.isPaid,
                active: order === null || order === void 0 ? void 0 : order.active,
                invoiceUrl: order === null || order === void 0 ? void 0 : order.invoiceUrl,
                paymentMethod: order === null || order === void 0 ? void 0 : order.paymentMethod,
                subTotal: order === null || order === void 0 ? void 0 : order.subTotal,
                status: order === null || order === void 0 ? void 0 : order.sessionStatus,
                orderType: (order === null || order === void 0 ? void 0 : order.orderType) === "DINEIN" ? (_a = order === null || order === void 0 ? void 0 : order.table) === null || _a === void 0 ? void 0 : _a.name : order === null || order === void 0 ? void 0 : order.orderType,
                date: order === null || order === void 0 ? void 0 : order.createdAt,
                modified: order === null || order === void 0 ? void 0 : order.updatedAt,
                viewOrders: (_b = order === null || order === void 0 ? void 0 : order.orders) === null || _b === void 0 ? void 0 : _b.map((o) => {
                    var _a;
                    return ({
                        id: o === null || o === void 0 ? void 0 : o.id,
                        generatedOrderId: o === null || o === void 0 ? void 0 : o.generatedOrderId,
                        orderStatus: o === null || o === void 0 ? void 0 : o.orderStatus,
                        total: o === null || o === void 0 ? void 0 : o.totalAmount,
                        items: (_a = o === null || o === void 0 ? void 0 : o.orderItems) === null || _a === void 0 ? void 0 : _a.map((item) => ({
                            id: item === null || item === void 0 ? void 0 : item.id,
                            name: item === null || item === void 0 ? void 0 : item.name,
                            quantity: item === null || item === void 0 ? void 0 : item.quantity,
                            totalPrice: item === null || item === void 0 ? void 0 : item.totalPrice,
                        })),
                        mode: o === null || o === void 0 ? void 0 : o.orderType,
                        date: o === null || o === void 0 ? void 0 : o.createdAt,
                    });
                }),
            });
        }),
    };
    return res.json({
        success: true,
        activeOrders: data,
        message: "Fetched ✅",
    });
});
exports.getTableAllSessionOrders = getTableAllSessionOrders;
const getTableAllOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const { outletId } = req.params;
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const dateRange = req.body.dateRange;
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.order.count({
        where: Object.assign({ restaurantId: outletId, OR: [{ generatedOrderId: { contains: search, mode: "insensitive" } }], AND: filterConditions }, (dateRange && {
            createdAt: {
                gt: new Date(dateRange.from),
                lt: new Date(dateRange.to),
            },
        })),
    });
    // Fetch counts for specific payment methods and order types
    // const [paymentMethodCounts, orderTypeCounts] = await Promise.all([
    //   prismaDB.order.groupBy({
    //     by: ["paymentMethod"],
    //     where: {
    //       restaurantId: outletId,
    //       OR: [{ billId: { contains: search, mode: "insensitive" } }],
    //       AND: filterConditions,
    //       paymentMethod: { in: ["UPI", "CASH", "DEBIT", "CREDIT"] },
    //     },
    //     _count: {
    //       paymentMethod: true,
    //     },
    //     // _sum: {
    //     //   subTotal: true, // Calculate total revenue per payment method
    //     // },
    //   }),
    //   prismaDB.orderSession.groupBy({
    //     by: ["orderType"],
    //     where: {
    //       restaurantId: outletId,
    //       OR: [{ billId: { contains: search, mode: "insensitive" } }],
    //       AND: filterConditions,
    //       orderType: { in: ["DINEIN", "EXPRESS", "DELIVERY", "TAKEAWAY"] },
    //     },
    //     _count: {
    //       orderType: true,
    //     },
    //   }),
    // ]);
    const tableOrders = yield __1.prismaDB.order.findMany({
        take,
        skip,
        where: Object.assign({ restaurantId: outletId, OR: [{ generatedOrderId: { contains: (_c = search) !== null && _c !== void 0 ? _c : "" } }], AND: filterConditions }, (dateRange && {
            createdAt: {
                gt: new Date(dateRange.from),
                lt: new Date(dateRange.to),
            },
        })),
        include: {
            orderSession: true,
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
        orderBy,
    });
    const data = {
        totalCount: totalCount,
        // paymentMethodStats: paymentMethodCounts.map((item) => ({
        //   paymentMethod: item.paymentMethod,
        //   count: item._count.paymentMethod,
        //   // revenue: parseFloat(item._sum.subTotal) || 0, // Revenue for each payment method
        // })),
        // orderTypeCounts: orderTypeCounts.map((item) => ({
        //   orderType: item.orderType,
        //   count: item._count.orderType,
        // })),
        orders: tableOrders === null || tableOrders === void 0 ? void 0 : tableOrders.map((order) => {
            var _a;
            return ({
                id: order.id,
                generatedOrderId: order.generatedOrderId,
                name: (_a = order.orderSession) === null || _a === void 0 ? void 0 : _a.username,
                orderType: order.orderType,
                orderItems: order.orderItems.map((item) => {
                    var _a, _b;
                    return ({
                        id: item.id,
                        menuItem: {
                            id: item.menuItem.id,
                            name: item.menuItem.name,
                            shortCode: item.menuItem.shortCode,
                            categoryId: (_a = item.menuItem.category) === null || _a === void 0 ? void 0 : _a.id,
                            categoryName: (_b = item.menuItem.category) === null || _b === void 0 ? void 0 : _b.name,
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
                        gstPrice: (Number(item.originalRate) - parseFloat(item.netPrice || "0")) *
                            Number(item.quantity),
                        grossProfit: item.grossProfit,
                        originalRate: item.originalRate,
                        isVariants: item.isVariants,
                        totalPrice: item.totalPrice,
                        selectedVariant: item.selectedVariant,
                        addOnSelected: item.addOnSelected,
                    });
                }),
                orderStatus: order.orderStatus,
                paid: order.isPaid,
                total: Number(order.totalAmount),
                createdAt: order.createdAt,
                date: order.createdAt, // Make sure viewOrders is an array
            });
        }),
    };
    return res.json({
        success: true,
        activeOrders: data,
        message: "Fetched ✅",
    });
});
exports.getTableAllOrders = getTableAllOrders;
const getTodayOrdersCount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const getOrdersCount = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            createdAt: {
                gte: startOfDay,
                lt: endOfDay,
            },
        },
    });
    const length = getOrdersCount.length;
    return res.status(200).json({
        success: true,
        length,
        message: "Fetched Successfully",
    });
});
exports.getTodayOrdersCount = getTodayOrdersCount;
const postOrderForOwner = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    const { outletId } = req.params;
    const validTypes = Object.values(client_1.OrderType);
    const { adminId, username, isPaid, isValid, phoneNo, orderType, totalNetPrice, gstPrice, totalAmount, totalGrossProfit, orderItems, tableId, paymentMethod, orderMode, } = req.body;
    if (isValid === true && !phoneNo) {
        throw new bad_request_1.BadRequestsException("please provide Phone No", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Authorization and basic validation
    // @ts-ignore
    if (adminId !== ((_d = req.user) === null || _d === void 0 ? void 0 : _d.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    if (isPaid === true && !paymentMethod) {
        throw new bad_request_1.BadRequestsException("Please Select Payment Mode", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const [findUser, getOutlet] = yield Promise.all([
        __1.prismaDB.user.findFirst({ where: { id: adminId } }),
        (0, outlet_1.getOutletById)(outletId),
    ]);
    if (!(findUser === null || findUser === void 0 ? void 0 : findUser.id) || !(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Unauthorized Access for this operation", root_1.ErrorCode.NOT_FOUND);
    }
    if (!validTypes.includes(orderType)) {
        throw new bad_request_1.BadRequestsException("Invalid Order Type", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (orderType === "DINEIN" && !tableId) {
        throw new bad_request_1.BadRequestsException("Table ID is required for DINEIN order type", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Generate IDs
    const [orderId, billNo] = yield Promise.all([
        (0, outlet_1.generatedOrderId)(getOutlet.id),
        (0, outlet_1.generateBillNo)(getOutlet.id),
    ]);
    // Determine order status
    const orderStatus = orderMode === "KOT"
        ? "INCOMMING"
        : orderMode === "EXPRESS"
            ? "COMPLETED"
            : orderMode === "SERVED"
                ? "SERVED"
                : "FOODREADY";
    const result = yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _e, _f, _g, _h;
        yield Promise.all([
            redis_1.redis.del(`active-os-${outletId}`),
            redis_1.redis.del(`liv-o-${outletId}`),
            redis_1.redis.del(`tables-${outletId}`),
            redis_1.redis.del(`a-${outletId}`),
            redis_1.redis.del(`o-n-${outletId}`),
            redis_1.redis.del(`${outletId}-stocks`),
        ]);
        let customer;
        if (isValid) {
            customer = yield prisma.customer.findFirst({
                where: {
                    phoneNo: phoneNo,
                    restaurantAccess: {
                        some: {
                            restaurantId: getOutlet.id,
                        },
                    },
                },
            });
            if (customer) {
                customer = yield prisma.customer.update({
                    where: {
                        id: customer.id,
                    },
                    data: {
                        name: username,
                    },
                });
            }
            else {
                customer = yield prisma.customer.create({
                    data: {
                        name: username,
                        phoneNo: phoneNo,
                        restaurantAccess: {
                            create: {
                                restaurantId: getOutlet.id,
                            },
                        },
                    },
                });
            }
        }
        const orderSession = yield prisma.orderSession.create({
            data: {
                active: isPaid === true && orderStatus === "COMPLETED" ? false : true,
                sessionStatus: isPaid === true && orderStatus === "COMPLETED"
                    ? "COMPLETED"
                    : "ONPROGRESS",
                billId: ((_e = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _e === void 0 ? void 0 : _e.isGSTEnabled)
                    ? `${(_f = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _f === void 0 ? void 0 : _f.prefix}${(_g = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _g === void 0 ? void 0 : _g.invoiceNo}/${(0, date_fns_1.getYear)(new Date())}`
                    : billNo,
                orderType: orderType,
                username: username !== null && username !== void 0 ? username : findUser.name,
                phoneNo: phoneNo !== null && phoneNo !== void 0 ? phoneNo : null,
                adminId: findUser.id,
                customerId: isValid === true ? customer === null || customer === void 0 ? void 0 : customer.id : null,
                paymentMethod: isPaid ? paymentMethod : null,
                tableId: tableId,
                isPaid: isPaid,
                restaurantId: getOutlet.id,
                createdBy: `${findUser === null || findUser === void 0 ? void 0 : findUser.name} (${findUser === null || findUser === void 0 ? void 0 : findUser.role})`,
                subTotal: isPaid ? totalAmount : null,
                orders: {
                    create: {
                        restaurantId: getOutlet.id,
                        createdBy: `${findUser === null || findUser === void 0 ? void 0 : findUser.name} (${findUser === null || findUser === void 0 ? void 0 : findUser.role})`,
                        isPaid: isPaid,
                        active: true,
                        orderStatus: isPaid === true && orderStatus === "COMPLETED"
                            ? "COMPLETED"
                            : orderStatus,
                        totalNetPrice: totalNetPrice,
                        gstPrice: gstPrice,
                        totalAmount: totalAmount.toString(),
                        totalGrossProfit: totalGrossProfit,
                        generatedOrderId: orderId,
                        orderType: orderType,
                        orderItems: {
                            create: orderItems === null || orderItems === void 0 ? void 0 : orderItems.map((item) => {
                                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                                return ({
                                    menuId: item === null || item === void 0 ? void 0 : item.menuId,
                                    name: (_a = item === null || item === void 0 ? void 0 : item.menuItem) === null || _a === void 0 ? void 0 : _a.name,
                                    strike: false,
                                    isVariants: (_b = item === null || item === void 0 ? void 0 : item.menuItem) === null || _b === void 0 ? void 0 : _b.isVariants,
                                    originalRate: item === null || item === void 0 ? void 0 : item.originalPrice,
                                    quantity: item === null || item === void 0 ? void 0 : item.quantity,
                                    netPrice: item === null || item === void 0 ? void 0 : item.netPrice.toString(),
                                    gst: item === null || item === void 0 ? void 0 : item.gst,
                                    grossProfit: item === null || item === void 0 ? void 0 : item.grossProfit,
                                    totalPrice: item === null || item === void 0 ? void 0 : item.price,
                                    selectedVariant: (item === null || item === void 0 ? void 0 : item.sizeVariantsId)
                                        ? {
                                            create: {
                                                sizeVariantId: item === null || item === void 0 ? void 0 : item.sizeVariantsId,
                                                name: (_e = (_d = (_c = item === null || item === void 0 ? void 0 : item.menuItem) === null || _c === void 0 ? void 0 : _c.menuItemVariants) === null || _d === void 0 ? void 0 : _d.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _e === void 0 ? void 0 : _e.variantName,
                                                type: (_h = (_g = (_f = item === null || item === void 0 ? void 0 : item.menuItem) === null || _f === void 0 ? void 0 : _f.menuItemVariants) === null || _g === void 0 ? void 0 : _g.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _h === void 0 ? void 0 : _h.type,
                                                price: Number((_j = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _j === void 0 ? void 0 : _j.price),
                                                gst: Number((_k = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _k === void 0 ? void 0 : _k.gst),
                                                netPrice: Number((_l = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _l === void 0 ? void 0 : _l.netPrice).toString(),
                                                grossProfit: Number((_m = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _m === void 0 ? void 0 : _m.grossProfit),
                                            },
                                        }
                                        : undefined,
                                    addOnSelected: {
                                        create: (_o = item === null || item === void 0 ? void 0 : item.addOnSelected) === null || _o === void 0 ? void 0 : _o.map((addon) => {
                                            var _a, _b, _c;
                                            const groupAddOn = (_b = (_a = item === null || item === void 0 ? void 0 : item.menuItem) === null || _a === void 0 ? void 0 : _a.menuGroupAddOns) === null || _b === void 0 ? void 0 : _b.find((gAddon) => (gAddon === null || gAddon === void 0 ? void 0 : gAddon.id) === (addon === null || addon === void 0 ? void 0 : addon.id));
                                            return {
                                                addOnId: addon === null || addon === void 0 ? void 0 : addon.id,
                                                name: groupAddOn === null || groupAddOn === void 0 ? void 0 : groupAddOn.addOnGroupName,
                                                selectedAddOnVariantsId: {
                                                    create: (_c = addon === null || addon === void 0 ? void 0 : addon.selectedVariantsId) === null || _c === void 0 ? void 0 : _c.map((addOnVariant) => {
                                                        var _a;
                                                        const matchedVaraint = (_a = groupAddOn === null || groupAddOn === void 0 ? void 0 : groupAddOn.addonVariants) === null || _a === void 0 ? void 0 : _a.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.id));
                                                        return {
                                                            selectedAddOnVariantId: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.id,
                                                            name: matchedVaraint === null || matchedVaraint === void 0 ? void 0 : matchedVaraint.name,
                                                            type: matchedVaraint === null || matchedVaraint === void 0 ? void 0 : matchedVaraint.type,
                                                            price: Number(matchedVaraint === null || matchedVaraint === void 0 ? void 0 : matchedVaraint.price),
                                                        };
                                                    }),
                                                },
                                            };
                                        }),
                                    },
                                });
                            }),
                        },
                    },
                },
            },
        });
        // Update raw material stock if `chooseProfit` is "itemRecipe"
        yield Promise.all(orderItems.map((item) => __awaiter(void 0, void 0, void 0, function* () {
            const menuItem = yield prisma.menuItem.findUnique({
                where: { id: item.menuId },
                include: { itemRecipe: { include: { ingredients: true } } },
            });
            if ((menuItem === null || menuItem === void 0 ? void 0 : menuItem.chooseProfit) === "itemRecipe" && menuItem.itemRecipe) {
                yield Promise.all(menuItem.itemRecipe.ingredients.map((ingredient) => __awaiter(void 0, void 0, void 0, function* () {
                    const rawMaterial = yield prisma.rawMaterial.findUnique({
                        where: { id: ingredient.rawMaterialId },
                    });
                    if (rawMaterial) {
                        const decrementStock = (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                            Number(rawMaterial.conversionFactor);
                        if (Number(rawMaterial.currentStock) < decrementStock) {
                            throw new bad_request_1.BadRequestsException(`Insufficient stock for raw material: ${rawMaterial.name}`, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
                        }
                        yield prisma.rawMaterial.update({
                            where: { id: rawMaterial.id },
                            data: {
                                currentStock: Number(rawMaterial.currentStock) - Number(decrementStock),
                            },
                        });
                    }
                })));
            }
        })));
        if (tableId) {
            const table = yield prisma.table.findFirst({
                where: { id: tableId, restaurantId: getOutlet.id },
            });
            if (!table) {
                throw new not_found_1.NotFoundException("No Table found", root_1.ErrorCode.NOT_FOUND);
            }
            yield prisma.table.update({
                where: { id: table.id, restaurantId: getOutlet.id },
                data: {
                    occupied: true,
                    inviteCode: (0, exports.inviteCode)(),
                    currentOrderSessionId: orderSession.id,
                },
            });
        }
        yield prisma.notification.create({
            data: {
                restaurantId: getOutlet.id,
                orderId: orderId,
                message: "You have a new Order",
                orderType: tableId ? "DINEIN" : orderType,
            },
        });
        if ((_h = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _h === void 0 ? void 0 : _h.id) {
            yield prisma.invoice.update({
                where: {
                    restaurantId: getOutlet.id,
                },
                data: {
                    invoiceNo: { increment: 1 },
                },
            });
        }
        return orderSession;
    }));
    // Post-transaction tasks
    ws_1.websocketManager.notifyClients(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id, "NEW_ORDER_SESSION_CREATED");
    yield redis_1.redis.publish("orderUpdated", JSON.stringify({ outletId }));
    return res.json({
        success: true,
        orderSessionId: result.id,
        message: "Order Created from Admin ✅",
    });
});
exports.postOrderForOwner = postOrderForOwner;
const postOrderForUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _j;
    const { outletId } = req.params;
    const validTypes = Object.values(client_1.OrderType);
    const { customerId, isPaid, orderType, totalNetPrice, gstPrice, totalAmount, totalGrossProfit, orderItems, tableId, paymentId, } = req.body;
    // @ts-ignore
    if (customerId !== ((_j = req.user) === null || _j === void 0 ? void 0 : _j.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    if (orderType === "DINEIN" && !tableId) {
        throw new bad_request_1.BadRequestsException("Please logout & Scan the QR code again to place the order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validTypes.includes(orderType)) {
        throw new bad_request_1.BadRequestsException("You Need to choose either HOME DELIVERY / TAKEAWAY", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!outletId) {
        throw new bad_request_1.BadRequestsException("Outlet Id is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    return yield __1.prismaDB.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _k, _l, _m, _o, _p, _q, _r, _s, _t;
        yield Promise.all([
            redis_1.redis.del(`active-os-${outletId}`),
            redis_1.redis.del(`liv-o-${outletId}`),
            redis_1.redis.del(`tables-${outletId}`),
            redis_1.redis.del(`a-${outletId}`),
            redis_1.redis.del(`o-n-${outletId}`),
            redis_1.redis.del(`${outletId}-stocks`),
        ]);
        // Validate customer and access
        const validCustomer = yield tx.customerRestaurantAccess.findFirst({
            where: { customerId: customerId, restaurantId: outletId },
            include: { customer: true },
        });
        if (!(validCustomer === null || validCustomer === void 0 ? void 0 : validCustomer.id)) {
            throw new bad_request_1.BadRequestsException("You Need to login & place the order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        // Get outlet
        const getOutlet = yield tx.restaurant.findUnique({
            where: { id: outletId },
            include: { invoice: true },
        });
        if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
            throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
        }
        // Generate order and bill numbers
        const [orderId, billNo] = yield Promise.all([
            (0, outlet_1.generatedOrderId)(getOutlet.id),
            (0, outlet_1.generateBillNo)(getOutlet.id),
        ]);
        // Calculate totals for takeaway/delivery
        const calculate = (0, orderSessionController_1.calculateTotalsForTakewayAndDelivery)(orderItems);
        // Create base order data
        const baseOrderData = {
            active: true,
            restaurantId: getOutlet.id,
            createdBy: `${validCustomer.customer.name} (${validCustomer.customer.role})`,
            isPaid,
            generatedOrderId: orderId,
            orderType,
            totalNetPrice,
            gstPrice,
            totalAmount: totalAmount.toString(),
            totalGrossProfit,
            orderItems: {
                create: orderItems === null || orderItems === void 0 ? void 0 : orderItems.map((item) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                    return ({
                        menuId: item === null || item === void 0 ? void 0 : item.menuId,
                        name: (_a = item === null || item === void 0 ? void 0 : item.menuItem) === null || _a === void 0 ? void 0 : _a.name,
                        strike: false,
                        isVariants: (_b = item === null || item === void 0 ? void 0 : item.menuItem) === null || _b === void 0 ? void 0 : _b.isVariants,
                        originalRate: item === null || item === void 0 ? void 0 : item.originalPrice,
                        quantity: item === null || item === void 0 ? void 0 : item.quantity,
                        netPrice: item === null || item === void 0 ? void 0 : item.netPrice.toString(),
                        gst: item === null || item === void 0 ? void 0 : item.gst,
                        grossProfit: item === null || item === void 0 ? void 0 : item.grossProfit,
                        totalPrice: item === null || item === void 0 ? void 0 : item.price,
                        selectedVariant: (item === null || item === void 0 ? void 0 : item.sizeVariantsId)
                            ? {
                                create: {
                                    sizeVariantId: item === null || item === void 0 ? void 0 : item.sizeVariantsId,
                                    name: (_e = (_d = (_c = item === null || item === void 0 ? void 0 : item.menuItem) === null || _c === void 0 ? void 0 : _c.menuItemVariants) === null || _d === void 0 ? void 0 : _d.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _e === void 0 ? void 0 : _e.variantName,
                                    type: (_h = (_g = (_f = item === null || item === void 0 ? void 0 : item.menuItem) === null || _f === void 0 ? void 0 : _f.menuItemVariants) === null || _g === void 0 ? void 0 : _g.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _h === void 0 ? void 0 : _h.type,
                                    price: Number((_j = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _j === void 0 ? void 0 : _j.price),
                                    gst: Number((_k = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _k === void 0 ? void 0 : _k.gst),
                                    netPrice: Number((_l = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _l === void 0 ? void 0 : _l.netPrice).toString(),
                                    grossProfit: Number((_m = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _m === void 0 ? void 0 : _m.grossProfit),
                                },
                            }
                            : undefined,
                        addOnSelected: {
                            create: (_o = item === null || item === void 0 ? void 0 : item.addOnSelected) === null || _o === void 0 ? void 0 : _o.map((addon) => {
                                var _a, _b, _c, _d;
                                return ({
                                    addOnId: addon === null || addon === void 0 ? void 0 : addon.id,
                                    name: (_c = (_b = (_a = item === null || item === void 0 ? void 0 : item.menuItem) === null || _a === void 0 ? void 0 : _a.menuGroupAddOns) === null || _b === void 0 ? void 0 : _b.find((gAddon) => (gAddon === null || gAddon === void 0 ? void 0 : gAddon.id) === (addon === null || addon === void 0 ? void 0 : addon.id))) === null || _c === void 0 ? void 0 : _c.addOnGroupName,
                                    selectedAddOnVariantsId: {
                                        create: (_d = addon === null || addon === void 0 ? void 0 : addon.selectedVariantsId) === null || _d === void 0 ? void 0 : _d.map((addOnVariant) => {
                                            var _a, _b, _c, _d;
                                            const matchedVaraint = (_d = (_c = (_b = (_a = item === null || item === void 0 ? void 0 : item.menuItem) === null || _a === void 0 ? void 0 : _a.menuGroupAddOns) === null || _b === void 0 ? void 0 : _b.find((gAddon) => (gAddon === null || gAddon === void 0 ? void 0 : gAddon.id) === (addon === null || addon === void 0 ? void 0 : addon.id))) === null || _c === void 0 ? void 0 : _c.addonVariants) === null || _d === void 0 ? void 0 : _d.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.id));
                                            return {
                                                selectedAddOnVariantId: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.id,
                                                name: matchedVaraint === null || matchedVaraint === void 0 ? void 0 : matchedVaraint.name,
                                                type: matchedVaraint === null || matchedVaraint === void 0 ? void 0 : matchedVaraint.type,
                                                price: Number(matchedVaraint === null || matchedVaraint === void 0 ? void 0 : matchedVaraint.price),
                                            };
                                        }),
                                    },
                                });
                            }),
                        },
                    });
                }),
            },
        };
        let orderSession;
        if (orderType === client_1.OrderType.DINEIN) {
            // Handle DINEIN order
            const checkTable = yield tx.table.findFirst({
                where: { id: tableId, occupied: true },
            });
            if (!checkTable) {
                throw new bad_request_1.BadRequestsException("You Need to scan the Qr Code again to place Order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
            }
            // Create or update order session for DINEIN
            orderSession = checkTable.currentOrderSessionId
                ? yield tx.orderSession.update({
                    where: { id: checkTable.currentOrderSessionId },
                    data: {
                        orders: {
                            create: Object.assign(Object.assign({}, baseOrderData), { orderStatus: "INCOMMING" }),
                        },
                    },
                    include: {
                        orders: {
                            include: {
                                orderItems: true,
                            },
                        },
                        table: true,
                    },
                })
                : yield tx.orderSession.create({
                    data: {
                        billId: ((_k = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _k === void 0 ? void 0 : _k.isGSTEnabled)
                            ? `${(_l = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _l === void 0 ? void 0 : _l.prefix}${(_m = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _m === void 0 ? void 0 : _m.invoiceNo}/${(0, date_fns_1.getYear)(new Date())}`
                            : billNo,
                        username: validCustomer.customer.name,
                        phoneNo: validCustomer.customer.phoneNo,
                        customerId: validCustomer.id,
                        tableId,
                        restaurantId: getOutlet.id,
                        orderType,
                        orders: {
                            create: Object.assign(Object.assign({}, baseOrderData), { orderStatus: "INCOMMING" }),
                        },
                    },
                    include: {
                        orders: {
                            include: {
                                orderItems: true,
                            },
                        },
                        table: true,
                    },
                });
            // Update table if new session
            if (!checkTable.currentOrderSessionId) {
                yield tx.table.update({
                    where: { id: tableId },
                    data: { currentOrderSessionId: orderSession.id },
                });
                if ((_o = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _o === void 0 ? void 0 : _o.id) {
                    yield tx.invoice.update({
                        where: {
                            restaurantId: getOutlet.id,
                        },
                        data: {
                            invoiceNo: { increment: 1 },
                        },
                    });
                }
            }
        }
        else {
            // Handle TAKEAWAY or DELIVERY order
            orderSession = yield tx.orderSession.create({
                data: {
                    billId: ((_p = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _p === void 0 ? void 0 : _p.isGSTEnabled)
                        ? `${(_q = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _q === void 0 ? void 0 : _q.prefix}${(_r = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _r === void 0 ? void 0 : _r.invoiceNo}/${(0, date_fns_1.getYear)(new Date())}`
                        : billNo,
                    orderType,
                    username: validCustomer.customer.name,
                    phoneNo: validCustomer.customer.phoneNo,
                    customerId: validCustomer.id,
                    restaurantId: getOutlet.id,
                    isPaid: true,
                    paymentMethod: paymentId ? "UPI" : "CASH",
                    subTotal: calculate.roundedTotal,
                    orders: { create: Object.assign(Object.assign({}, baseOrderData), { orderStatus: "INCOMMING" }) },
                },
                include: {
                    orders: {
                        include: {
                            orderItems: true,
                        },
                    },
                    table: true,
                },
            });
            // Update inventory for non-DINEIN orders
            yield Promise.all(orderItems.map((item) => __awaiter(void 0, void 0, void 0, function* () {
                const menuItem = yield tx.menuItem.findUnique({
                    where: { id: item.menuId },
                    include: { itemRecipe: { include: { ingredients: true } } },
                });
                if ((menuItem === null || menuItem === void 0 ? void 0 : menuItem.chooseProfit) === "itemRecipe" && menuItem.itemRecipe) {
                    yield Promise.all(menuItem.itemRecipe.ingredients.map((ingredient) => __awaiter(void 0, void 0, void 0, function* () {
                        const rawMaterial = yield tx.rawMaterial.findUnique({
                            where: { id: ingredient.rawMaterialId },
                        });
                        if (rawMaterial) {
                            const decrementStock = (Number(ingredient.quantity) * Number(item.quantity || 1)) /
                                Number(rawMaterial.conversionFactor);
                            if (Number(rawMaterial.currentStock) < decrementStock) {
                                throw new bad_request_1.BadRequestsException(`Insufficient stock for raw material: ${rawMaterial.name}`, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
                            }
                            yield tx.rawMaterial.update({
                                where: { id: rawMaterial.id },
                                data: {
                                    currentStock: {
                                        decrement: decrementStock,
                                    },
                                },
                            });
                        }
                    })));
                }
            })));
            if ((_s = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _s === void 0 ? void 0 : _s.id) {
                yield tx.invoice.update({
                    where: {
                        restaurantId: getOutlet.id,
                    },
                    data: {
                        invoiceNo: { increment: 1 },
                    },
                });
            }
        }
        // Create notification
        yield tx.notification.create({
            data: {
                restaurantId: getOutlet.id,
                orderId,
                message: "You have a new Order",
                orderType,
            },
        });
        // Send notification
        // await NotificationService.sendNotification(
        //   getOutlet.fcmToken!,
        //   `${orderType === "DINEIN" ? `Table ${checkTable?.name}` : orderType}: New Order from ${
        //     validCustomer.customer.name
        //   }`,
        //   `Order: ${orderItems?.length}`
        // );
        // Update customer access stats
        yield tx.customerRestaurantAccess.update({
            where: {
                customerId_restaurantId: {
                    customerId: validCustomer.customer.id,
                    restaurantId: getOutlet.id,
                },
            },
            data: {
                lastVisit: new Date(),
                totalOrders: { increment: 1 },
                totalSpent: { increment: Number(totalAmount) },
            },
        });
        const orderData = {
            id: orderSession.id,
            billId: orderSession.billId,
            active: orderSession.active,
            orderType: orderSession.orderType,
            status: orderSession.sessionStatus,
            isPaid: orderSession.isPaid,
            subTotal: orderSession.subTotal,
            paymentMethod: orderSession.paymentMethod,
            orders: orderSession.orders.map((order) => ({
                id: order.id,
                orderStatus: order.orderStatus,
                totalAmount: order.totalAmount,
                orderItems: order.orderItems.map((item) => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    total: Number(item.totalPrice),
                    originalRate: Number(item.originalRate),
                })),
            })),
            customerInfo: {
                name: orderSession.username,
                phoneNo: orderSession.phoneNo,
            },
            tableInfo: orderSession.tableId
                ? {
                    name: `${(_t = orderSession.table) === null || _t === void 0 ? void 0 : _t.name}`,
                    area: "Main Area",
                }
                : undefined,
        };
        yield redis_1.redis.publish("orderUpdated", JSON.stringify({ outletId }));
        // Notify clients and update Redis
        ws_1.websocketManager.notifyClients(getOutlet.id, "NEW_ORDER_FROM_PRIME", orderData);
        return res.json({
            success: true,
            sessionId: orderSession.id,
            message: "Order Created by Customer ✅",
        });
    }));
});
exports.postOrderForUser = postOrderForUser;
const existingOrderPatchApp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _u, _v;
    const { outletId, orderId } = req.params;
    const { billerId, isPaid, totalNetPrice, gstPrice, totalAmount, totalGrossProfit, orderItems, orderMode, } = req.body;
    // @ts-ignore
    if (billerId !== ((_u = req.user) === null || _u === void 0 ? void 0 : _u.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    const [findBiller, getOutlet] = yield Promise.all([
        __1.prismaDB.user.findFirst({ where: { id: billerId } }),
        (0, outlet_1.getOutletById)(outletId),
    ]);
    if (!(findBiller === null || findBiller === void 0 ? void 0 : findBiller.id) || !(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("User or Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const getOrder = yield (0, outlet_1.getOrderSessionById)(getOutlet.id, orderId);
    if (!(getOrder === null || getOrder === void 0 ? void 0 : getOrder.id)) {
        throw new not_found_1.NotFoundException("No Current Order to Add Items", root_1.ErrorCode.NOT_FOUND);
    }
    const generatedId = yield (0, outlet_1.generatedOrderId)(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id);
    const orderStatus = orderMode === "KOT"
        ? "INCOMMING"
        : orderMode === "EXPRESS"
            ? "FOODREADY"
            : "SERVED";
    const orderSession = yield __1.prismaDB.orderSession.update({
        where: {
            restaurantId: getOutlet.id,
            id: getOrder.id,
        },
        data: {
            orderType: getOrder.orderType,
            adminId: findBiller.id,
            isPaid: isPaid,
            restaurantId: getOutlet.id,
            createdBy: findBiller === null || findBiller === void 0 ? void 0 : findBiller.name,
            orders: {
                create: {
                    active: true,
                    restaurantId: getOutlet.id,
                    isPaid: isPaid,
                    orderStatus: orderStatus,
                    totalNetPrice: totalNetPrice,
                    gstPrice: gstPrice,
                    totalAmount: totalAmount.toString(),
                    totalGrossProfit: totalGrossProfit,
                    generatedOrderId: generatedId,
                    orderType: getOrder.orderType,
                    createdBy: findBiller === null || findBiller === void 0 ? void 0 : findBiller.name,
                    orderItems: {
                        create: orderItems === null || orderItems === void 0 ? void 0 : orderItems.map((item) => {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                            return ({
                                menuId: item === null || item === void 0 ? void 0 : item.menuId,
                                name: (_a = item === null || item === void 0 ? void 0 : item.menuItem) === null || _a === void 0 ? void 0 : _a.name,
                                strike: false,
                                isVariants: (_b = item === null || item === void 0 ? void 0 : item.menuItem) === null || _b === void 0 ? void 0 : _b.isVariants,
                                originalRate: item === null || item === void 0 ? void 0 : item.originalPrice,
                                quantity: item === null || item === void 0 ? void 0 : item.quantity,
                                netPrice: item === null || item === void 0 ? void 0 : item.netPrice.toString(),
                                gst: item === null || item === void 0 ? void 0 : item.gst,
                                grossProfit: item === null || item === void 0 ? void 0 : item.grossProfit,
                                totalPrice: item === null || item === void 0 ? void 0 : item.price,
                                selectedVariant: (item === null || item === void 0 ? void 0 : item.sizeVariantsId)
                                    ? {
                                        create: {
                                            sizeVariantId: item === null || item === void 0 ? void 0 : item.sizeVariantsId,
                                            name: (_e = (_d = (_c = item === null || item === void 0 ? void 0 : item.menuItem) === null || _c === void 0 ? void 0 : _c.menuItemVariants) === null || _d === void 0 ? void 0 : _d.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _e === void 0 ? void 0 : _e.variantName,
                                            type: (_h = (_g = (_f = item === null || item === void 0 ? void 0 : item.menuItem) === null || _f === void 0 ? void 0 : _f.menuItemVariants) === null || _g === void 0 ? void 0 : _g.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _h === void 0 ? void 0 : _h.type,
                                            price: Number((_j = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _j === void 0 ? void 0 : _j.price),
                                            gst: Number((_k = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _k === void 0 ? void 0 : _k.gst),
                                            netPrice: Number((_l = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _l === void 0 ? void 0 : _l.netPrice).toString(),
                                            grossProfit: Number((_m = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _m === void 0 ? void 0 : _m.grossProfit),
                                        },
                                    }
                                    : undefined,
                                addOnSelected: {
                                    create: (_o = item === null || item === void 0 ? void 0 : item.addOnSelected) === null || _o === void 0 ? void 0 : _o.map((addon) => {
                                        var _a, _b, _c;
                                        const groupAddOn = (_b = (_a = item === null || item === void 0 ? void 0 : item.menuItem) === null || _a === void 0 ? void 0 : _a.menuGroupAddOns) === null || _b === void 0 ? void 0 : _b.find((gAddon) => (gAddon === null || gAddon === void 0 ? void 0 : gAddon.id) === (addon === null || addon === void 0 ? void 0 : addon.id));
                                        return {
                                            addOnId: addon === null || addon === void 0 ? void 0 : addon.id,
                                            name: groupAddOn === null || groupAddOn === void 0 ? void 0 : groupAddOn.addOnGroupName,
                                            selectedAddOnVariantsId: {
                                                create: (_c = addon === null || addon === void 0 ? void 0 : addon.selectedVariantsId) === null || _c === void 0 ? void 0 : _c.map((addOnVariant) => {
                                                    var _a;
                                                    const matchedVaraint = (_a = groupAddOn === null || groupAddOn === void 0 ? void 0 : groupAddOn.addonVariants) === null || _a === void 0 ? void 0 : _a.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.id));
                                                    return {
                                                        selectedAddOnVariantId: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.id,
                                                        name: matchedVaraint === null || matchedVaraint === void 0 ? void 0 : matchedVaraint.name,
                                                        type: matchedVaraint === null || matchedVaraint === void 0 ? void 0 : matchedVaraint.type,
                                                        price: Number(matchedVaraint === null || matchedVaraint === void 0 ? void 0 : matchedVaraint.price),
                                                    };
                                                }),
                                            },
                                        };
                                    }),
                                },
                            });
                        }),
                    },
                },
            },
        },
    });
    yield __1.prismaDB.notification.create({
        data: {
            restaurantId: getOutlet.id,
            orderId: generatedId,
            message: "You have a new Order",
            orderType: getOrder.orderType === "DINEIN"
                ? (_v = getOrder.table) === null || _v === void 0 ? void 0 : _v.name
                : getOrder.orderType,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`active-os-${outletId}`),
        redis_1.redis.del(`liv-o-${outletId}`),
        redis_1.redis.del(`tables-${outletId}`),
        redis_1.redis.del(`a-${outletId}`),
        redis_1.redis.del(`o-n-${outletId}`),
        redis_1.redis.del(`${outletId}-stocks`),
    ]);
    yield redis_1.redis.publish("orderUpdated", JSON.stringify({ outletId }));
    ws_1.websocketManager.notifyClients(outletId, "NEW_ORDER_SESSION_UPDATED");
    return res.json({
        success: true,
        orderSessionId: orderSession.id,
        message: "Order Added from Admin App ✅",
    });
});
exports.existingOrderPatchApp = existingOrderPatchApp;
const orderessionPaymentModePatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, outletId } = req.params;
    const validTypes = Object.values(client_1.PaymentMethod);
    const { paymentMethod } = req.body;
    if (!validTypes.includes(paymentMethod)) {
        throw new bad_request_1.BadRequestsException("Payment Mode is Invalid", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getOrderById = yield (0, outlet_1.getOrderSessionById)(outlet.id, id);
    if (!(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.id)) {
        throw new not_found_1.NotFoundException("No Order Found to Update", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.orderSession.update({
        where: {
            id: getOrderById.id,
            restaurantId: outlet.id,
        },
        data: {
            paymentMethod: paymentMethod,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`active-os-${outletId}`),
        redis_1.redis.del(`liv-o-${outletId}`),
        redis_1.redis.del(`tables-${outletId}`),
        redis_1.redis.del(`a-${outletId}`),
        redis_1.redis.del(`o-n-${outletId}`),
        redis_1.redis.del(`${outletId}-stocks`),
    ]);
    ws_1.websocketManager.notifyClients(outlet === null || outlet === void 0 ? void 0 : outlet.id, "ORDER_UPDATED");
    return res.json({
        success: true,
        message: "Payment Mode Updated ✅",
    });
});
exports.orderessionPaymentModePatch = orderessionPaymentModePatch;
const orderessionNamePatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, outletId } = req.params;
    const { name } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getOrderById = yield (0, outlet_1.getOrderSessionById)(outlet.id, id);
    if (!(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.id)) {
        throw new not_found_1.NotFoundException("No Order Found to Update", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.orderSession.update({
        where: {
            id: getOrderById.id,
            restaurantId: outlet.id,
        },
        data: {
            username: name,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`active-os-${outletId}`),
        redis_1.redis.del(`liv-o-${outletId}`),
        redis_1.redis.del(`tables-${outletId}`),
        redis_1.redis.del(`a-${outletId}`),
        redis_1.redis.del(`o-n-${outletId}`),
        redis_1.redis.del(`${outletId}-stocks`),
    ]);
    ws_1.websocketManager.notifyClients(outlet === null || outlet === void 0 ? void 0 : outlet.id, "ORDER_UPDATED");
    return res.json({
        success: true,
        message: "UserName Updated ✅",
    });
});
exports.orderessionNamePatch = orderessionNamePatch;
const orderessionCancelPatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getOrderById = yield (0, outlet_1.getOrderSessionById)(outlet.id, id);
    if (!(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.id)) {
        throw new not_found_1.NotFoundException("No Order Found to Update", root_1.ErrorCode.NOT_FOUND);
    }
    // Perform updates within a transaction
    yield __1.prismaDB.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // Refresh Redis cache
        yield Promise.all([
            redis_1.redis.del(`active-os-${outletId}`),
            redis_1.redis.del(`liv-o-${outletId}`),
            redis_1.redis.del(`tables-${outletId}`),
            redis_1.redis.del(`a-${outletId}`),
            redis_1.redis.del(`o-n-${outletId}`),
            redis_1.redis.del(`${outletId}-stocks`),
        ]);
        // Update the `orderSession` status to "CANCELLED"
        yield tx.orderSession.update({
            where: {
                id: getOrderById.id,
            },
            data: {
                sessionStatus: "CANCELLED",
                active: false,
            },
        });
        // Update all related orders' status to "CANCELLED"
        yield tx.order.updateMany({
            where: {
                orderSessionId: getOrderById.id,
                restaurantId: outletId,
            },
            data: {
                orderStatus: "CANCELLED",
            },
        });
    }));
    ws_1.websocketManager.notifyClients(outlet === null || outlet === void 0 ? void 0 : outlet.id, "ORDER_UPDATED");
    return res.json({
        success: true,
        message: "Order Transaction Cancelled✅",
    });
});
exports.orderessionCancelPatch = orderessionCancelPatch;
const orderessionDeleteById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _w;
    const { id, outletId } = req.params;
    // @ts-ignore
    const userId = (_w = req === null || req === void 0 ? void 0 : req.user) === null || _w === void 0 ? void 0 : _w.id;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const getOrderById = yield (0, outlet_1.getOrderSessionById)(outlet === null || outlet === void 0 ? void 0 : outlet.id, id);
    if (!(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.id)) {
        throw new not_found_1.NotFoundException("No Order Session Found to Delete", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.orderSession.delete({
        where: {
            id: getOrderById.id,
            restaurantId: outlet.id,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`active-os-${outletId}`),
        redis_1.redis.del(`liv-o-${outletId}`),
        redis_1.redis.del(`tables-${outletId}`),
        redis_1.redis.del(`a-${outletId}`),
        redis_1.redis.del(`o-n-${outletId}`),
        redis_1.redis.del(`${outletId}-stocks`),
    ]);
    return res.json({
        success: true,
        message: "Order Transactiion Deleted ✅",
    });
});
exports.orderessionDeleteById = orderessionDeleteById;
const orderessionBatchDelete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _x;
    const { outletId } = req.params;
    const { selectedId } = req.body;
    // @ts-ignore
    const userId = (_x = req === null || req === void 0 ? void 0 : req.user) === null || _x === void 0 ? void 0 : _x.id;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    // Validate input
    if (!Array.isArray(selectedId) || (selectedId === null || selectedId === void 0 ? void 0 : selectedId.length) === 0) {
        return res.status(400).json({
            success: false,
            message: "Please select neccessarry Order Transaction",
        });
    }
    // Perform status update within a transaction
    yield __1.prismaDB.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        yield Promise.all([
            redis_1.redis.del(`active-os-${outletId}`),
            redis_1.redis.del(`liv-o-${outletId}`),
            redis_1.redis.del(`tables-${outletId}`),
            redis_1.redis.del(`a-${outletId}`),
            redis_1.redis.del(`o-n-${outletId}`),
            redis_1.redis.del(`${outletId}-stocks`),
        ]);
        // Update related orders' statuses to "CANCELLED"
        yield tx.order.updateMany({
            where: {
                orderSessionId: {
                    in: selectedId,
                },
                restaurantId: outlet.id,
            },
            data: {
                orderStatus: "CANCELLED",
            },
        });
        // Update `orderSession` statuses to "CANCELLED"
        yield tx.orderSession.updateMany({
            where: {
                restaurantId: outlet.id,
                id: {
                    in: selectedId,
                },
            },
            data: {
                sessionStatus: "CANCELLED",
                active: false,
            },
        });
    }));
    return res.json({
        success: true,
        message: "Select Order Transaction Deleted ✅",
    });
});
exports.orderessionBatchDelete = orderessionBatchDelete;
const orderStatusPatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId, outletId } = req.params;
    const validTypes = Object.values(client_1.OrderStatus);
    const { orderStatus } = req.body;
    if (!validTypes.includes(orderStatus)) {
        throw new bad_request_1.BadRequestsException("OrderStatus is Invalid", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getOrderById = yield (0, outlet_1.getOrderByOutketId)(outlet.id, orderId);
    if (!(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.id)) {
        throw new not_found_1.NotFoundException("No Order Found to Update", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.order.updateMany({
        where: {
            id: getOrderById.id,
            restaurantId: outlet.id,
        },
        data: {
            orderStatus: orderStatus,
        },
    });
    // Update related alerts to resolved
    yield __1.prismaDB.alert.deleteMany({
        where: {
            restaurantId: outlet.id,
            orderId: orderId,
            status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
        },
    });
    const alerts = yield __1.prismaDB.alert.findMany({
        where: {
            restaurantId: outletId,
            status: {
                in: ["PENDING"],
            },
        },
        select: {
            id: true,
            type: true,
            status: true,
            priority: true,
            href: true,
            message: true,
            createdAt: true,
        },
    });
    ws_1.websocketManager.notifyClients(outletId, "NEW_ALERT");
    yield redis_1.redis.set(`alerts-${outletId}`, JSON.stringify(alerts));
    yield Promise.all([
        redis_1.redis.del(`active-os-${outletId}`),
        redis_1.redis.del(`liv-o-${outletId}`),
        redis_1.redis.del(`tables-${outletId}`),
        redis_1.redis.del(`a-${outletId}`),
        redis_1.redis.del(`o-n-${outletId}`),
        redis_1.redis.del(`${outletId}-stocks`),
    ]);
    ws_1.websocketManager.notifyClients(outlet === null || outlet === void 0 ? void 0 : outlet.id, "ORDER_UPDATED");
    return res.json({
        success: true,
        message: "Order Status Update Success ✅",
    });
});
exports.orderStatusPatch = orderStatusPatch;
const getAllOrderByStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _y;
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // @ts-ignore
    const staff = yield (0, get_users_1.getStaffById)(outletId, (_y = req.user) === null || _y === void 0 ? void 0 : _y.id);
    if (!(staff === null || staff === void 0 ? void 0 : staff.id)) {
        throw new not_found_1.NotFoundException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const getAllOrders = yield (0, get_order_1.getFetchAllStaffOrderSessionToRedis)(outlet.id, staff.id);
    return res.json({
        success: true,
        orders: getAllOrders,
        message: "Fetched ✅",
    });
});
exports.getAllOrderByStaff = getAllOrderByStaff;
exports.menuCardSchema = zod_1.z.object({
    quantity: zod_1.z.number().min(1, "Quantity must be at least 1"),
    selectedVariantId: zod_1.z.string().optional(),
    addOnSelected: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        selectedAddOnVariantsId: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string(),
            name: zod_1.z.string(),
            price: zod_1.z.number(),
        })),
    })),
    totalPrice: zod_1.z.number().min(1, "Invalid Total"),
});
const orderItemModification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId, outletId } = req.params;
    const { data: validateFields, error } = exports.menuCardSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getOrderById = yield __1.prismaDB.orderItem.findFirst({
        where: {
            id: orderId,
            order: {
                restaurantId: outletId,
            },
        },
        include: {
            order: {
                include: {
                    orderItems: true,
                    orderSession: true,
                },
            },
            menuItem: {
                include: {
                    menuItemVariants: {
                        include: {
                            variant: true,
                        },
                    },
                    menuGroupAddOns: {
                        include: {
                            addOnGroups: true,
                        },
                    },
                },
            },
            selectedVariant: true,
            addOnSelected: true,
        },
    });
    if (!(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.id)) {
        throw new not_found_1.NotFoundException("No Order Found to Update", root_1.ErrorCode.NOT_FOUND);
    }
    const txs = yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13;
        yield Promise.all([
            redis_1.redis.del(`active-os-${outletId}`),
            redis_1.redis.del(`liv-o-${outletId}`),
            redis_1.redis.del(`tables-${outletId}`),
            redis_1.redis.del(`a-${outletId}`),
            redis_1.redis.del(`o-n-${outletId}`),
            redis_1.redis.del(`${outletId}-stocks`),
        ]);
        yield prisma.orderItem.update({
            where: {
                id: getOrderById.id,
                order: { restaurantId: outlet.id },
            },
            data: {
                quantity: validateFields === null || validateFields === void 0 ? void 0 : validateFields.quantity,
                selectedVariant: validateFields.selectedVariantId
                    ? {
                        update: {
                            where: {
                                id: (_z = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.selectedVariant) === null || _z === void 0 ? void 0 : _z.id,
                            },
                            data: {
                                sizeVariantId: validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId,
                                name: (_1 = (_0 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _0 === void 0 ? void 0 : _0.variant) === null || _1 === void 0 ? void 0 : _1.name,
                                price: parseFloat((_2 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _2 === void 0 ? void 0 : _2.price),
                                gst: Number((_3 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _3 === void 0 ? void 0 : _3.gst),
                                netPrice: parseFloat((_4 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _4 === void 0 ? void 0 : _4.netPrice).toString(),
                                grossProfit: Number((_5 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _5 === void 0 ? void 0 : _5.grossProfit),
                            },
                        },
                    }
                    : undefined,
                // addOnSelected: {
                //   set: [],
                //   create: validateFields.addOnSelected.map((addOn) => ({
                //     id: addOn.id,
                //     name: addOn.name,
                //     selectedAddOnVariantsId: {
                //       create: addOn.selectedAddOnVariantsId.map((subVariant) => ({
                //         id: subVariant.id,
                //         name: subVariant.name,
                //         price: subVariant.price,
                //       })),
                //     },
                //   })),
                // },
                netPrice: !(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.isVariants)
                    ? Number((_6 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem) === null || _6 === void 0 ? void 0 : _6.netPrice).toString()
                    : Number((_7 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _7 === void 0 ? void 0 : _7.netPrice).toString(),
                originalRate: !(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.isVariants)
                    ? Number((_8 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem) === null || _8 === void 0 ? void 0 : _8.price)
                    : Number((_9 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _9 === void 0 ? void 0 : _9.price),
                grossProfit: !(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.isVariants)
                    ? Number((_10 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem) === null || _10 === void 0 ? void 0 : _10.grossProfit)
                    : Number((_11 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _11 === void 0 ? void 0 : _11.grossProfit),
                gst: !(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.isVariants)
                    ? (_12 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem) === null || _12 === void 0 ? void 0 : _12.gst
                    : (_13 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _13 === void 0 ? void 0 : _13.gst,
                totalPrice: validateFields === null || validateFields === void 0 ? void 0 : validateFields.totalPrice,
            },
        });
        const getOrder = yield prisma.orderItem.findFirst({
            where: {
                id: orderId,
                order: {
                    restaurantId: outletId,
                },
            },
            include: {
                order: {
                    include: {
                        orderItems: true,
                        orderSession: true,
                    },
                },
            },
        });
        if (!(getOrder === null || getOrder === void 0 ? void 0 : getOrder.id)) {
            throw new not_found_1.NotFoundException("No Order Found to Update", root_1.ErrorCode.NOT_FOUND);
        }
        // Recalculate the totals for the order
        const updatedOrderItems = getOrder.order.orderItems;
        const totalGrossProfit = updatedOrderItems.reduce((total, item) => total +
            (Number(Number(item.grossProfit) * Number(item === null || item === void 0 ? void 0 : item.quantity)) || 0), 0);
        const totalNetPrice = updatedOrderItems.reduce((total, item) => total +
            (Number(Number(item.netPrice) * Number(item === null || item === void 0 ? void 0 : item.quantity)) || 0), 0);
        const gstPrice = updatedOrderItems.reduce((total, item) => total +
            ((Number(item.originalRate) *
                Number(item.gst) *
                Number(item.quantity)) /
                100 || 0), 0);
        const totalAmount = updatedOrderItems.reduce((total, item) => total + item.totalPrice, 0);
        // Update the order with recalculated values
        yield prisma.order.update({
            where: {
                id: getOrder.order.id,
            },
            data: {
                totalGrossProfit,
                totalNetPrice,
                gstPrice,
                totalAmount: totalAmount.toString(),
            },
        });
    }));
    return res.json({
        success: true,
        message: "Order Item Updated Success ✅",
    });
});
exports.orderItemModification = orderItemModification;
const deleteOrderItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderItemId, outletId } = req.params;
    // Validate outlet
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Fetch the OrderItem and its parent Order
    const orderItem = yield __1.prismaDB.orderItem.findFirst({
        where: {
            id: orderItemId,
            order: {
                restaurantId: outletId,
            },
        },
        include: {
            order: {
                include: {
                    orderItems: true, // Include all order items for recalculation
                },
            },
        },
    });
    if (!(orderItem === null || orderItem === void 0 ? void 0 : orderItem.id)) {
        throw new not_found_1.NotFoundException("OrderItem Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    // Use Prisma transaction for atomic operation
    yield __1.prismaDB.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // Refresh caches after successful transaction
        yield Promise.all([
            redis_1.redis.del(`active-os-${outletId}`),
            redis_1.redis.del(`liv-o-${outletId}`),
            redis_1.redis.del(`tables-${outletId}`),
            redis_1.redis.del(`a-${outletId}`),
            redis_1.redis.del(`o-n-${outletId}`),
            redis_1.redis.del(`${outletId}-stocks`),
        ]);
        // Delete the OrderItem
        yield tx.orderItem.delete({
            where: {
                id: orderItem.id,
            },
        });
        const remainingOrderItems = orderItem.order.orderItems.filter((item) => item.id !== orderItem.id);
        // If no order items remain, delete the order
        if (remainingOrderItems.length === 0) {
            yield tx.order.delete({
                where: {
                    id: orderItem.order.id,
                },
            });
        }
        else {
            // Recalculate Order totals
            const totalGrossProfit = remainingOrderItems.reduce((total, item) => total + (Number(item.grossProfit) * Number(item.quantity) || 0), 0);
            const totalNetPrice = remainingOrderItems.reduce((total, item) => total +
                (parseFloat(item.netPrice) * Number(item.quantity) || 0), 0);
            const gstPrice = remainingOrderItems.reduce((total, item) => total + (Number(item.gst) * Number(item.quantity) || 0), 0);
            const totalAmount = remainingOrderItems.reduce((total, item) => total + item.totalPrice, 0);
            // Update the Order
            yield tx.order.update({
                where: {
                    id: orderItem.order.id,
                },
                data: {
                    totalGrossProfit,
                    totalNetPrice,
                    gstPrice,
                    totalAmount: totalAmount.toString(),
                },
            });
        }
    }));
    return res.json({
        success: true,
        message: "Order Item Deleted",
    });
});
exports.deleteOrderItem = deleteOrderItem;
const inviteCode = () => {
    let code = "";
    const MAX_LENGTH = 5;
    const alphabets = "ABCDEFGHIHJKLMNOPQRSTUVWXYZ0123456789";
    for (let i = 0; i < MAX_LENGTH; i++) {
        code += alphabets[Math.floor(Math.random() * alphabets.length)];
    }
    return code;
};
exports.inviteCode = inviteCode;
