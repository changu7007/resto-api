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
exports.calculateTotalsForTakewayAndDelivery = exports.calculateTotals = exports.generatePdfInvoice = exports.generatePdfInvoiceInBackground = exports.billingOrderSession = void 0;
const outlet_1 = require("../../../../lib/outlet");
const not_found_1 = require("../../../../exceptions/not-found");
const root_1 = require("../../../../exceptions/root");
const client_1 = require("@prisma/client");
const bad_request_1 = require("../../../../exceptions/bad-request");
const __1 = require("../../../..");
const redis_1 = require("../../../../services/redis");
const ws_1 = require("../../../../services/ws");
const get_order_1 = require("../../../../lib/outlet/get-order");
const get_tables_1 = require("../../../../lib/outlet/get-tables");
const firebase_1 = require("../../../../services/firebase");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const ejs_1 = __importDefault(require("ejs"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const axios_1 = __importDefault(require("axios"));
const secrets_1 = require("../../../../secrets");
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const billingOrderSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { orderSessionId, outletId } = req.params;
    const { subTotal, paymentMethod } = req.body;
    if (typeof subTotal !== "number" ||
        !Object.values(client_1.PaymentMethod).includes(paymentMethod)) {
        throw new bad_request_1.BadRequestsException("Invalid total or Choose Payment method", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const orderSession = yield (0, outlet_1.getOrderSessionById)(outlet === null || outlet === void 0 ? void 0 : outlet.id, orderSessionId);
    if (!(orderSession === null || orderSession === void 0 ? void 0 : orderSession.id)) {
        throw new not_found_1.NotFoundException("Order Session not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const result = yield (__1.prismaDB === null || __1.prismaDB === void 0 ? void 0 : __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        const updatedOrderSession = yield __1.prismaDB.orderSession.update({
            where: {
                id: orderSession.id,
                restaurantId: outlet.id,
            },
            data: {
                active: false,
                isPaid: true,
                paymentMethod: paymentMethod,
                subTotal: subTotal,
                sessionStatus: "COMPLETED",
                orders: {
                    updateMany: {
                        where: {
                            orderStatus: "SERVED",
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
        return updatedOrderSession;
    })));
    const formattedOrders = (_a = result === null || result === void 0 ? void 0 : result.orders) === null || _a === void 0 ? void 0 : _a.map((order) => ({
        totalAmount: order === null || order === void 0 ? void 0 : order.totalAmount,
        gstPrice: order === null || order === void 0 ? void 0 : order.gstPrice,
        totalNetPrice: order === null || order === void 0 ? void 0 : order.totalNetPrice,
        orderStatus: order === null || order === void 0 ? void 0 : order.orderStatus,
    }));
    const { cgst, roundedDifference, roundedTotal, sgst, subtotal } = (0, exports.calculateTotals)(formattedOrders);
    const invoiceData = {
        restaurantName: outlet.restaurantName,
        address: `${outlet.address},${outlet.city}-${outlet.pincode}`,
        gst: outlet.GSTIN,
        invoiceNo: result === null || result === void 0 ? void 0 : result.billId,
        fssai: outlet.GSTIN,
        invoiceDate: new Date().toLocaleTimeString(),
        customerName: result === null || result === void 0 ? void 0 : result.username,
        customerNo: (_b = result === null || result === void 0 ? void 0 : result.phoneNo) !== null && _b !== void 0 ? _b : "NA",
        paymentMethod: paymentMethod,
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
    (0, exports.generatePdfInvoiceInBackground)(invoiceData, outlet === null || outlet === void 0 ? void 0 : outlet.id);
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
        redis_1.redis.del(`all-order-staff-${outletId}`),
    ]);
    if (outlet === null || outlet === void 0 ? void 0 : outlet.fcmToken) {
        yield firebase_1.NotificationService.sendNotification(outlet === null || outlet === void 0 ? void 0 : outlet.fcmToken, "Bill Recieved", `${subTotal}`);
    }
    ws_1.websocketManager.notifyClients(outlet === null || outlet === void 0 ? void 0 : outlet.id, "BILL_UPDATED");
    return res.json({
        success: true,
        message: "Bill Recieved & Saved Success ✅",
    });
});
exports.billingOrderSession = billingOrderSession;
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
        yield (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId);
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
    const templatePath = path_1.default.join(process.cwd(), "templates/invoice.ejs");
    const template = yield promises_1.default.readFile(templatePath, "utf-8");
    try {
        const renderedHtml = yield ejs_1.default.renderFile(templatePath, {
            invoiceData,
        });
        const browser = yield puppeteer_1.default.launch({
            headless: true,
            executablePath: secrets_1.PUPPETEER_EXECUTABLE_PATH,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
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
const calculateTotalsForTakewayAndDelivery = (orders) => {
    const subtotal = orders === null || orders === void 0 ? void 0 : orders.reduce((acc, order) => acc + (order === null || order === void 0 ? void 0 : order.price), 0);
    const sgst = subtotal * 0.025;
    const cgst = subtotal * 0.025;
    const total = subtotal + sgst + cgst;
    const tax = cgst + sgst;
    const roundedTotal = Math.floor(total); // Rounded down total
    const roundedDifference = parseFloat((total - roundedTotal).toFixed(2)); // Difference between total and roundedTotal
    return { subtotal, sgst, cgst, total, tax, roundedTotal, roundedDifference };
};
exports.calculateTotalsForTakewayAndDelivery = calculateTotalsForTakewayAndDelivery;
