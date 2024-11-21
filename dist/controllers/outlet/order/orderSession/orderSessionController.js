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
exports.calculateTotals = exports.generatePdfInvoice = exports.billingOrderSession = void 0;
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
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const billingOrderSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
    const orderSession = yield (0, outlet_1.getOrderSessionById)(outlet.id, orderSessionId);
    if (!(orderSession === null || orderSession === void 0 ? void 0 : orderSession.id)) {
        throw new not_found_1.NotFoundException("Order Session not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const updatedOrderSession = yield __1.prismaDB.orderSession.update({
        where: {
            id: orderSession.id,
            restaurantId: outlet.id,
        },
        data: {
            active: false,
            isPaid: true,
            paymentMethod: paymentMethod,
            subTotal: String(subTotal),
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
    if (!updatedOrderSession) {
        throw new bad_request_1.BadRequestsException("Something went wrong while recieveing the bill", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    const { cgst, roundedDifference, roundedTotal, sgst, subtotal } = (0, exports.calculateTotals)(updatedOrderSession.orders);
    const invoiceData = {
        restaurantName: outlet.restaurantName,
        address: `${outlet.address},${outlet.city}-${outlet.pincode}`,
        gst: outlet.GSTIN,
        invoiceNo: updatedOrderSession.billId,
        fssai: outlet.GSTIN,
        invoiceDate: new Date().toLocaleTimeString(),
        customerName: updatedOrderSession.username,
        customerNo: (_a = updatedOrderSession.phoneNo) !== null && _a !== void 0 ? _a : "NA",
        paymentMethod: paymentMethod,
        customerAddress: "NA",
        orderSessionId: updatedOrderSession.id,
        orderItems: updatedOrderSession.orders
            .filter((order) => order.orderStatus === "COMPLETED")
            .flatMap((orderItem) => orderItem.orderItems.map((item, idx) => {
            var _a;
            return ({
                id: idx + 1,
                name: item.menuItem.name,
                quantity: item.quantity,
                price: item.menuItem.isVariants
                    ? (_a = item.menuItem.menuItemVariants.find((menu) => menu.id === item.sizeVariantsId)) === null || _a === void 0 ? void 0 : _a.price
                    : item.menuItem.price,
                totalPrice: item.price,
            });
        })),
        discount: 0,
        subtotal: subtotal,
        sgst: sgst,
        cgst: cgst,
        rounded: roundedDifference,
        total: roundedTotal,
    };
    console.log("Invoice Data", invoiceData.orderItems);
    const { invoiceUrl } = yield (0, exports.generatePdfInvoice)(invoiceData);
    yield __1.prismaDB.orderSession.update({
        where: {
            restaurantId: outlet.id,
            id: updatedOrderSession === null || updatedOrderSession === void 0 ? void 0 : updatedOrderSession.id,
        },
        data: {
            invoiceUrl: invoiceUrl,
        },
    });
    if (updatedOrderSession.orderType === "DINEIN") {
        const findTable = yield __1.prismaDB.table.findFirst({
            where: {
                restaurantId: outlet.id,
                currentOrderSessionId: orderSession.id,
            },
        });
        if (!findTable) {
            throw new bad_request_1.BadRequestsException("Could not find the table bill your looking for", root_1.ErrorCode.INTERNAL_EXCEPTION);
        }
        const updateTable = yield __1.prismaDB.table.update({
            where: {
                id: findTable === null || findTable === void 0 ? void 0 : findTable.id,
                restaurantId: outlet.id,
            },
            data: {
                occupied: false,
                currentOrderSessionId: null,
                customerId: null,
            },
        });
        if (!updateTable) {
            throw new bad_request_1.BadRequestsException("Could not remove the table session", root_1.ErrorCode.INTERNAL_EXCEPTION);
        }
        yield (0, get_order_1.getFetchLiveOrderToRedis)(outletId);
        yield (0, get_tables_1.getFetchAllTablesToRedis)(outletId);
        yield (0, get_tables_1.getFetchAllAreastoRedis)(outletId);
    }
    yield Promise.all([
        (0, get_order_1.getFetchActiveOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrderSessionToRedis)(outletId),
        (0, get_order_1.getFetchAllOrdersToRedis)(outletId),
        (0, get_order_1.getFetchLiveOrderToRedis)(outletId),
        (0, get_tables_1.getFetchAllTablesToRedis)(outletId),
        (0, get_tables_1.getFetchAllAreastoRedis)(outletId),
        redis_1.redis.del(`all-order-staff-${outletId}`),
    ]);
    yield firebase_1.NotificationService.sendNotification(outlet === null || outlet === void 0 ? void 0 : outlet.fcmToken, "Bill Recieved", `${subTotal}`);
    ws_1.websocketManager.notifyClients(JSON.stringify({
        type: "BILL_UPDATED",
    }));
    return res.json({
        success: true,
        message: "Bill Recieved & Saved Success ✅",
    });
});
exports.billingOrderSession = billingOrderSession;
const generatePdfInvoice = (invoiceData) => __awaiter(void 0, void 0, void 0, function* () {
    // Read the EJS template
    const templatePath = path_1.default.join(process.cwd(), "src/templates/invoice.ejs");
    const template = yield promises_1.default.readFile(templatePath, "utf-8");
    try {
        const renderedHtml = yield ejs_1.default.renderFile(templatePath, {
            invoiceData,
        });
        const browser = yield puppeteer_1.default.launch({
            headless: true,
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
    var _a;
    const subtotal = (_a = orders === null || orders === void 0 ? void 0 : orders.filter((o) => (o === null || o === void 0 ? void 0 : o.orderStatus) !== "CANCELLED")) === null || _a === void 0 ? void 0 : _a.reduce((acc, order) => acc + parseFloat(order === null || order === void 0 ? void 0 : order.totalAmount), 0);
    const sgst = subtotal * 0.025;
    const cgst = subtotal * 0.025;
    const total = subtotal + sgst + cgst;
    const roundedTotal = Math.floor(total); // Rounded down total
    const roundedDifference = parseFloat((total - roundedTotal).toFixed(2)); // Difference between total and roundedTotal
    return { subtotal, sgst, cgst, total, roundedTotal, roundedDifference };
};
exports.calculateTotals = calculateTotals;
