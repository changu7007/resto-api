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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateTotalsForTakewayAndDelivery = exports.calculateTotals = exports.assignCustomerToOrder = exports.generatePdfInvoice = exports.generatePdfInvoiceInBackground = exports.completebillingOrderSession = exports.billingOrderSession = void 0;
const outlet_1 = require("../../../../lib/outlet");
const not_found_1 = require("../../../../exceptions/not-found");
const root_1 = require("../../../../exceptions/root");
const client_1 = require("@prisma/client");
const bad_request_1 = require("../../../../exceptions/bad-request");
const __1 = require("../../../..");
const redis_1 = require("../../../../services/redis");
const ws_1 = require("../../../../services/ws");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const ejs_1 = __importDefault(require("ejs"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const axios_1 = __importDefault(require("axios"));
const secrets_1 = require("../../../../secrets");
const producer_1 = require("../../../../services/bullmq/producer");
const zod_1 = require("zod");
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const splitPaymentSchema = zod_1.z
    .object({
    subTotal: zod_1.z.number({
        required_error: "Subtotal is required",
    }),
    paymentMethod: zod_1.z.nativeEnum(client_1.PaymentMethod).optional(),
    cashRegisterId: zod_1.z
        .string({
        message: "Cash Register not opened, please open to complete the bill",
    })
        .optional(),
    paymentId: zod_1.z.string().optional(),
    isSplitPayment: zod_1.z.boolean().optional(),
    splitPayments: zod_1.z
        .array(zod_1.z.object({
        method: zod_1.z.nativeEnum(client_1.PaymentMethod),
        amount: zod_1.z.number(),
    }))
        .optional(),
    discount: zod_1.z.coerce.number().optional(),
    loyaltyRedeemDiscount: zod_1.z.coerce.number().optional(),
    platform: zod_1.z.nativeEnum(client_1.Platform, { message: "Platform is Required" }),
    paymentMode: zod_1.z.nativeEnum(client_1.PaymentMode).optional(),
    discountAmount: zod_1.z.coerce.number().optional(),
    receivedAmount: zod_1.z.coerce.number().optional(),
})
    .refine((data) => {
    // If it's not a split payment, paymentMethod is required
    if (!data.isSplitPayment && !data.paymentMethod) {
        return false;
    }
    // If it is a split payment, splitPayments is required
    if (data.isSplitPayment &&
        (!data.splitPayments || data.splitPayments.length === 0)) {
        return false;
    }
    return true;
}, {
    message: "Either paymentMethod (for single payment) or splitPayments (for split payment) must be provided",
    path: ["paymentMethod"], // This will show the error on the paymentMethod field
})
    .refine((data) => {
    // Validate cashRegisterId only when platform is POS or ADMIN
    if ((data.platform === "POS" || data.platform === "ADMIN") &&
        !data.cashRegisterId) {
        return false;
    }
    return true;
}, {
    message: "Cash register ID is required / Cash Register Not Opened",
    path: ["cashRegisterId"],
});
const billingOrderSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const { orderSessionId, outletId } = req.params;
    // @ts-ignore
    const { id, role } = req.user;
    const { data, error } = splitPaymentSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const { subTotal, paymentMethod, cashRegisterId, isSplitPayment, loyaltyRedeemDiscount, splitPayments, discount, discountAmount, receivedAmount, platform, paymentMode, paymentId, } = data;
    // Validate the request based on whether it's a split payment or not
    if (isSplitPayment) {
        // Validate split payments
        if (!Array.isArray(splitPayments) || splitPayments.length === 0) {
            throw new bad_request_1.BadRequestsException("Split payments are required for split payment mode", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        // Validate each split payment
        for (const payment of splitPayments) {
            if (!payment.method ||
                !Object.values(client_1.PaymentMethod).includes(payment.method)) {
                throw new bad_request_1.BadRequestsException("Invalid payment method in split payments", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
            }
            if (typeof payment.amount !== "number" || payment.amount <= 0) {
                throw new bad_request_1.BadRequestsException("Invalid amount in split payments", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
            }
        }
        // Validate total amount matches subTotal
        const totalPaid = splitPayments.reduce((sum, payment) => sum + payment.amount, 0);
        if (Math.abs(totalPaid - subTotal) > 0.01) {
            throw new bad_request_1.BadRequestsException("Total split payment amount must equal the bill total", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    else {
        // Regular payment validation
        if (typeof subTotal !== "number" ||
            !Object.values(client_1.PaymentMethod).includes(paymentMethod)) {
            throw new bad_request_1.BadRequestsException("Invalid total or Choose Payment method", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    if (!cashRegisterId && (platform === "POS" || platform === "ADMIN")) {
        throw new bad_request_1.BadRequestsException("Cash Register ID Not Found", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const orderSession = yield (0, outlet_1.getOrderSessionById)(outlet === null || outlet === void 0 ? void 0 : outlet.id, orderSessionId);
    if (!(orderSession === null || orderSession === void 0 ? void 0 : orderSession.id)) {
        throw new not_found_1.NotFoundException("Order Session not Found", root_1.ErrorCode.NOT_FOUND);
    }
    if ((orderSession === null || orderSession === void 0 ? void 0 : orderSession.sessionStatus) === "COMPLETED") {
        throw new bad_request_1.BadRequestsException("Payment and Bill Already Completed", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    let cashRegister;
    if (platform === "ADMIN" || platform === "POS") {
        cashRegister = yield __1.prismaDB.cashRegister.findFirst({
            where: {
                id: cashRegisterId,
                restaurantId: outlet.id,
                status: "OPEN",
            },
        });
    }
    const result = yield (__1.prismaDB === null || __1.prismaDB === void 0 ? void 0 : __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _f, _g;
        const updatedOrderSession = yield __1.prismaDB.orderSession.update({
            where: {
                id: orderSession.id,
                restaurantId: outlet.id,
            },
            data: {
                active: platform == "ONLINE" ? true : false,
                isPaid: true,
                paymentMethod: isSplitPayment ? "SPLIT" : paymentMethod,
                paymentMode: paymentMode,
                transactionId: paymentId,
                subTotal: subTotal,
                discount: discount,
                loyaltRedeemPoints: loyaltyRedeemDiscount,
                discountAmount: discountAmount,
                isSplitPayment: isSplitPayment,
                amountReceived: receivedAmount,
                splitPayments: isSplitPayment && splitPayments
                    ? {
                        create: splitPayments.map((payment) => ({
                            method: payment.method,
                            amount: payment.amount,
                        })),
                    }
                    : undefined,
                sessionStatus: "COMPLETED",
                orders: {
                    updateMany: {
                        where: {
                            orderStatus: {
                                in: ["SERVED", "INCOMMING", "PREPARING", "FOODREADY"],
                            },
                        },
                        data: {
                            active: false,
                            isPaid: true,
                            paymentMethod: !isSplitPayment ? paymentMethod : null,
                            orderStatus: "COMPLETED",
                        },
                    },
                },
            },
            include: {
                orders: {
                    include: {
                        orderItems: {
                            include: {
                                menuItem: {
                                    include: {
                                        menuItemVariants: true,
                                        menuGroupAddOns: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (updatedOrderSession.orderType === "DINEIN") {
            const table = yield prisma.table.findFirst({
                where: {
                    restaurantId: outlet.id,
                    currentOrderSessionId: orderSession.id,
                },
            });
            if (!table) {
                throw new bad_request_1.BadRequestsException("Could not find the table bill you are looking for", root_1.ErrorCode.INTERNAL_EXCEPTION);
            }
            yield prisma.table.update({
                where: {
                    id: table.id,
                    restaurantId: outlet.id,
                },
                data: {
                    occupied: false,
                    currentOrderSessionId: null,
                    customerId: null,
                },
            });
        }
        if (platform === "ADMIN" || platform === "POS") {
            if (!(cashRegister === null || cashRegister === void 0 ? void 0 : cashRegister.id)) {
                throw new bad_request_1.BadRequestsException("Cash Register Not Found", root_1.ErrorCode.INTERNAL_EXCEPTION);
            }
            if (isSplitPayment && splitPayments) {
                // Create multiple transactions for split payments
                for (const payment of splitPayments) {
                    yield __1.prismaDB.cashTransaction.create({
                        data: {
                            registerId: cashRegister === null || cashRegister === void 0 ? void 0 : cashRegister.id,
                            amount: payment.amount,
                            type: "CASH_IN",
                            source: "ORDER",
                            orderId: orderSession === null || orderSession === void 0 ? void 0 : orderSession.id,
                            description: `Split Payment - ${payment.method} - #${orderSession.billId} - ${orderSession.orderType} - ${(_f = updatedOrderSession === null || updatedOrderSession === void 0 ? void 0 : updatedOrderSession.orders) === null || _f === void 0 ? void 0 : _f.filter((order) => (order === null || order === void 0 ? void 0 : order.orderStatus) === "COMPLETED").length} x Items`,
                            paymentMethod: payment.method,
                            performedBy: id,
                        },
                    });
                }
            }
            else {
                // Create a single transaction for regular payment
                yield __1.prismaDB.cashTransaction.create({
                    data: {
                        registerId: cashRegister === null || cashRegister === void 0 ? void 0 : cashRegister.id,
                        amount: paymentMethod === "CASH" ? receivedAmount : subTotal,
                        type: "CASH_IN",
                        source: "ORDER",
                        orderId: orderSession === null || orderSession === void 0 ? void 0 : orderSession.id,
                        description: `Order Sales - #${orderSession.billId} - ${orderSession.orderType} - ${(_g = updatedOrderSession === null || updatedOrderSession === void 0 ? void 0 : updatedOrderSession.orders) === null || _g === void 0 ? void 0 : _g.filter((order) => (order === null || order === void 0 ? void 0 : order.orderStatus) === "COMPLETED").length} x Items`,
                        paymentMethod: paymentMethod,
                        performedBy: id,
                    },
                });
            }
        }
        // Get all orders in this order session
        const orders = yield prisma.order.findMany({
            where: {
                orderSessionId: orderSession.id,
                restaurantId: outlet.id,
            },
            select: {
                id: true,
            },
        });
        // Delete all alerts linked to any order in this order session
        if (orders.length > 0) {
            const orderIds = orders.map((order) => order.id);
            yield prisma.alert.deleteMany({
                where: {
                    restaurantId: outlet.id,
                    orderId: {
                        in: orderIds,
                    },
                    status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
                },
            });
        }
        if (orderSession === null || orderSession === void 0 ? void 0 : orderSession.customerId) {
            const getCustomerLoyalty = yield __1.prismaDB.customerLoyalty.findFirst({
                where: {
                    restaurantCustomerId: orderSession === null || orderSession === void 0 ? void 0 : orderSession.customerId,
                },
                include: {
                    loyaltyProgram: true,
                    currentTier: true,
                },
            });
            if (getCustomerLoyalty) {
                const { loyaltyProgram, currentTier } = getCustomerLoyalty;
                let pointsToAdd = 0;
                let visitsToAdd = 0;
                let cashbackAmount = 0;
                // Calculate rewards based on program type
                switch (loyaltyProgram.loyaltyProgramType) {
                    case "POINT_BASED":
                        if (loyaltyProgram.pointsRatio) {
                            pointsToAdd = subTotal / loyaltyProgram.pointsRatio;
                        }
                        break;
                    case "VISIT_BASED":
                        visitsToAdd = 1;
                        break;
                    case "SPEND_BASED_TIERS":
                        // Update tier based on lifetime spend
                        const newLifetimeSpend = getCustomerLoyalty.lifeTimeSpend + subTotal;
                        const nextTier = yield __1.prismaDB.tier.findFirst({
                            where: {
                                programId: loyaltyProgram.id,
                                threshold: {
                                    lte: newLifetimeSpend,
                                },
                            },
                            orderBy: {
                                threshold: "desc",
                            },
                        });
                        if (nextTier &&
                            (!currentTier || nextTier.threshold > currentTier.threshold)) {
                            yield __1.prismaDB.customerLoyalty.update({
                                where: { id: getCustomerLoyalty.id },
                                data: { currentTierId: nextTier.id },
                            });
                        }
                        break;
                    case "CASHBACK_WALLET_BASED":
                        if (loyaltyProgram.cashBackPercentage &&
                            loyaltyProgram.minSpendForCashback &&
                            subTotal >= loyaltyProgram.minSpendForCashback) {
                            cashbackAmount =
                                subTotal * (loyaltyProgram.cashBackPercentage / 100);
                        }
                        break;
                }
                // Update customer loyalty data
                const updated = yield __1.prismaDB.customerLoyalty.update({
                    where: { id: getCustomerLoyalty.id },
                    data: {
                        points: { increment: pointsToAdd },
                        visits: { increment: visitsToAdd },
                        walletBalance: { increment: cashbackAmount },
                        lifeTimePoints: { increment: pointsToAdd },
                        lifeTimeSpend: { increment: subTotal },
                        lastVisitDate: new Date(),
                    },
                });
                console.log(`Updated loyalty ${updated}`);
                // Create loyalty transaction records
                if (pointsToAdd > 0) {
                    yield __1.prismaDB.loyaltyTransaction.create({
                        data: {
                            restaurantId: outlet.id,
                            restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
                            programId: loyaltyProgram.id,
                            type: "POINTS_EARNED",
                            points: pointsToAdd,
                            description: `Points earned from order #${orderSession.billId}`,
                        },
                    });
                }
                if (visitsToAdd > 0) {
                    yield __1.prismaDB.loyaltyTransaction.create({
                        data: {
                            restaurantId: outlet.id,
                            restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
                            programId: loyaltyProgram.id,
                            type: "VISIT_RECORDED",
                            visits: visitsToAdd,
                            description: `Visit recorded for order #${orderSession.billId}`,
                        },
                    });
                }
                if (cashbackAmount > 0) {
                    yield __1.prismaDB.loyaltyTransaction.create({
                        data: {
                            restaurantId: outlet.id,
                            restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
                            programId: loyaltyProgram.id,
                            type: "CASHBACK_EARNED",
                            amount: cashbackAmount,
                            description: `Cashback earned from order #${orderSession.billId}`,
                        },
                    });
                }
                if (loyaltyRedeemDiscount) {
                    yield __1.prismaDB.customerLoyalty.update({
                        where: { id: getCustomerLoyalty.id },
                        data: {
                            points: { decrement: loyaltyRedeemDiscount },
                        },
                    });
                    yield __1.prismaDB.loyaltyTransaction.create({
                        data: {
                            restaurantId: outlet.id,
                            restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
                            programId: loyaltyProgram.id,
                            type: "POINTS_REDEEMED",
                            points: loyaltyRedeemDiscount,
                            description: `Points redeemed from order #${orderSession.billId}`,
                        },
                    });
                }
            }
        }
        return updatedOrderSession;
    })));
    const formattedOrders = (_a = result === null || result === void 0 ? void 0 : result.orders) === null || _a === void 0 ? void 0 : _a.map((order) => ({
        totalAmount: order === null || order === void 0 ? void 0 : order.totalAmount,
        gstPrice: order === null || order === void 0 ? void 0 : order.gstPrice,
        totalNetPrice: order === null || order === void 0 ? void 0 : order.totalNetPrice,
        orderStatus: order === null || order === void 0 ? void 0 : order.orderStatus,
    }));
    const { cgst, roundedDifference, roundedTotal, sgst, subtotal } = (0, exports.calculateTotals)(formattedOrders);
    // Parse split payment details if available
    let parsedSplitPayments = [];
    if (result.isSplitPayment && result.splitPaymentDetails) {
        try {
            parsedSplitPayments = JSON.parse(result.splitPaymentDetails);
        }
        catch (error) {
            console.error("Error parsing split payment details:", error);
        }
    }
    const invoiceData = {
        restaurantName: outlet.restaurantName,
        address: `${outlet.address},${outlet.city}-${outlet.pincode}`,
        gst: outlet.GSTIN,
        invoiceNo: result === null || result === void 0 ? void 0 : result.billId,
        fssai: outlet.GSTIN,
        invoiceDate: new Date().toLocaleTimeString(),
        customerName: result === null || result === void 0 ? void 0 : result.username,
        customerNo: (_b = result === null || result === void 0 ? void 0 : result.phoneNo) !== null && _b !== void 0 ? _b : "NA",
        paymentMethod: isSplitPayment ? "SPLIT" : paymentMethod,
        isSplitPayment: result.isSplitPayment,
        splitPayments: parsedSplitPayments,
        customerAddress: "NA",
        orderSessionId: result === null || result === void 0 ? void 0 : result.id,
        orderItems: (_c = result === null || result === void 0 ? void 0 : result.orders) === null || _c === void 0 ? void 0 : _c.filter((order) => (order === null || order === void 0 ? void 0 : order.orderStatus) === "COMPLETED").flatMap((orderItem) => orderItem.orderItems.map((item, idx) => ({
            id: idx + 1,
            name: item.menuItem.name,
            quantity: item.quantity,
            price: item.originalRate,
            totalPrice: item.totalPrice,
        }))),
        discount: 0,
        subtotal: subtotal,
        sgst: sgst,
        cgst: cgst,
        rounded: roundedDifference,
        total: roundedTotal,
    };
    producer_1.billQueueProducer.addJob({
        invoiceData,
        outletId: outlet.id,
        phoneNumber: (_d = result === null || result === void 0 ? void 0 : result.phoneNo) !== null && _d !== void 0 ? _d : undefined,
        whatsappData: {
            billId: result === null || result === void 0 ? void 0 : result.billId,
            items: invoiceData.orderItems.map((item) => ({
                id: item.id.toString(),
                name: item.name,
                quantity: item.quantity,
                price: item.price,
            })),
            subtotal: invoiceData.subtotal,
            tax: invoiceData.sgst + invoiceData.cgst,
            discount: 0,
            totalAmount: invoiceData.total,
            paymentStatus: "PAID",
            restaurantName: outlet === null || outlet === void 0 ? void 0 : outlet.restaurantName,
            orderType: orderSession === null || orderSession === void 0 ? void 0 : orderSession.orderType,
            isSplitPayment: invoiceData.isSplitPayment,
            splitPayments: invoiceData.splitPayments,
        },
        ownerPhone: (_e = outlet === null || outlet === void 0 ? void 0 : outlet.users) === null || _e === void 0 ? void 0 : _e.phoneNo,
        paymentData: {
            amount: invoiceData.total,
            billId: result === null || result === void 0 ? void 0 : result.billId,
            paymentMode: isSplitPayment ? "SPLIT" : paymentMethod,
            isSplitPayment: invoiceData.isSplitPayment,
            splitPayments: invoiceData.splitPayments,
        },
    }, `bill-${result.id}`);
    yield Promise.all([
        redis_1.redis.del(`active-os-${outletId}`),
        redis_1.redis.del(`liv-o-${outletId}`),
        redis_1.redis.del(`tables-${outletId}`),
        redis_1.redis.del(`a-${outletId}`),
        redis_1.redis.del(`o-n-${outletId}`),
        redis_1.redis.del(`${outletId}-stocks`),
        redis_1.redis.del(`all-order-staff-${outletId}`),
    ]);
    // if (outlet?.fcmToken) {
    //   await NotificationService.sendNotification(
    //     outlet?.fcmToken!,
    //     "Bill Recieved",
    //     `${subTotal}`
    //   );
    // }
    yield redis_1.redis.publish("orderUpdated", JSON.stringify({ outletId }));
    ws_1.websocketManager.notifyClients(outlet === null || outlet === void 0 ? void 0 : outlet.id, "BILL_UPDATED");
    return res.json({
        success: true,
        message: "Bill Recieved & Saved Success ✅",
    });
});
exports.billingOrderSession = billingOrderSession;
const completebillingOrderSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _h, _j, _k, _l, _m;
    const { orderSessionId, outletId } = req.params;
    // @ts-ignore
    const { id, role } = req.user;
    const { cashRegisterId } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const orderSession = yield (0, outlet_1.getOrderSessionById)(outlet === null || outlet === void 0 ? void 0 : outlet.id, orderSessionId);
    if (!(orderSession === null || orderSession === void 0 ? void 0 : orderSession.id)) {
        throw new not_found_1.NotFoundException("Order Session not Found", root_1.ErrorCode.NOT_FOUND);
    }
    if ((orderSession === null || orderSession === void 0 ? void 0 : orderSession.sessionStatus) === "COMPLETED") {
        throw new bad_request_1.BadRequestsException("Payment and Bill Already Completed", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    if ((orderSession === null || orderSession === void 0 ? void 0 : orderSession.platform) == "ONLINE" ||
        (orderSession === null || orderSession === void 0 ? void 0 : orderSession.platform) === "SWIGGY" ||
        (orderSession === null || orderSession === void 0 ? void 0 : orderSession.platform) === "ZOMATO") {
        if (!cashRegisterId) {
            throw new bad_request_1.BadRequestsException("Cash Register ID Not Found", root_1.ErrorCode.INTERNAL_EXCEPTION);
        }
    }
    let cashRegister;
    if ((orderSession === null || orderSession === void 0 ? void 0 : orderSession.platform) == "ONLINE" ||
        (orderSession === null || orderSession === void 0 ? void 0 : orderSession.platform) === "SWIGGY" ||
        (orderSession === null || orderSession === void 0 ? void 0 : orderSession.platform) === "ZOMATO") {
        cashRegister = yield __1.prismaDB.cashRegister.findFirst({
            where: {
                id: cashRegisterId,
                restaurantId: outlet.id,
                status: "OPEN",
            },
        });
    }
    const result = yield (__1.prismaDB === null || __1.prismaDB === void 0 ? void 0 : __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _o;
        const updatedOrderSession = yield __1.prismaDB.orderSession.update({
            where: {
                id: orderSession.id,
                restaurantId: outlet.id,
            },
            data: {
                active: false,
                isPaid: true,
                sessionStatus: "COMPLETED",
                orders: {
                    updateMany: {
                        where: {
                            orderStatus: {
                                in: ["SERVED", "INCOMMING", "PREPARING", "FOODREADY", "ONHOLD"],
                            },
                        },
                        data: {
                            active: false,
                            isPaid: true,
                            orderStatus: "COMPLETED",
                        },
                    },
                },
            },
            include: {
                orders: {
                    include: {
                        orderItems: {
                            include: {
                                menuItem: {
                                    include: {
                                        menuItemVariants: true,
                                        menuGroupAddOns: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (updatedOrderSession.orderType === "DINEIN") {
            const table = yield prisma.table.findFirst({
                where: {
                    restaurantId: outlet.id,
                    currentOrderSessionId: orderSession.id,
                },
            });
            if (!table) {
                throw new bad_request_1.BadRequestsException("Could not find the table bill you are looking for", root_1.ErrorCode.INTERNAL_EXCEPTION);
            }
            yield prisma.table.update({
                where: {
                    id: table.id,
                    restaurantId: outlet.id,
                },
                data: {
                    occupied: false,
                    currentOrderSessionId: null,
                    customerId: null,
                },
            });
        }
        // Create a single transaction for regular payment
        if ((orderSession === null || orderSession === void 0 ? void 0 : orderSession.platform) == "ONLINE" ||
            (orderSession === null || orderSession === void 0 ? void 0 : orderSession.platform) === "SWIGGY" ||
            (orderSession === null || orderSession === void 0 ? void 0 : orderSession.platform) === "ZOMATO") {
            if (!(cashRegister === null || cashRegister === void 0 ? void 0 : cashRegister.id)) {
                throw new bad_request_1.BadRequestsException("Cash Register Not Found", root_1.ErrorCode.INTERNAL_EXCEPTION);
            }
            yield __1.prismaDB.cashTransaction.create({
                data: {
                    registerId: cashRegister === null || cashRegister === void 0 ? void 0 : cashRegister.id,
                    amount: (orderSession === null || orderSession === void 0 ? void 0 : orderSession.paymentMethod) === "CASH"
                        ? orderSession === null || orderSession === void 0 ? void 0 : orderSession.amountReceived
                        : orderSession === null || orderSession === void 0 ? void 0 : orderSession.subTotal,
                    type: "CASH_IN",
                    source: "ORDER",
                    orderId: orderSession === null || orderSession === void 0 ? void 0 : orderSession.id,
                    description: `Order Sales - #${orderSession.billId} - ${orderSession.orderType} - ${(_o = updatedOrderSession === null || updatedOrderSession === void 0 ? void 0 : updatedOrderSession.orders) === null || _o === void 0 ? void 0 : _o.filter((order) => (order === null || order === void 0 ? void 0 : order.orderStatus) === "COMPLETED").length} x Items`,
                    paymentMethod: orderSession === null || orderSession === void 0 ? void 0 : orderSession.paymentMethod,
                    performedBy: id,
                },
            });
        }
        // Get all orders in this order session
        const orders = yield prisma.order.findMany({
            where: {
                orderSessionId: orderSession.id,
                restaurantId: outlet.id,
            },
            select: {
                id: true,
            },
        });
        // Delete all alerts linked to any order in this order session
        if (orders.length > 0) {
            const orderIds = orders.map((order) => order.id);
            yield prisma.alert.deleteMany({
                where: {
                    restaurantId: outlet.id,
                    orderId: {
                        in: orderIds,
                    },
                    status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
                },
            });
        }
        if (orderSession === null || orderSession === void 0 ? void 0 : orderSession.customerId) {
            const getCustomerLoyalty = yield __1.prismaDB.customerLoyalty.findFirst({
                where: {
                    restaurantCustomerId: orderSession === null || orderSession === void 0 ? void 0 : orderSession.customerId,
                },
                include: {
                    loyaltyProgram: true,
                    currentTier: true,
                },
            });
            if (getCustomerLoyalty) {
                const { loyaltyProgram, currentTier } = getCustomerLoyalty;
                let pointsToAdd = 0;
                let visitsToAdd = 0;
                let cashbackAmount = 0;
                // Calculate rewards based on program type
                switch (loyaltyProgram.loyaltyProgramType) {
                    case "POINT_BASED":
                        if (loyaltyProgram.pointsRatio) {
                            pointsToAdd =
                                Number(orderSession === null || orderSession === void 0 ? void 0 : orderSession.subTotal) / loyaltyProgram.pointsRatio;
                        }
                        break;
                    case "VISIT_BASED":
                        visitsToAdd = 1;
                        break;
                    case "SPEND_BASED_TIERS":
                        // Update tier based on lifetime spend
                        const newLifetimeSpend = getCustomerLoyalty.lifeTimeSpend + Number(orderSession === null || orderSession === void 0 ? void 0 : orderSession.subTotal);
                        const nextTier = yield __1.prismaDB.tier.findFirst({
                            where: {
                                programId: loyaltyProgram.id,
                                threshold: {
                                    lte: newLifetimeSpend,
                                },
                            },
                            orderBy: {
                                threshold: "desc",
                            },
                        });
                        if (nextTier &&
                            (!currentTier || nextTier.threshold > currentTier.threshold)) {
                            yield __1.prismaDB.customerLoyalty.update({
                                where: { id: getCustomerLoyalty.id },
                                data: { currentTierId: nextTier.id },
                            });
                        }
                        break;
                    case "CASHBACK_WALLET_BASED":
                        if (loyaltyProgram.cashBackPercentage &&
                            loyaltyProgram.minSpendForCashback &&
                            Number(orderSession === null || orderSession === void 0 ? void 0 : orderSession.subTotal) >=
                                loyaltyProgram.minSpendForCashback) {
                            cashbackAmount =
                                Number(orderSession === null || orderSession === void 0 ? void 0 : orderSession.subTotal) *
                                    (loyaltyProgram.cashBackPercentage / 100);
                        }
                        break;
                }
                // Update customer loyalty data
                const updated = yield __1.prismaDB.customerLoyalty.update({
                    where: { id: getCustomerLoyalty.id },
                    data: {
                        points: { increment: pointsToAdd },
                        visits: { increment: visitsToAdd },
                        walletBalance: { increment: cashbackAmount },
                        lifeTimePoints: { increment: pointsToAdd },
                        lifeTimeSpend: { increment: Number(orderSession === null || orderSession === void 0 ? void 0 : orderSession.subTotal) },
                        lastVisitDate: new Date(),
                    },
                });
                console.log(`Updated loyalty ${updated}`);
                // Create loyalty transaction records
                if (pointsToAdd > 0) {
                    yield __1.prismaDB.loyaltyTransaction.create({
                        data: {
                            restaurantId: outlet.id,
                            restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
                            programId: loyaltyProgram.id,
                            type: "POINTS_EARNED",
                            points: pointsToAdd,
                            description: `Points earned from order #${orderSession.billId}`,
                        },
                    });
                }
                if (visitsToAdd > 0) {
                    yield __1.prismaDB.loyaltyTransaction.create({
                        data: {
                            restaurantId: outlet.id,
                            restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
                            programId: loyaltyProgram.id,
                            type: "VISIT_RECORDED",
                            visits: visitsToAdd,
                            description: `Visit recorded for order #${orderSession.billId}`,
                        },
                    });
                }
                if (cashbackAmount > 0) {
                    yield __1.prismaDB.loyaltyTransaction.create({
                        data: {
                            restaurantId: outlet.id,
                            restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
                            programId: loyaltyProgram.id,
                            type: "CASHBACK_EARNED",
                            amount: cashbackAmount,
                            description: `Cashback earned from order #${orderSession.billId}`,
                        },
                    });
                }
            }
        }
        return updatedOrderSession;
    })));
    const formattedOrders = (_h = result === null || result === void 0 ? void 0 : result.orders) === null || _h === void 0 ? void 0 : _h.map((order) => ({
        totalAmount: order === null || order === void 0 ? void 0 : order.totalAmount,
        gstPrice: order === null || order === void 0 ? void 0 : order.gstPrice,
        totalNetPrice: order === null || order === void 0 ? void 0 : order.totalNetPrice,
        orderStatus: order === null || order === void 0 ? void 0 : order.orderStatus,
    }));
    const { cgst, roundedDifference, roundedTotal, sgst, subtotal } = (0, exports.calculateTotals)(formattedOrders);
    // Parse split payment details if available
    let parsedSplitPayments = [];
    if (result.isSplitPayment && result.splitPaymentDetails) {
        try {
            parsedSplitPayments = JSON.parse(result.splitPaymentDetails);
        }
        catch (error) {
            console.error("Error parsing split payment details:", error);
        }
    }
    const invoiceData = {
        restaurantName: outlet.restaurantName,
        address: `${outlet.address},${outlet.city}-${outlet.pincode}`,
        gst: outlet.GSTIN,
        invoiceNo: result === null || result === void 0 ? void 0 : result.billId,
        fssai: outlet.GSTIN,
        invoiceDate: new Date().toLocaleTimeString(),
        customerName: result === null || result === void 0 ? void 0 : result.username,
        customerNo: (_j = result === null || result === void 0 ? void 0 : result.phoneNo) !== null && _j !== void 0 ? _j : "NA",
        paymentMethod: (orderSession === null || orderSession === void 0 ? void 0 : orderSession.isSplitPayment)
            ? "SPLIT"
            : orderSession === null || orderSession === void 0 ? void 0 : orderSession.paymentMethod,
        isSplitPayment: result.isSplitPayment,
        splitPayments: parsedSplitPayments,
        customerAddress: "NA",
        orderSessionId: result === null || result === void 0 ? void 0 : result.id,
        orderItems: (_k = result === null || result === void 0 ? void 0 : result.orders) === null || _k === void 0 ? void 0 : _k.filter((order) => (order === null || order === void 0 ? void 0 : order.orderStatus) === "COMPLETED").flatMap((orderItem) => orderItem.orderItems.map((item, idx) => ({
            id: idx + 1,
            name: item.menuItem.name,
            quantity: item.quantity,
            price: item.originalRate,
            totalPrice: item.totalPrice,
        }))),
        discount: 0,
        subtotal: subtotal,
        sgst: sgst,
        cgst: cgst,
        rounded: roundedDifference,
        total: roundedTotal,
    };
    producer_1.billQueueProducer.addJob({
        invoiceData,
        outletId: outlet.id,
        phoneNumber: (_l = result === null || result === void 0 ? void 0 : result.phoneNo) !== null && _l !== void 0 ? _l : undefined,
        whatsappData: {
            billId: result === null || result === void 0 ? void 0 : result.billId,
            items: invoiceData.orderItems.map((item) => ({
                id: item.id.toString(),
                name: item.name,
                quantity: item.quantity,
                price: item.price,
            })),
            subtotal: invoiceData.subtotal,
            tax: invoiceData.sgst + invoiceData.cgst,
            discount: 0,
            totalAmount: invoiceData.total,
            paymentStatus: "PAID",
            restaurantName: outlet === null || outlet === void 0 ? void 0 : outlet.restaurantName,
            orderType: orderSession === null || orderSession === void 0 ? void 0 : orderSession.orderType,
            isSplitPayment: invoiceData.isSplitPayment,
            splitPayments: invoiceData.splitPayments,
        },
        ownerPhone: (_m = outlet === null || outlet === void 0 ? void 0 : outlet.users) === null || _m === void 0 ? void 0 : _m.phoneNo,
        paymentData: {
            amount: invoiceData.total,
            billId: result === null || result === void 0 ? void 0 : result.billId,
            paymentMode: (orderSession === null || orderSession === void 0 ? void 0 : orderSession.isSplitPayment)
                ? "SPLIT"
                : orderSession === null || orderSession === void 0 ? void 0 : orderSession.paymentMethod,
            isSplitPayment: invoiceData.isSplitPayment,
            splitPayments: invoiceData.splitPayments,
        },
    }, `bill-${result.id}`);
    yield Promise.all([
        redis_1.redis.del(`active-os-${outletId}`),
        redis_1.redis.del(`liv-online-${outletId}`),
        redis_1.redis.del(`liv-o-${outletId}`),
        redis_1.redis.del(`tables-${outletId}`),
        redis_1.redis.del(`a-${outletId}`),
        redis_1.redis.del(`o-n-${outletId}`),
        redis_1.redis.del(`${outletId}-stocks`),
        redis_1.redis.del(`all-order-staff-${outletId}`),
    ]);
    yield redis_1.redis.publish("orderUpdated", JSON.stringify({ outletId }));
    ws_1.websocketManager.notifyClients(outlet === null || outlet === void 0 ? void 0 : outlet.id, "BILL_UPDATED");
    return res.json({
        success: true,
        message: "Bill Recieved & Saved Success ✅",
    });
});
exports.completebillingOrderSession = completebillingOrderSession;
const generatePdfInvoiceInBackground = (invoiceData, outletId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { invoiceUrl } = yield (0, exports.generatePdfInvoice)(invoiceData);
        // Update the database with the generated invoice URL
        yield __1.prismaDB.orderSession.update({
            where: {
                id: invoiceData.orderSessionId,
            },
            data: {
                invoiceUrl,
            },
        });
        console.log("Invoice Generated");
        // Notify WebSocket clients about the updated invoice
        // websocketManager.notifyClients(invoiceData.restaurantName, "INVOICE_GENERATED");
    }
    catch (error) {
        console.error("Error generating PDF in background:", error);
    }
});
exports.generatePdfInvoiceInBackground = generatePdfInvoiceInBackground;
const generatePdfInvoice = (invoiceData) => __awaiter(void 0, void 0, void 0, function* () {
    // Read the EJS template
    const isDevelopment = process.env.NODE_ENV === "development";
    const templatePath = path_1.default.join(process.cwd(), "templates/invoice.ejs");
    const template = yield promises_1.default.readFile(templatePath, "utf-8");
    try {
        const renderedHtml = yield ejs_1.default.renderFile(templatePath, {
            invoiceData,
        });
        // Configure Puppeteer based on environment
        const puppeteerConfig = isDevelopment
            ? {
                // Development (Windows) configuration
                headless: "new", // Use new headless mode
                product: "chrome",
            }
            : {
                // Production (Linux) configuration
                headless: true,
                executablePath: secrets_1.PUPPETEER_EXECUTABLE_PATH,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            };
        const browser = yield puppeteer_1.default.launch(puppeteerConfig);
        const page = yield browser.newPage();
        yield page.setContent(renderedHtml, { waitUntil: "networkidle0" });
        const pdfBuffer = yield page.pdf({
            format: "A4",
            margin: {
                top: "1cm",
                right: "1cm",
                bottom: "1cm",
                left: "1cm",
            },
        });
        yield browser.close();
        const key = `${invoiceData.restaurantName}/${invoiceData.invoiceNo}.pdf`; // File path in S3
        const putObjectCommand = new client_s3_1.PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            Body: pdfBuffer,
            ContentType: "application/pdf",
        });
        const signedUrl = yield (0, s3_request_presigner_1.getSignedUrl)(s3Client, putObjectCommand, {
            expiresIn: 60,
        });
        // Upload the PDF using the signed URL
        yield axios_1.default.put(signedUrl, pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
            },
        });
        // Return the public URL of the uploaded file
        const invoiceUrl = signedUrl.split("?")[0];
        return { invoiceUrl };
        //perform upload to signedurl
    }
    catch (error) {
        console.error(error);
        throw new Error("Error generating and uploading invoice");
    }
});
exports.generatePdfInvoice = generatePdfInvoice;
const assignCustomerToOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _p, _q;
    const { outletId, orderSessionId } = req.params;
    const { customerId } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const orderSession = yield (0, outlet_1.getOrderSessionById)(outlet === null || outlet === void 0 ? void 0 : outlet.id, orderSessionId);
    const getCustomer = yield __1.prismaDB.customerRestaurantAccess.findFirst({
        where: {
            restaurantId: outletId,
            customerId: customerId,
        },
        select: {
            id: true,
            customer: {
                select: {
                    id: true,
                    name: true,
                    phoneNo: true,
                },
            },
        },
    });
    if (!getCustomer) {
        throw new bad_request_1.BadRequestsException("Customer Not Found", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    if (!(orderSession === null || orderSession === void 0 ? void 0 : orderSession.id)) {
        throw new not_found_1.NotFoundException("Order Session not Found", root_1.ErrorCode.NOT_FOUND);
    }
    if (orderSession === null || orderSession === void 0 ? void 0 : orderSession.customerId) {
        throw new bad_request_1.BadRequestsException("Customer Already Assigned to Order", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    yield __1.prismaDB.orderSession.update({
        where: { id: orderSessionId, restaurantId: outletId },
        data: {
            username: (_p = getCustomer === null || getCustomer === void 0 ? void 0 : getCustomer.customer) === null || _p === void 0 ? void 0 : _p.name,
            phoneNo: (_q = getCustomer === null || getCustomer === void 0 ? void 0 : getCustomer.customer) === null || _q === void 0 ? void 0 : _q.phoneNo,
            customerId: getCustomer === null || getCustomer === void 0 ? void 0 : getCustomer.id,
        },
    });
    yield redis_1.redis.del(`active-os-${outletId}`);
    yield redis_1.redis.del(`liv-o-${outletId}`);
    yield redis_1.redis.del(`tables-${outletId}`);
    yield redis_1.redis.del(`a-${outletId}`);
    yield redis_1.redis.del(`o-n-${outletId}`);
    yield redis_1.redis.del(`${outletId}-stocks`);
    yield redis_1.redis.del(`all-order-staff-${outletId}`);
    return res.json({
        success: true,
        message: "Customer Assigned to Order Successfully",
    });
});
exports.assignCustomerToOrder = assignCustomerToOrder;
const calculateTotals = (orders) => {
    var _a, _b;
    const subtotal = (_a = orders === null || orders === void 0 ? void 0 : orders.filter((o) => (o === null || o === void 0 ? void 0 : o.orderStatus) !== "CANCELLED")) === null || _a === void 0 ? void 0 : _a.reduce((acc, order) => acc + (order === null || order === void 0 ? void 0 : order.totalNetPrice), 0);
    const gstPrice = (_b = orders === null || orders === void 0 ? void 0 : orders.filter((o) => (o === null || o === void 0 ? void 0 : o.orderStatus) !== "CANCELLED")) === null || _b === void 0 ? void 0 : _b.reduce((acc, order) => acc + (order === null || order === void 0 ? void 0 : order.gstPrice), 0);
    const sgst = gstPrice / 2;
    const cgst = gstPrice / 2;
    const total = parseFloat((subtotal + gstPrice).toFixed(2));
    const roundedTotal = Math.floor(total); // Rounded down total
    const roundedDifference = parseFloat((total - roundedTotal).toFixed(2)); // Difference between total and roundedTotal
    return { subtotal, sgst, cgst, total, roundedTotal, roundedDifference };
};
exports.calculateTotals = calculateTotals;
const calculateTotalsForTakewayAndDelivery = (orders, deliveryFee, packingFee, orderType) => {
    const subtotal = orders === null || orders === void 0 ? void 0 : orders.reduce((acc, order) => acc + (order === null || order === void 0 ? void 0 : order.price), 0);
    const sgst = subtotal * (orders === null || orders === void 0 ? void 0 : orders.reduce((acc, order) => acc + (order === null || order === void 0 ? void 0 : order.gst), 0));
    const cgst = subtotal * (orders === null || orders === void 0 ? void 0 : orders.reduce((acc, order) => acc + (order === null || order === void 0 ? void 0 : order.gst), 0));
    const total = subtotal + sgst + cgst;
    const tax = cgst + sgst;
    const restaurantCharges = orderType === "DELIVERY"
        ? deliveryFee + packingFee
        : orderType === "TAKEAWAY"
            ? packingFee
            : 0;
    const roundedTotal = Math.floor(total + restaurantCharges); // Rounded down total
    const roundedDifference = parseFloat((total - roundedTotal).toFixed(2)); // Difference between total and roundedTotal
    return {
        subtotal,
        sgst,
        cgst,
        total,
        tax,
        deliveryFee,
        packingFee,
        roundedTotal,
        roundedDifference,
    };
};
exports.calculateTotalsForTakewayAndDelivery = calculateTotalsForTakewayAndDelivery;
