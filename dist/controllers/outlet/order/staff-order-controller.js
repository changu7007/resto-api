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
exports.acceptOrderFromPrime = exports.getStaffOrdersRecentTenOrders = exports.getStaffOrderStats = exports.orderStatusPatchByStaff = exports.getByStaffAllOrders = exports.orderItemModificationByStaff = exports.existingOrderPatchForStaff = exports.postOrderForStaf = exports.getByStaffLiveOrders = void 0;
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const outlet_1 = require("../../../lib/outlet");
const get_order_1 = require("../../../lib/outlet/get-order");
const redis_1 = require("../../../services/redis");
const __1 = require("../../..");
const ws_1 = require("../../../services/ws");
const bad_request_1 = require("../../../exceptions/bad-request");
const client_1 = require("@prisma/client");
const date_fns_1 = require("date-fns");
const orderOutletController_1 = require("./orderOutletController");
const getByStaffLiveOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { outletId } = req.params;
    // @ts-ignore
    const staffId = (_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.id;
    // const redisLiveOrder = await redis.get(`liv-o-${outletId}-${staffId}`);
    // if (redisLiveOrder) {
    //   return res.json({
    //     success: true,
    //     liveOrders: JSON.parse(redisLiveOrder),
    //     message: "FETCHED UP ⚡",
    //   });
    // }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const liveOrders = yield (0, get_order_1.getFetchLiveOrderByStaffToRedis)(outlet.id, staffId);
    return res.json({
        success: true,
        liveOrders,
        message: "Fetching ✅",
    });
});
exports.getByStaffLiveOrders = getByStaffLiveOrders;
const postOrderForStaf = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { outletId } = req.params;
    const validTypes = Object.values(client_1.OrderType);
    const { staffId, username, isPaid, cashRegisterId, isValid, phoneNo, orderType, totalNetPrice, gstPrice, totalAmount, totalGrossProfit, orderItems, tableId, paymentMethod, orderMode, isSplitPayment, splitPayments, receivedAmount, changeAmount, } = req.body;
    if (isValid === true && !phoneNo) {
        throw new bad_request_1.BadRequestsException("please provide Phone No", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Authorization and basic validation
    // @ts-ignore
    if (staffId !== ((_b = req.user) === null || _b === void 0 ? void 0 : _b.id)) {
        throw new bad_request_1.BadRequestsException("Invalid Staff", root_1.ErrorCode.UNAUTHORIZED);
    }
    // Normal payment validation
    if (isPaid === true && !isSplitPayment && !paymentMethod) {
        throw new bad_request_1.BadRequestsException("Please Select Payment Mode", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Split payment validation
    if (isPaid === true && isSplitPayment === true) {
        if (!splitPayments ||
            !Array.isArray(splitPayments) ||
            splitPayments.length === 0) {
            throw new bad_request_1.BadRequestsException("Split payment selected but no payment details provided", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        // Calculate total amount from split payments
        const totalPaid = splitPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        // Validate split payment total matches bill total (allow small difference for rounding)
        if (Math.abs(totalPaid - totalAmount) > 0.1) {
            throw new bad_request_1.BadRequestsException(`Total split payment amount (${totalPaid.toFixed(2)}) must equal bill total (${totalAmount.toFixed(2)})`, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    let cashRegister = null;
    if (isPaid === true) {
        const findCashRegister = yield __1.prismaDB.cashRegister.findFirst({
            where: { id: cashRegisterId, status: "OPEN" },
        });
        if (!(findCashRegister === null || findCashRegister === void 0 ? void 0 : findCashRegister.id)) {
            throw new not_found_1.NotFoundException("Cash Register Not Found", root_1.ErrorCode.NOT_FOUND);
        }
        cashRegister = findCashRegister;
    }
    const [findStaff, getOutlet] = yield Promise.all([
        __1.prismaDB.staff.findFirst({ where: { id: staffId } }),
        (0, outlet_1.getOutletById)(outletId),
    ]);
    if (!(findStaff === null || findStaff === void 0 ? void 0 : findStaff.id) || !(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Unauthorized Access", root_1.ErrorCode.NOT_FOUND);
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
            : orderMode === "READY"
                ? "FOODREADY"
                : "SERVED";
    const result = yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _c, _d, _e, _f;
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
                billId: ((_c = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _c === void 0 ? void 0 : _c.isGSTEnabled)
                    ? `${(_d = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _d === void 0 ? void 0 : _d.prefix}${(_e = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _e === void 0 ? void 0 : _e.invoiceNo}/${(0, date_fns_1.getYear)(new Date())}`
                    : billNo,
                orderType: orderType,
                username: username !== null && username !== void 0 ? username : findStaff.name,
                phoneNo: phoneNo !== null && phoneNo !== void 0 ? phoneNo : null,
                staffId: findStaff.id,
                customerId: isValid === true ? customer === null || customer === void 0 ? void 0 : customer.id : null,
                paymentMethod: isPaid && !isSplitPayment ? paymentMethod : null,
                tableId: tableId,
                isPaid: isPaid,
                restaurantId: getOutlet.id,
                createdBy: `${findStaff === null || findStaff === void 0 ? void 0 : findStaff.name} (${findStaff === null || findStaff === void 0 ? void 0 : findStaff.role})`,
                subTotal: isPaid ? totalAmount : null,
                amountReceived: isPaid && !isSplitPayment && receivedAmount ? receivedAmount : null,
                change: isPaid && !isSplitPayment && changeAmount ? changeAmount : null,
                isSplitPayment: isPaid && isSplitPayment ? true : false,
                splitPayments: isPaid && isSplitPayment && splitPayments
                    ? {
                        create: splitPayments.map((payment) => ({
                            method: payment.method,
                            amount: Number(payment.amount),
                            note: `Part of split payment for bill #${billNo}`,
                            createdBy: `${findStaff === null || findStaff === void 0 ? void 0 : findStaff.name} (${findStaff === null || findStaff === void 0 ? void 0 : findStaff.role})`,
                        })),
                    }
                    : undefined,
                orders: {
                    create: {
                        restaurantId: getOutlet.id,
                        staffId: staffId,
                        createdBy: `${findStaff === null || findStaff === void 0 ? void 0 : findStaff.name} (${findStaff === null || findStaff === void 0 ? void 0 : findStaff.role})`,
                        isPaid: isPaid,
                        active: true,
                        orderStatus: isPaid === true && orderStatus === "COMPLETED"
                            ? "COMPLETED"
                            : orderStatus,
                        totalNetPrice: totalNetPrice,
                        gstPrice: gstPrice,
                        totalAmount: totalAmount,
                        totalGrossProfit: totalGrossProfit,
                        generatedOrderId: orderId,
                        orderType: orderType,
                        paymentMethod: isPaid && !isSplitPayment ? paymentMethod : null,
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
                                                        var _a, _b, _c, _d;
                                                        const matchedVaraint = (_a = groupAddOn === null || groupAddOn === void 0 ? void 0 : groupAddOn.addonVariants) === null || _a === void 0 ? void 0 : _a.find((variant) => (variant === null || variant === void 0 ? void 0 : variant.id) === (addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.id));
                                                        return {
                                                            selectedAddOnVariantId: addOnVariant === null || addOnVariant === void 0 ? void 0 : addOnVariant.id,
                                                            name: matchedVaraint === null || matchedVaraint === void 0 ? void 0 : matchedVaraint.name,
                                                            type: matchedVaraint === null || matchedVaraint === void 0 ? void 0 : matchedVaraint.type,
                                                            price: Number(matchedVaraint === null || matchedVaraint === void 0 ? void 0 : matchedVaraint.price),
                                                            gst: Number((_b = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _b === void 0 ? void 0 : _b.gst),
                                                            netPrice: Number((_c = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _c === void 0 ? void 0 : _c.netPrice).toString(),
                                                            grossProfit: Number((_d = item === null || item === void 0 ? void 0 : item.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (item === null || item === void 0 ? void 0 : item.sizeVariantsId))) === null || _d === void 0 ? void 0 : _d.grossProfit),
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
                    inviteCode: (0, orderOutletController_1.inviteCode)(),
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
        if ((_f = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.invoice) === null || _f === void 0 ? void 0 : _f.id) {
            yield prisma.invoice.update({
                where: {
                    restaurantId: getOutlet.id,
                },
                data: {
                    invoiceNo: { increment: 1 },
                },
            });
        }
        if (isPaid && (cashRegister === null || cashRegister === void 0 ? void 0 : cashRegister.id)) {
            const registerIdString = cashRegister.id; // Ensure we have a string value
            if (isSplitPayment && splitPayments && splitPayments.length > 0) {
                // Create multiple cash transactions for split payments
                yield Promise.all(splitPayments.map((payment) => __awaiter(void 0, void 0, void 0, function* () {
                    yield __1.prismaDB.cashTransaction.create({
                        data: {
                            registerId: registerIdString,
                            amount: Number(payment.amount),
                            type: "CASH_IN",
                            source: "ORDER",
                            description: `Split Payment (${payment.method}) - #${orderSession.billId} - ${orderSession.orderType} - ${orderItems === null || orderItems === void 0 ? void 0 : orderItems.length} x Items`,
                            paymentMethod: payment.method,
                            performedBy: staffId,
                            orderId: orderSession.id,
                            referenceId: orderSession.id, // Add reference ID for easier tracing
                        },
                    });
                })));
            }
            else {
                // Create a single cash transaction for regular payment
                yield __1.prismaDB.cashTransaction.create({
                    data: {
                        registerId: registerIdString,
                        amount: totalAmount,
                        type: "CASH_IN",
                        source: "ORDER",
                        description: `Order Sales - #${orderSession.billId} - ${orderSession.orderType} - ${orderItems === null || orderItems === void 0 ? void 0 : orderItems.length} x Items`,
                        paymentMethod: paymentMethod,
                        performedBy: staffId,
                        orderId: orderSession.id,
                        referenceId: orderSession.id, // Add reference ID for easier tracing
                    },
                });
            }
        }
        return orderSession;
    }));
    // Post-transaction tasks
    yield Promise.all([
        redis_1.redis.del(`active-os-${outletId}`),
        redis_1.redis.del(`liv-o-${outletId}`),
        redis_1.redis.del(`tables-${outletId}`),
        redis_1.redis.del(`a-${outletId}`),
        redis_1.redis.del(`o-n-${outletId}`),
        redis_1.redis.del(`${outletId}-stocks`),
        redis_1.redis.del(`liv-o-${outletId}-${staffId}`),
    ]);
    ws_1.websocketManager.notifyClients(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id, "NEW_ORDER_SESSION_CREATED");
    return res.json({
        success: true,
        orderSessionId: result.id,
        kotNumber: orderId,
        message: "Order Created from Captain ✅",
    });
});
exports.postOrderForStaf = postOrderForStaf;
const existingOrderPatchForStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _g, _h;
    const { outletId, orderId } = req.params;
    const { staffId, isPaid, totalNetPrice, gstPrice, totalAmount, totalGrossProfit, orderItems, orderMode, } = req.body;
    // @ts-ignore
    if (staffId !== ((_g = req.user) === null || _g === void 0 ? void 0 : _g.id)) {
        throw new bad_request_1.BadRequestsException("Invalid User", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findStaff = yield __1.prismaDB.staff.findFirst({
        where: {
            id: staffId,
        },
    });
    if (!(findStaff === null || findStaff === void 0 ? void 0 : findStaff.id)) {
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
            isPaid: isPaid,
            restaurantId: getOutlet.id,
            orders: {
                create: {
                    active: true,
                    staffId: findStaff.id,
                    restaurantId: getOutlet.id,
                    isPaid: isPaid,
                    orderStatus: orderStatus,
                    totalNetPrice: totalNetPrice,
                    gstPrice: gstPrice,
                    totalAmount: totalAmount,
                    totalGrossProfit: totalGrossProfit,
                    generatedOrderId: generatedId,
                    orderType: getOrder.orderType,
                    createdBy: `${findStaff === null || findStaff === void 0 ? void 0 : findStaff.name}-(${findStaff === null || findStaff === void 0 ? void 0 : findStaff.role})`,
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
                ? (_h = getOrder.table) === null || _h === void 0 ? void 0 : _h.name
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
        redis_1.redis.del(`liv-o-${outletId}-${staffId}`),
    ]);
    ws_1.websocketManager.notifyClients(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id, "NEW_ORDER_SESSION_UPDATED");
    return res.json({
        success: true,
        orderSessionId: orderSession.id,
        kotNumber: generatedId,
        message: "Order Added from Captain ✅",
    });
});
exports.existingOrderPatchForStaff = existingOrderPatchForStaff;
const orderItemModificationByStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _j;
    const { orderId, outletId } = req.params;
    const { data: validateFields, error } = orderOutletController_1.menuCardSchema.safeParse(req.body);
    // @ts-ignore
    const staffId = (_j = req.user) === null || _j === void 0 ? void 0 : _j.id;
    if (!staffId) {
        throw new bad_request_1.BadRequestsException("Invalid Staff", root_1.ErrorCode.UNAUTHORIZED);
    }
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
                staffId: staffId,
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
        var _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
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
                                id: (_k = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.selectedVariant) === null || _k === void 0 ? void 0 : _k.id,
                            },
                            data: {
                                sizeVariantId: validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId,
                                name: (_m = (_l = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _l === void 0 ? void 0 : _l.variant) === null || _m === void 0 ? void 0 : _m.name,
                                price: parseFloat((_o = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _o === void 0 ? void 0 : _o.price),
                                gst: Number((_p = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _p === void 0 ? void 0 : _p.gst),
                                netPrice: parseFloat((_q = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _q === void 0 ? void 0 : _q.netPrice).toString(),
                                grossProfit: Number((_r = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _r === void 0 ? void 0 : _r.grossProfit),
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
                    ? Number((_s = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem) === null || _s === void 0 ? void 0 : _s.netPrice).toString()
                    : Number((_t = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _t === void 0 ? void 0 : _t.netPrice).toString(),
                originalRate: !(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.isVariants)
                    ? Number((_u = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem) === null || _u === void 0 ? void 0 : _u.price)
                    : Number((_v = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _v === void 0 ? void 0 : _v.price),
                grossProfit: !(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.isVariants)
                    ? Number((_w = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem) === null || _w === void 0 ? void 0 : _w.grossProfit)
                    : Number((_x = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _x === void 0 ? void 0 : _x.grossProfit),
                gst: !(getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.isVariants)
                    ? (_y = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem) === null || _y === void 0 ? void 0 : _y.gst
                    : (_z = getOrderById === null || getOrderById === void 0 ? void 0 : getOrderById.menuItem.menuItemVariants.find((v) => (v === null || v === void 0 ? void 0 : v.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.selectedVariantId))) === null || _z === void 0 ? void 0 : _z.gst,
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
                totalAmount: totalAmount,
            },
        });
    }));
    yield Promise.all([
        redis_1.redis.del(`active-os-${outletId}`),
        redis_1.redis.del(`liv-o-${outletId}`),
        redis_1.redis.del(`tables-${outletId}`),
        redis_1.redis.del(`a-${outletId}`),
        redis_1.redis.del(`o-n-${outletId}`),
        redis_1.redis.del(`${outletId}-stocks`),
        redis_1.redis.del(`liv-o-${outletId}-${staffId}`),
    ]);
    return res.json({
        success: true,
        message: "Order Item Updated Success By Staff ✅",
    });
});
exports.orderItemModificationByStaff = orderItemModificationByStaff;
const getByStaffAllOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _0;
    const { outletId } = req.params;
    // @ts-ignore
    const staffId = (_0 = req === null || req === void 0 ? void 0 : req.user) === null || _0 === void 0 ? void 0 : _0.id;
    // const redisLiveOrder = await redis.get(
    //   `all-staff-orders-${outletId}-${staffId}`
    // );
    // if (redisLiveOrder) {
    //   return res.json({
    //     success: true,
    //     orders: JSON.parse(redisLiveOrder),
    //     message: "FETCHED UP ⚡",
    //   });
    // }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const orders = yield (0, get_order_1.getFetchAllOrderByStaffToRedis)(outlet.id, staffId);
    return res.json({
        success: true,
        orders,
        message: "Fetching ✅",
    });
});
exports.getByStaffAllOrders = getByStaffAllOrders;
const orderStatusPatchByStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _1;
    const { orderId, outletId } = req.params;
    // @ts-ignore
    const staffId = (_1 = req.user) === null || _1 === void 0 ? void 0 : _1.id;
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
        redis_1.redis.del(`liv-o-${outletId}-${staffId}`),
    ]);
    ws_1.websocketManager.notifyClients(outlet === null || outlet === void 0 ? void 0 : outlet.id, "ORDER_UPDATED");
    return res.json({
        success: true,
        message: "Order Status Update Success By Staff ✅",
    });
});
exports.orderStatusPatchByStaff = orderStatusPatchByStaff;
//stats
const getStaffOrderStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _2;
    const { outletId } = req.params;
    // @ts-ignore
    const staffId = (_2 = req.user) === null || _2 === void 0 ? void 0 : _2.id;
    const { period } = req.query;
    const now = new Date();
    const validPeriods = [
        "today",
        "yesterday",
        "week",
        "month",
        "year",
        "all",
    ];
    if (!validPeriods.includes(period)) {
        throw new bad_request_1.BadRequestsException("Invalid Period", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    let startDate;
    let endDate;
    switch (period) {
        case "today":
            startDate = new Date(now.setHours(0, 0, 0, 0)); // Start of today
            endDate = now; // Now is the end date
            break;
        case "yesterday":
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = new Date(yesterday.setHours(0, 0, 0, 0)); // Start of yesterday
            endDate = new Date(yesterday.setHours(23, 59, 59, 999)); // End of yesterday
            break;
        case "week":
            const lastWeek = new Date(now);
            lastWeek.setDate(now.getDate() - 7);
            startDate = new Date(lastWeek.setHours(0, 0, 0, 0)); // Start of last week
            endDate = now; // Now is the end date
            break;
        case "month":
            const lastMonth = new Date(now);
            lastMonth.setMonth(now.getMonth() - 1);
            startDate = new Date(lastMonth.setHours(0, 0, 0, 0)); // Start of last month
            endDate = now; // Now is the end date
            break;
        case "year":
            const lastYear = new Date(now);
            lastYear.setFullYear(now.getFullYear() - 1);
            startDate = new Date(lastYear.setHours(0, 0, 0, 0)); // Start of last year
            endDate = now; // Now is the end date
            break;
        default:
            startDate = new Date(0); // Beginning of time for "all"
            endDate = now;
            break;
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const orders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outlet.id,
            orderStatus: { in: ["COMPLETED", "INCOMMING", "FOODREADY", "SERVED"] },
            staffId: staffId,
            createdAt: {
                gte: startDate,
                lte: endDate,
            },
        },
    });
    const totalOrders = orders.length;
    const totalAmount = orders
        .filter((order) => order.orderStatus === "COMPLETED")
        .reduce((total, order) => total + Number(order.totalAmount), 0);
    const totalNetPrice = orders
        .filter((order) => order.orderStatus === "COMPLETED")
        .reduce((total, order) => total + Number(order.totalNetPrice), 0);
    const totalGstPrice = orders
        .filter((order) => order.orderStatus === "COMPLETED")
        .reduce((total, order) => total + Number(order.gstPrice), 0);
    const totalGrossProfit = orders
        .filter((order) => order.orderStatus === "COMPLETED")
        .reduce((total, order) => total + Number(order.totalGrossProfit), 0);
    return res.json({
        success: true,
        totalOrders,
        totalAmount,
        totalNetPrice,
        totalGstPrice,
        totalGrossProfit,
    });
});
exports.getStaffOrderStats = getStaffOrderStats;
const getStaffOrdersRecentTenOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _3;
    const { outletId } = req.params;
    // @ts-ignore
    const staffId = (_3 = req.user) === null || _3 === void 0 ? void 0 : _3.id;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const orders = yield __1.prismaDB.order.findMany({
        where: {
            restaurantId: outlet.id,
            staffId: staffId,
        },
        include: {
            orderItems: {
                include: {
                    selectedVariant: true,
                },
            },
            orderSession: {
                select: {
                    table: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 10,
    });
    const formattedOrders = orders.map((order) => {
        var _a, _b;
        return ({
            id: order.id,
            orderId: order.generatedOrderId,
            orderType: order.orderType,
            tablename: (_b = (_a = order.orderSession) === null || _a === void 0 ? void 0 : _a.table) === null || _b === void 0 ? void 0 : _b.name,
            totalAmount: order.totalAmount,
            orderStatus: order.orderStatus,
            createdAt: order.createdAt,
            isPaid: order.isPaid,
            orderItems: order.orderItems.map((item) => {
                var _a;
                return ({
                    id: item.id,
                    name: item.name,
                    sizeVariant: (_a = item.selectedVariant) === null || _a === void 0 ? void 0 : _a.name,
                    quantity: item.quantity,
                    price: item.totalPrice,
                });
            }),
        });
    });
    return res.json({
        success: true,
        orders: formattedOrders,
    });
});
exports.getStaffOrdersRecentTenOrders = getStaffOrdersRecentTenOrders;
const acceptOrderFromPrime = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _4;
    const { outletId } = req.params;
    const { orderId } = req.body;
    // @ts-ignore
    const staffId = (_4 = req.user) === null || _4 === void 0 ? void 0 : _4.id;
    if (!staffId) {
        throw new bad_request_1.BadRequestsException("Staff ID is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const order = yield __1.prismaDB.order.findFirst({
        where: {
            restaurantId: outlet.id,
            orderSession: {
                id: orderId,
            },
        },
    });
    if (!(order === null || order === void 0 ? void 0 : order.id)) {
        throw new not_found_1.NotFoundException("Order Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    if ((order === null || order === void 0 ? void 0 : order.staffId) !== null) {
        throw new bad_request_1.BadRequestsException("Order is already accepted by Another Staff", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.order.update({
        where: { id: order.id },
        data: { staffId: staffId },
    });
    return res.json({
        success: true,
        message: "Order Accepted Successfully",
    });
});
exports.acceptOrderFromPrime = acceptOrderFromPrime;
