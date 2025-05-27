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
exports.getPOSTableAllOrders = exports.getPOSTableAllSessionOrders = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const __1 = require("../../..");
const root_1 = require("../../../exceptions/root");
const getPOSTableAllSessionOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // @ts-ignore
    const { id: staffId } = req.user;
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
        where: Object.assign({ restaurantId: outletId, staffId: staffId, OR: [{ billId: { contains: search, mode: "insensitive" } }], AND: filterConditions }, (dateRange && {
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
            where: Object.assign(Object.assign({ restaurantId: outletId, staffId: staffId, OR: [{ billId: { contains: search, mode: "insensitive" } }], AND: filterConditions }, (dateRange && {
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
            where: Object.assign(Object.assign({ restaurantId: outletId, staffId: staffId, OR: [{ billId: { contains: search, mode: "insensitive" } }], AND: filterConditions }, (dateRange && {
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
            where: Object.assign({ restaurantId: outletId, staffId: staffId, OR: [{ billId: { contains: search, mode: "insensitive" } }], AND: filterConditions }, (dateRange && {
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
        where: Object.assign({ restaurantId: outletId, staffId: staffId, OR: [
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
            loyaltRedeemPoints: true,
            discount: true,
            discountAmount: true,
            gstAmount: true,
            amountReceived: true,
            customer: {
                select: {
                    customer: {
                        select: {
                            name: true,
                            phoneNo: true,
                        },
                    },
                },
            },
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
            var _a, _b, _c, _d, _e, _f;
            return ({
                id: order === null || order === void 0 ? void 0 : order.id,
                billId: order === null || order === void 0 ? void 0 : order.billId,
                userName: (order === null || order === void 0 ? void 0 : order.username)
                    ? order === null || order === void 0 ? void 0 : order.username
                    : (_b = (_a = order === null || order === void 0 ? void 0 : order.customer) === null || _a === void 0 ? void 0 : _a.customer) === null || _b === void 0 ? void 0 : _b.name,
                phoneNo: (order === null || order === void 0 ? void 0 : order.phoneNo)
                    ? order === null || order === void 0 ? void 0 : order.phoneNo
                    : (_d = (_c = order === null || order === void 0 ? void 0 : order.customer) === null || _c === void 0 ? void 0 : _c.customer) === null || _d === void 0 ? void 0 : _d.phoneNo,
                isPaid: order === null || order === void 0 ? void 0 : order.isPaid,
                active: order === null || order === void 0 ? void 0 : order.active,
                invoiceUrl: order === null || order === void 0 ? void 0 : order.invoiceUrl,
                paymentMethod: order === null || order === void 0 ? void 0 : order.paymentMethod,
                subTotal: order === null || order === void 0 ? void 0 : order.subTotal,
                status: order === null || order === void 0 ? void 0 : order.sessionStatus,
                orderType: (order === null || order === void 0 ? void 0 : order.orderType) === "DINEIN" ? (_e = order === null || order === void 0 ? void 0 : order.table) === null || _e === void 0 ? void 0 : _e.name : order === null || order === void 0 ? void 0 : order.orderType,
                date: order === null || order === void 0 ? void 0 : order.createdAt,
                modified: order === null || order === void 0 ? void 0 : order.updatedAt,
                discount: order === null || order === void 0 ? void 0 : order.discount,
                discountAmount: order === null || order === void 0 ? void 0 : order.discountAmount,
                gstAmount: order === null || order === void 0 ? void 0 : order.gstAmount,
                loyaltyDiscount: order === null || order === void 0 ? void 0 : order.loyaltRedeemPoints,
                amountReceived: order === null || order === void 0 ? void 0 : order.amountReceived,
                viewOrders: (_f = order === null || order === void 0 ? void 0 : order.orders) === null || _f === void 0 ? void 0 : _f.map((o) => {
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
exports.getPOSTableAllSessionOrders = getPOSTableAllSessionOrders;
const getPOSTableAllOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    // @ts-ignore
    const { id: staffId } = req.user;
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
        where: Object.assign({ restaurantId: outletId, staffId: staffId, OR: [{ generatedOrderId: { contains: search, mode: "insensitive" } }], AND: filterConditions }, (dateRange && {
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
        where: Object.assign({ restaurantId: outletId, staffId: staffId, OR: [{ generatedOrderId: { contains: (_c = search) !== null && _c !== void 0 ? _c : "" } }], AND: filterConditions }, (dateRange && {
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
exports.getPOSTableAllOrders = getPOSTableAllOrders;
