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
exports.inviteCode = exports.deleteOrderItem = exports.orderItemModification = exports.getAllOrderByStaff = exports.orderStatusPatch = exports.orderessionBatchDelete = exports.orderessionDeleteById = exports.orderessionCancelPatch = exports.orderessionNamePatch = exports.orderessionPaymentModePatch = exports.existingOrderPatchApp = exports.existingOrderPatch = exports.postOrderForUser = exports.postOrderForStaf = exports.postOrderForOwner = exports.getTodayOrdersCount = exports.getAllOrders = exports.getTableAllOrders = exports.getTableAllSessionOrders = exports.getAllSessionOrders = exports.getAllActiveSessionOrders = exports.getLiveOrders = void 0;
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
const get_tables_1 = require("../../../lib/outlet/get-tables");
const firebase_1 = require("../../../services/firebase");
const get_items_1 = require("../../../lib/outlet/get-items");
const orderSessionController_1 = require("./orderSession/orderSessionController");
const date_fns_1 = require("date-fns");
const unauthorized_1 = require("../../../exceptions/unauthorized");
const get_inventory_1 = require("../../../lib/outlet/get-inventory");
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
const getAllSessionOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisAllOrderSession = yield redis_1.redis.get(`all-os-${outletId}`);
    if (redisAllOrderSession) {
        return res.json({
            success: true,
            activeOrders: JSON.parse(redisAllOrderSession),
            message: "Fetched ✅",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const activeOrders = yield (0, get_order_1.getFetchAllOrderSessionToRedis)(outlet.id);
    return res.json({
        success: true,
        activeOrders,
        message: "Fetched ✅",
    });
});
exports.getAllSessionOrders = getAllSessionOrders;
const getTableAllSessionOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { outletId } = req.params;
    const search = req.body.search;
    const sorting = req.body.sorting || [];
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
        where: {
            restaurantId: outletId,
            OR: [{ billId: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    // Fetch counts for specific payment methods and order types
    const [paymentMethodCounts, orderTypeCounts] = yield Promise.all([
        __1.prismaDB.orderSession.groupBy({
            by: ["paymentMethod"],
            where: {
                restaurantId: outletId,
                OR: [{ billId: { contains: search, mode: "insensitive" } }],
                AND: filterConditions,
                paymentMethod: { in: ["UPI", "CASH", "DEBIT", "CREDIT"] },
            },
            _count: {
                paymentMethod: true,
            },
            // _sum: {
            //   subTotal: true, // Calculate total revenue per payment method
            // },
        }),
        __1.prismaDB.orderSession.groupBy({
            by: ["orderType"],
            where: {
                restaurantId: outletId,
                OR: [{ billId: { contains: search, mode: "insensitive" } }],
                AND: filterConditions,
                orderType: { in: ["DINEIN", "EXPRESS", "DELIVERY", "TAKEAWAY"] },
            },
            _count: {
                orderType: true,
            },
        }),
    ]);
    const activeOrders = yield __1.prismaDB.orderSession.findMany({
        take,
        skip,
        where: {
            restaurantId: outletId,
            OR: [
                { billId: { contains: (_a = search) !== null && _a !== void 0 ? _a : "" } },
                { username: { contains: (_b = search) !== null && _b !== void 0 ? _b : "" } },
            ],
            AND: filterConditions, // Apply filters dynamically
        },
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
        paymentMethodStats: paymentMethodCounts.map((item) => ({
            paymentMethod: item.paymentMethod,
            count: item._count.paymentMethod,
            // revenue: parseFloat(item._sum.subTotal) || 0, // Revenue for each payment method
        })),
        orderTypeCounts: orderTypeCounts.map((item) => ({
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
        where: {
            restaurantId: outletId,
            OR: [{ generatedOrderId: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
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
        where: {
            restaurantId: outletId,
            OR: [{ generatedOrderId: { contains: (_c = search) !== null && _c !== void 0 ? _c : "" } }],
            AND: filterConditions, // Apply filters dynamically
        },
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
const getAllOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisAllOrder = yield redis_1.redis.get(`all-orders-${outletId}`);
    if (redisAllOrder) {
        return res.json({
            success: true,
            orders: JSON.parse(redisAllOrder),
            message: "Fetched UP ⚡",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getOrders = yield (0, get_order_1.getFetchAllOrdersToRedis)(outlet.id);
    return res.json({
        success: true,
        orders: getOrders,
        message: "Fetched ✅",
    });
});
exports.getAllOrders = getAllOrders;
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
            : "FOODREADY";
    const result = yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _e, _f, _g, _h;
        let customer;
        if (isValid) {
            customer = yield prisma.customer.findFirst({
                where: {
                    phoneNo: phoneNo,
                    restaurantId: getOutlet.id,
                },
            });
            if (customer) {
                customer = yield prisma.customer.update({
                    where: {
                        id: customer.id,
                    },
                    data: {
                        restaurantId: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id,
                        name: username,
                    },
                });
            }
            else {
                customer = yield prisma.customer.create({
                    data: {
                        name: username,
                        phoneNo: phoneNo,
                        restaurantId: getOutlet.id,
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
                subTotal: isPaid ? totalAmount.toString() : null,
                orders: {
                    create: {
                        restaurantId: getOutlet.id,
                        createdBy: `${findUser === null || findUser === void 0 ? void 0 : findUser.name} (${findUser === null || findUser === void 0 ? void 0 : findUser.role})`,
                        isPaid: isPaid,
                        active: true,
                        orderStatus: isPaid === true && orderStatus === "COMPLETED"
                            ? orderStatus
                            : "FOODREADY",
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
                                    quantity: item === null || item === void 0 ? void 0 : item.quantity.toString(),
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
                                                price: Number((_j = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _j === void 0 ? void 0 : _j.price) * (item === null || item === void 0 ? void 0 : item.quantity),
                                                gst: Number((_k = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _k === void 0 ? void 0 : _k.gst),
                                                netPrice: (Number((_l = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _l === void 0 ? void 0 : _l.netPrice) * (item === null || item === void 0 ? void 0 : item.quantity)).toString(),
                                                grossProfit: Number((_m = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _m === void 0 ? void 0 : _m.grossProfit) * (item === null || item === void 0 ? void 0 : item.quantity),
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
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
        (0, get_items_1.getFetchAllNotificationToRedis)(outletId),
        (0, get_inventory_1.getfetchOutletStocksToRedis)(outletId),
    ]);
    ws_1.websocketManager.notifyClients(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id, "NEW_ORDER_SESSION_CREATED");
    return res.json({
        success: true,
        orderSessionId: result.id,
        message: "Order Created from Admin ✅",
    });
});
exports.postOrderForOwner = postOrderForOwner;
const postOrderForStaf = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _j;
    const { outletId } = req.params;
    const validTypes = Object.values(client_1.OrderType);
    const { billerId, username, isPaid, phoneNo, orderType, totalAmount, orderItems, tableId, orderMode, } = req.body;
    // @ts-ignore
    if (billerId !== ((_j = req.user) === null || _j === void 0 ? void 0 : _j.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findBiller = yield __1.prismaDB.staff.findFirst({
        where: {
            id: billerId,
        },
    });
    if (!(findBiller === null || findBiller === void 0 ? void 0 : findBiller.id)) {
        throw new bad_request_1.BadRequestsException("You Need to login & place the order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (orderType === "DINEIN" && !tableId) {
        throw new bad_request_1.BadRequestsException("Please Assign the table , if you have choose order type has DINEIN", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validTypes.includes(orderType)) {
        throw new bad_request_1.BadRequestsException("Please Select Order Type", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!outletId) {
        throw new bad_request_1.BadRequestsException("Outlet Id is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const orderId = yield (0, outlet_1.generatedOrderId)(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id);
    const billNo = yield (0, outlet_1.generateBillNo)(getOutlet.id);
    const orderStatus = orderMode === "KOT"
        ? "INCOMMING"
        : orderMode === "EXPRESS"
            ? "FOODREADY"
            : "SERVED";
    const orderSession = yield __1.prismaDB.orderSession.create({
        data: {
            billId: billNo,
            orderType: orderType,
            username: username !== null && username !== void 0 ? username : findBiller.name,
            phoneNo: phoneNo !== null && phoneNo !== void 0 ? phoneNo : null,
            staffId: findBiller.id,
            tableId: tableId,
            isPaid: isPaid,
            restaurantId: getOutlet.id,
            orders: {
                create: {
                    staffId: findBiller.id,
                    restaurantId: getOutlet.id,
                    isPaid: isPaid,
                    active: true,
                    orderStatus: orderStatus,
                    totalAmount: totalAmount.toString(),
                    generatedOrderId: orderId,
                    orderType: orderType,
                    orderItems: {
                        create: orderItems === null || orderItems === void 0 ? void 0 : orderItems.map((item) => {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
                            return ({
                                menuId: item === null || item === void 0 ? void 0 : item.menuId,
                                name: (_a = item === null || item === void 0 ? void 0 : item.menuItem) === null || _a === void 0 ? void 0 : _a.name,
                                strike: false,
                                isVariants: (_b = item === null || item === void 0 ? void 0 : item.menuItem) === null || _b === void 0 ? void 0 : _b.isVariants,
                                originalRate: item === null || item === void 0 ? void 0 : item.originalPrice,
                                quantity: item === null || item === void 0 ? void 0 : item.quantity.toString(),
                                totalPrice: item === null || item === void 0 ? void 0 : item.price,
                                selectedVariant: (item === null || item === void 0 ? void 0 : item.sizeVariantsId)
                                    ? {
                                        create: {
                                            sizeVariantId: item === null || item === void 0 ? void 0 : item.sizeVariantsId,
                                            name: (_e = (_d = (_c = item === null || item === void 0 ? void 0 : item.menuItem) === null || _c === void 0 ? void 0 : _c.menuItemVariants) === null || _d === void 0 ? void 0 : _d.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _e === void 0 ? void 0 : _e.variantName,
                                            type: (_h = (_g = (_f = item === null || item === void 0 ? void 0 : item.menuItem) === null || _f === void 0 ? void 0 : _f.menuItemVariants) === null || _g === void 0 ? void 0 : _g.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _h === void 0 ? void 0 : _h.type,
                                            price: Number((_l = (_k = (_j = item === null || item === void 0 ? void 0 : item.menuItem) === null || _j === void 0 ? void 0 : _j.menuItemVariants) === null || _k === void 0 ? void 0 : _k.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _l === void 0 ? void 0 : _l.price),
                                        },
                                    }
                                    : undefined,
                                addOnSelected: {
                                    create: (_m = item === null || item === void 0 ? void 0 : item.addOnSelected) === null || _m === void 0 ? void 0 : _m.map((addon) => {
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
    if (tableId) {
        const findTable = yield __1.prismaDB.table.findFirst({
            where: {
                id: tableId,
                restaurantId: getOutlet.id,
            },
        });
        if (!(findTable === null || findTable === void 0 ? void 0 : findTable.id)) {
            throw new not_found_1.NotFoundException("No Table found", root_1.ErrorCode.NOT_FOUND);
        }
        else {
            yield __1.prismaDB.table.update({
                where: {
                    id: findTable.id,
                    restaurantId: getOutlet.id,
                },
                data: {
                    occupied: true,
                    currentOrderSessionId: orderSession.id,
                },
            });
            yield __1.prismaDB.notification.create({
                data: {
                    restaurantId: getOutlet.id,
                    orderId: orderId,
                    message: "You have a new Order",
                    orderType: findTable.name,
                },
            });
            yield Promise.all([
                (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
                (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
                (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
                (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
                (0, get_order_1.getFetchAllStaffOrderSessionToRedis)(outletId, findBiller.id),
                (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
                (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
                (0, get_items_1.getFetchAllNotificationToRedis)(outletId),
            ]);
            ws_1.websocketManager.notifyClients(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id, "NEW_ORDER_SESSION_CREATED");
            return res.json({
                success: true,
                orderSessionId: orderSession.id,
                message: "Order Created from Biller ✅",
            });
        }
    }
    else {
        yield __1.prismaDB.notification.create({
            data: {
                restaurantId: getOutlet.id,
                orderId: orderId,
                message: "You have a new Order",
                orderType: orderType,
            },
        });
        yield Promise.all([
            (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
            (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
            (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
            (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
            (0, get_order_1.getFetchAllStaffOrderSessionToRedis)(outletId, findBiller.id),
            (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
            (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
            (0, get_items_1.getFetchAllNotificationToRedis)(outletId),
        ]);
        ws_1.websocketManager.notifyClients(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id, "NEW_ORDER_SESSION_CREATED");
        return res.json({
            success: true,
            orderSessionId: orderSession.id,
            message: "Order Created from Biller ✅",
        });
    }
});
exports.postOrderForStaf = postOrderForStaf;
const postOrderForUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _k;
    const { outletId } = req.params;
    const validTypes = Object.values(client_1.OrderType);
    const { customerId, isPaid, orderType, totalAmount, orderItems, tableId, paymentId, } = req.body;
    // @ts-ignore
    if (customerId !== ((_k = req.user) === null || _k === void 0 ? void 0 : _k.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    const validCustomer = yield __1.prismaDB.customer.findFirst({
        where: {
            id: customerId,
        },
    });
    if (!(validCustomer === null || validCustomer === void 0 ? void 0 : validCustomer.id)) {
        throw new bad_request_1.BadRequestsException("You Need to login & place the order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (orderType === "DINEIN" && !tableId) {
        throw new bad_request_1.BadRequestsException("Please logout & Scan the QR code again to place the order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validTypes.includes(orderType)) {
        throw new bad_request_1.BadRequestsException("You Need to choose either HOME DELIVERY / TAKEAWAY ", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!outletId) {
        throw new bad_request_1.BadRequestsException("Outlet Id is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const calculate = (0, orderSessionController_1.calculateTotalsForTakewayAndDelivery)(orderItems);
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const orderId = yield (0, outlet_1.generatedOrderId)(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id);
    const billNo = yield (0, outlet_1.generateBillNo)(getOutlet.id);
    let orderSession;
    // Helper function to create order data
    const createOrderData = (restaurantId, isPaid, orderId, orderType, totalAmount, orderStatus, orderItems) => {
        return {
            active: true,
            restaurantId: restaurantId,
            isPaid: isPaid,
            generatedOrderId: orderId,
            orderType: orderType,
            totalAmount: totalAmount.toString(),
            orderStatus: orderStatus,
            orderItems: {
                create: orderItems === null || orderItems === void 0 ? void 0 : orderItems.map((item) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
                    return ({
                        menuId: item === null || item === void 0 ? void 0 : item.menuId,
                        name: (_a = item === null || item === void 0 ? void 0 : item.menuItem) === null || _a === void 0 ? void 0 : _a.name,
                        strike: false,
                        isVariants: (_b = item === null || item === void 0 ? void 0 : item.menuItem) === null || _b === void 0 ? void 0 : _b.isVariants,
                        originalRate: item === null || item === void 0 ? void 0 : item.originalPrice,
                        quantity: item === null || item === void 0 ? void 0 : item.quantity.toString(),
                        totalPrice: item === null || item === void 0 ? void 0 : item.price,
                        selectedVariant: (item === null || item === void 0 ? void 0 : item.sizeVariantsId)
                            ? {
                                create: {
                                    sizeVariantId: item === null || item === void 0 ? void 0 : item.sizeVariantsId,
                                    name: (_e = (_d = (_c = item === null || item === void 0 ? void 0 : item.menuItem) === null || _c === void 0 ? void 0 : _c.menuItemVariants) === null || _d === void 0 ? void 0 : _d.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _e === void 0 ? void 0 : _e.variantName,
                                    type: (_h = (_g = (_f = item === null || item === void 0 ? void 0 : item.menuItem) === null || _f === void 0 ? void 0 : _f.menuItemVariants) === null || _g === void 0 ? void 0 : _g.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _h === void 0 ? void 0 : _h.type,
                                    price: Number((_l = (_k = (_j = item === null || item === void 0 ? void 0 : item.menuItem) === null || _j === void 0 ? void 0 : _j.menuItemVariants) === null || _k === void 0 ? void 0 : _k.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _l === void 0 ? void 0 : _l.price),
                                },
                            }
                            : undefined,
                        addOnSelected: {
                            create: (_m = item === null || item === void 0 ? void 0 : item.addOnSelected) === null || _m === void 0 ? void 0 : _m.map((addon) => {
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
        };
    };
    if (orderType === client_1.OrderType.DINEIN) {
        if (!tableId) {
            throw new bad_request_1.BadRequestsException("Table ID is required for DINEIN orders", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        const checkTable = yield __1.prismaDB.table.findFirst({
            where: { id: tableId, occupied: true },
        });
        if (!checkTable) {
            throw new bad_request_1.BadRequestsException("You Need to scan the Qr Code again to place Order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        // Check if there's an existing order session for DINEIN
        if (checkTable.currentOrderSessionId) {
            // If there's an existing session, add the order to it
            orderSession = yield __1.prismaDB.orderSession.update({
                where: { id: checkTable.currentOrderSessionId },
                data: {
                    orders: {
                        create: createOrderData(getOutlet.id, isPaid, orderId, orderType, totalAmount, "INCOMMING", orderItems),
                    },
                },
            });
        }
        else {
            // If there's no existing session, create a new one
            orderSession = yield __1.prismaDB.orderSession.create({
                data: {
                    billId: billNo,
                    username: validCustomer.name,
                    phoneNo: validCustomer.phoneNo,
                    customerId: validCustomer.id,
                    tableId: tableId,
                    restaurantId: getOutlet.id,
                    orderType: orderType,
                    orders: {
                        create: createOrderData(getOutlet.id, isPaid, orderId, orderType, totalAmount, "INCOMMING", orderItems),
                    },
                },
            });
            // Update the table with the new orderSessionId
            yield __1.prismaDB.table.update({
                where: { id: tableId },
                data: { currentOrderSessionId: orderSession.id },
            });
        }
        yield firebase_1.NotificationService.sendNotification(getOutlet.fcmToken, `You have got new Order from ${checkTable.name}`, `Order: ${orderItems === null || orderItems === void 0 ? void 0 : orderItems.length}`);
    }
    else {
        // For TAKEAWAY or DELIVERY, always create a new order session
        orderSession = yield __1.prismaDB.orderSession.create({
            data: {
                billId: billNo,
                orderType: orderType,
                username: validCustomer.name,
                phoneNo: validCustomer === null || validCustomer === void 0 ? void 0 : validCustomer.phoneNo,
                customerId: validCustomer.id,
                restaurantId: getOutlet.id,
                isPaid: true,
                paymentMethod: paymentId.length ? "UPI" : "CASH",
                subTotal: calculate.roundedTotal.toString(),
                orders: {
                    create: createOrderData(getOutlet.id, isPaid, orderId, orderType, totalAmount, "INCOMMING", orderItems),
                },
            },
        });
        yield firebase_1.NotificationService.sendNotification(getOutlet.fcmToken, `${orderType}: You have got new Order from ${validCustomer === null || validCustomer === void 0 ? void 0 : validCustomer.name}`, `Order: ${orderItems === null || orderItems === void 0 ? void 0 : orderItems.length}`);
    }
    yield __1.prismaDB.notification.create({
        data: {
            restaurantId: getOutlet.id,
            orderId: orderId,
            message: "You have a new Order",
            orderType: orderType,
        },
    });
    ws_1.websocketManager.notifyClients(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id, "NEW_ORDER_SESSION_CREATED");
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
        (0, get_items_1.getFetchAllNotificationToRedis)(outletId),
    ]);
    return res.json({
        success: true,
        sessionId: orderSession.id,
        message: "Order Created by Customer ✅",
    });
});
exports.postOrderForUser = postOrderForUser;
const existingOrderPatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _l, _m;
    const { outletId, orderId } = req.params;
    const { billerId, isPaid, totalAmount, orderItems, orderMode } = req.body;
    // @ts-ignore
    if (billerId !== ((_l = req.user) === null || _l === void 0 ? void 0 : _l.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findBiller = yield __1.prismaDB.staff.findFirst({
        where: {
            id: billerId,
        },
    });
    if (!(findBiller === null || findBiller === void 0 ? void 0 : findBiller.id)) {
        throw new bad_request_1.BadRequestsException("You Need to login & place the order", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!outletId) {
        throw new bad_request_1.BadRequestsException("Outlet Id is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
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
            staffId: findBiller.id,
            isPaid: isPaid,
            restaurantId: getOutlet.id,
            orders: {
                create: {
                    active: true,
                    staffId: findBiller.id,
                    restaurantId: getOutlet.id,
                    isPaid: isPaid,
                    orderStatus: orderStatus,
                    totalAmount: totalAmount.toString(),
                    generatedOrderId: generatedId,
                    orderType: getOrder.orderType,
                    orderItems: {
                        create: orderItems === null || orderItems === void 0 ? void 0 : orderItems.map((item) => {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                            return ({
                                menuId: item === null || item === void 0 ? void 0 : item.menuId,
                                name: (_a = item === null || item === void 0 ? void 0 : item.menuItem) === null || _a === void 0 ? void 0 : _a.name,
                                strike: false,
                                isVariants: (_b = item === null || item === void 0 ? void 0 : item.menuItem) === null || _b === void 0 ? void 0 : _b.isVariants,
                                originalRate: item === null || item === void 0 ? void 0 : item.originalPrice,
                                quantity: item === null || item === void 0 ? void 0 : item.quantity.toString(),
                                totalPrice: item === null || item === void 0 ? void 0 : item.price,
                                selectedVariant: (item === null || item === void 0 ? void 0 : item.sizeVariantsId)
                                    ? {
                                        create: {
                                            sizeVariantId: item === null || item === void 0 ? void 0 : item.sizeVariantsId,
                                            name: (_e = (_d = (_c = item === null || item === void 0 ? void 0 : item.menuItem) === null || _c === void 0 ? void 0 : _c.menuItemVariants) === null || _d === void 0 ? void 0 : _d.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _e === void 0 ? void 0 : _e.variantName,
                                            type: (_h = (_g = (_f = item === null || item === void 0 ? void 0 : item.menuItem) === null || _f === void 0 ? void 0 : _f.menuItemVariants) === null || _g === void 0 ? void 0 : _g.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _h === void 0 ? void 0 : _h.type,
                                            price: Number((_j = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _j === void 0 ? void 0 : _j.price) * (item === null || item === void 0 ? void 0 : item.quantity),
                                            gst: Number((_k = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _k === void 0 ? void 0 : _k.gst),
                                            netPrice: (Number((_l = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _l === void 0 ? void 0 : _l.netPrice) * (item === null || item === void 0 ? void 0 : item.quantity)).toString(),
                                            grossProfit: Number((_m = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _m === void 0 ? void 0 : _m.grossProfit) * (item === null || item === void 0 ? void 0 : item.quantity),
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
                ? (_m = getOrder.table) === null || _m === void 0 ? void 0 : _m.name
                : getOrder.orderType,
        },
    });
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_order_1.getFetchAllStaffOrderSessionToRedis)(outletId, findBiller.id),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
        (0, get_items_1.getFetchAllNotificationToRedis)(outletId),
    ]);
    ws_1.websocketManager.notifyClients(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id, "NEW_ORDER_SESSION_UPDATED");
    return res.json({
        success: true,
        orderSessionId: orderSession.id,
        message: "Order Added from Biller ✅",
    });
});
exports.existingOrderPatch = existingOrderPatch;
const existingOrderPatchApp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _o, _p;
    const { outletId, orderId } = req.params;
    const { billerId, isPaid, totalNetPrice, gstPrice, totalAmount, totalGrossProfit, orderItems, orderMode, } = req.body;
    // @ts-ignore
    if (billerId !== ((_o = req.user) === null || _o === void 0 ? void 0 : _o.id)) {
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
                                quantity: item === null || item === void 0 ? void 0 : item.quantity.toString(),
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
                                            price: Number((_j = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _j === void 0 ? void 0 : _j.price) * (item === null || item === void 0 ? void 0 : item.quantity),
                                            gst: Number((_k = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _k === void 0 ? void 0 : _k.gst),
                                            netPrice: (Number((_l = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _l === void 0 ? void 0 : _l.netPrice) * (item === null || item === void 0 ? void 0 : item.quantity)).toString(),
                                            grossProfit: Number((_m = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _m === void 0 ? void 0 : _m.grossProfit) * (item === null || item === void 0 ? void 0 : item.quantity),
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
                ? (_p = getOrder.table) === null || _p === void 0 ? void 0 : _p.name
                : getOrder.orderType,
        },
    });
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
        (0, get_items_1.getFetchAllNotificationToRedis)(outletId),
    ]);
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
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
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
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
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
    // Refresh Redis cache
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
    ]);
    ws_1.websocketManager.notifyClients(outlet === null || outlet === void 0 ? void 0 : outlet.id, "ORDER_UPDATED");
    return res.json({
        success: true,
        message: "Order Transaction Cancelled✅",
    });
});
exports.orderessionCancelPatch = orderessionCancelPatch;
const orderessionDeleteById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _q;
    const { id, outletId } = req.params;
    // @ts-ignore
    const userId = (_q = req === null || req === void 0 ? void 0 : req.user) === null || _q === void 0 ? void 0 : _q.id;
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
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
    ]);
    return res.json({
        success: true,
        message: "Order Transactiion Deleted ✅",
    });
});
exports.orderessionDeleteById = orderessionDeleteById;
const orderessionBatchDelete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _r;
    const { outletId } = req.params;
    const { selectedId } = req.body;
    // @ts-ignore
    const userId = (_r = req === null || req === void 0 ? void 0 : req.user) === null || _r === void 0 ? void 0 : _r.id;
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
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
    ]);
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
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
    ]);
    ws_1.websocketManager.notifyClients(outlet === null || outlet === void 0 ? void 0 : outlet.id, "ORDER_UPDATED");
    return res.json({
        success: true,
        message: "Order Status Update Success ✅",
    });
});
exports.orderStatusPatch = orderStatusPatch;
const getAllOrderByStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _s;
    const { outletId } = req.params;
    const redisOrderByStaff = yield redis_1.redis.get(`all-order-staff-${outletId}`);
    if (redisOrderByStaff) {
        return res.json({
            success: true,
            orders: JSON.parse(redisOrderByStaff),
            message: "Fetched Up ⚡",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // @ts-ignore
    const staff = yield (0, get_users_1.getStaffById)(outletId, (_s = req.user) === null || _s === void 0 ? void 0 : _s.id);
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
const menuCardSchema = zod_1.z.object({
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
    const { data: validateFields, error } = menuCardSchema.safeParse(req.body);
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
        var _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7;
        yield prisma.orderItem.update({
            where: {
                id: getOrderById.id,
                order: { restaurantId: outlet.id },
            },
            data: {
                quantity: validateFields === null || validateFields === void 0 ? void 0 : validateFields.quantity.toString(),
                selectedVariant: validateFields.selectedVariantId
                    ? {
                        update: {
                            where: {
                                id: (_t = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.selectedVariant) === null || _t === void 0 ? void 0 : _t.id,
                            },
                            data: {
                                sizeVariantId: validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId,
                                name: (_v = (_u = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _u === void 0 ? void 0 : _u.variant) === null || _v === void 0 ? void 0 : _v.name,
                                price: parseFloat((_w = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _w === void 0 ? void 0 : _w.price) * (validateFields === null || validateFields === void 0 ? void 0 : validateFields.quantity),
                                gst: Number((_x = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _x === void 0 ? void 0 : _x.gst),
                                netPrice: (parseFloat((_y = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _y === void 0 ? void 0 : _y.netPrice) * (validateFields === null || validateFields === void 0 ? void 0 : validateFields.quantity)).toString(),
                                grossProfit: Number((_z = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _z === void 0 ? void 0 : _z.grossProfit) * (validateFields === null || validateFields === void 0 ? void 0 : validateFields.quantity),
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
                    ? (Number((_0 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem) === null || _0 === void 0 ? void 0 : _0.netPrice) *
                        (validateFields === null || validateFields === void 0 ? void 0 : validateFields.quantity)).toString()
                    : (Number((_1 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _1 === void 0 ? void 0 : _1.netPrice) * (validateFields === null || validateFields === void 0 ? void 0 : validateFields.quantity)).toString(),
                originalRate: !(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.isVariants)
                    ? Number((_2 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem) === null || _2 === void 0 ? void 0 : _2.price)
                    : Number((_3 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _3 === void 0 ? void 0 : _3.price),
                grossProfit: !(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.isVariants)
                    ? Number((_4 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem) === null || _4 === void 0 ? void 0 : _4.grossProfit) *
                        (validateFields === null || validateFields === void 0 ? void 0 : validateFields.quantity)
                    : Number((_5 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _5 === void 0 ? void 0 : _5.grossProfit) * (validateFields === null || validateFields === void 0 ? void 0 : validateFields.quantity),
                gst: !(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.isVariants)
                    ? (_6 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem) === null || _6 === void 0 ? void 0 : _6.gst
                    : (_7 = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _7 === void 0 ? void 0 : _7.gst,
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
        const totalGrossProfit = updatedOrderItems.reduce((total, item) => total + (Number(item.grossProfit) || 0), 0);
        const totalNetPrice = updatedOrderItems.reduce((total, item) => total + (Number(item.netPrice) || 0), 0);
        const gstPrice = updatedOrderItems.reduce((total, item) => total +
            ((Number(item.netPrice) * Number(item.gst)) / 100 || 0), 0);
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
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
    ]);
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
            const totalGrossProfit = remainingOrderItems.reduce((total, item) => total + (Number(item.grossProfit) * parseFloat(item.quantity) || 0), 0);
            const totalNetPrice = remainingOrderItems.reduce((total, item) => total +
                (parseFloat(item.netPrice) * parseFloat(item.quantity) ||
                    0), 0);
            const gstPrice = remainingOrderItems.reduce((total, item) => total + (Number(item.gst) * parseFloat(item.quantity) || 0), 0);
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
    // Refresh caches after successful transaction
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
    ]);
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
