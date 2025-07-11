"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.CustomerUpdateAccessToken = exports.getCurrentOrderForCustomer = exports.getCustomerOrdersById = exports.customerUpdateSession = exports.CustomerLogin = exports.generateOtp = exports.verifyOtp = exports.sendWhatsAppOtp = exports.updateOtp = exports.checkCustomer = exports.otpCheck = void 0;
const __1 = require("../../..");
const jwt_1 = require("../../../services/jwt");
const bad_request_1 = require("../../../exceptions/bad-request");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const outlet_1 = require("../../../lib/outlet");
const get_users_1 = require("../../../lib/get-users");
const secrets_1 = require("../../../secrets");
const secrets_2 = require("../../../secrets");
const jwt = __importStar(require("jsonwebtoken"));
const redis_1 = require("../../../services/redis");
const whatsapp_1 = require("../../../services/whatsapp");
const twilio_1 = require("../../../services/twilio");
const whatsappService = new whatsapp_1.WhatsAppService({
    accessToken: process.env.META_ACCESS_TOKEN,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID,
    businessAccountId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID,
    version: "v21.0",
});
// Initialize Twilio service for SMS
const twilioService = new twilio_1.TwilioService({
    accountSid: secrets_1.TWILIO_ACCOUNT_SID,
    authToken: secrets_1.TWILIO_AUTH_TOKEN,
    fromPhoneNumber: secrets_1.TWILIO_PHONE_NUMBER,
});
const otpCheck = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { mobile } = req.body;
    const otpRecord = yield __1.prismaDB.otp.findUnique({
        where: {
            mobile: mobile,
        },
    });
    return res.json({ success: true, otpRecord });
});
exports.otpCheck = otpCheck;
const checkCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, mobile } = req.body;
});
exports.checkCustomer = checkCustomer;
const updateOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { mobile, restaurantId } = req.body;
    try {
        const getOutlet = yield (0, outlet_1.getOutletById)(restaurantId);
        if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
            throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
        }
        // Generate a new OTP
        const newOtp = generateOtp();
        const newExpiry = new Date(Date.now() + 300000); // 5 minutes expiry
        // Store or update OTP in database
        const existingOtp = yield __1.prismaDB.otp.findUnique({
            where: {
                mobile: mobile.toString(),
            },
        });
        if (existingOtp) {
            yield __1.prismaDB.otp.update({
                where: { mobile: mobile.toString() },
                data: { otp: newOtp, expires: newExpiry },
            });
        }
        else {
            yield __1.prismaDB.otp.create({
                data: {
                    mobile: mobile.toString(),
                    otp: newOtp,
                    expires: newExpiry,
                },
            });
        }
        // Send OTP via SMS using Twilio
        const businessName = (getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.name) || "Your Restaurant";
        yield twilioService.sendSmsOtp(mobile.toString(), newOtp, businessName);
        return res.json({
            success: true,
            message: "Verification code sent via SMS",
            phoneNumber: mobile.toString(),
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to send verification code",
        });
    }
});
exports.updateOtp = updateOtp;
/**
 * Send OTP via WhatsApp
 */
const sendWhatsAppOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { mobile, restaurantName } = req.body;
    try {
        // Generate a new OTP
        const newOtp = generateOtp();
        const newExpiry = new Date(Date.now() + 300000); // 5 minutes expiry
        // Store or update OTP in database
        const existingOtp = yield __1.prismaDB.otp.findUnique({
            where: {
                mobile: mobile.toString(),
            },
        });
        if (existingOtp) {
            yield __1.prismaDB.otp.update({
                where: { mobile: mobile.toString() },
                data: { otp: newOtp, expires: newExpiry },
            });
        }
        else {
            yield __1.prismaDB.otp.create({
                data: {
                    mobile: mobile.toString(),
                    otp: newOtp,
                    expires: newExpiry,
                },
            });
        }
        // Send OTP via WhatsApp using Twilio
        const businessName = restaurantName || "Your Restaurant";
        yield twilioService.sendWhatsAppOtp(mobile.toString(), newOtp, businessName);
        return res.json({
            success: true,
            message: "Verification code sent via WhatsApp",
            phoneNumber: mobile.toString(),
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to send verification code",
        });
    }
});
exports.sendWhatsAppOtp = sendWhatsAppOtp;
/**
 * Verify OTP code
 */
const verifyOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { mobile, code } = req.body;
    try {
        if (!mobile || !code) {
            return res.status(400).json({
                success: false,
                message: "Phone number and verification code are required",
            });
        }
        // Get OTP from database
        const otpRecord = yield __1.prismaDB.otp.findUnique({
            where: { mobile: mobile.toString() },
        });
        if (!otpRecord) {
            return res.status(404).json({
                success: false,
                message: "No verification code found for this number",
            });
        }
        // Check if OTP has expired
        if (new Date() > otpRecord.expires) {
            // Delete expired OTP
            yield __1.prismaDB.otp.delete({
                where: { mobile: mobile.toString() },
            });
            return res.status(400).json({
                success: false,
                message: "Verification code has expired",
            });
        }
        // Check if OTP matches
        if (otpRecord.otp !== code) {
            return res.status(400).json({
                success: false,
                message: "Invalid verification code",
            });
        }
        // Delete used OTP
        yield __1.prismaDB.otp.delete({
            where: { mobile: mobile.toString() },
        });
        return res.json({
            success: true,
            message: "Phone number verified successfully",
            phoneNumber: mobile.toString(),
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to verify code",
        });
    }
});
exports.verifyOtp = verifyOtp;
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}
exports.generateOtp = generateOtp;
const CustomerLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phoneNo, name, restaurantId } = req.body;
    const existingCustomer = yield __1.prismaDB.customer.findUnique({
        where: {
            phoneNo: phoneNo,
        },
        include: {
            restaurantAccess: true,
        },
    });
    if (existingCustomer === null || existingCustomer === void 0 ? void 0 : existingCustomer.id) {
        // Customer exists, check if they have access to this restaurant
        const hasRestaurantAccess = existingCustomer.restaurantAccess.some((access) => access.restaurantId === restaurantId);
        if (hasRestaurantAccess) {
            // Update existing customer's name if provided
            const updateCustomer = yield __1.prismaDB.customer.update({
                where: {
                    id: existingCustomer.id,
                },
                data: {
                    name: name || existingCustomer.name,
                },
            });
            const customerData = {
                id: updateCustomer.id,
                name: updateCustomer.name,
                email: updateCustomer.email,
                phoneNo: updateCustomer.phoneNo,
                image: updateCustomer.image,
                role: updateCustomer.role,
                restaurantId: restaurantId,
            };
            yield (0, outlet_1.getOutletCustomerAndFetchToRedis)(restaurantId);
            return (0, jwt_1.sendToken)(customerData, 200, res);
        }
        else {
            // Add access to new restaurant for existing customer
            yield __1.prismaDB.customerRestaurantAccess.create({
                data: {
                    customerId: existingCustomer.id,
                    restaurantId: restaurantId,
                },
            });
            const customerData = {
                id: existingCustomer.id,
                name: existingCustomer.name,
                email: existingCustomer.email,
                phoneNo: existingCustomer.phoneNo,
                image: existingCustomer.image,
                role: existingCustomer.role,
                restaurantId: restaurantId,
            };
            yield (0, outlet_1.getOutletCustomerAndFetchToRedis)(restaurantId);
            return (0, jwt_1.sendToken)(customerData, 200, res);
        }
    }
    else {
        const createCustomer = yield __1.prismaDB.customer.create({
            data: {
                name,
                phoneNo,
                restaurantAccess: {
                    create: {
                        restaurantId: restaurantId,
                    },
                },
            },
        });
        const customerData = {
            id: createCustomer === null || createCustomer === void 0 ? void 0 : createCustomer.id,
            name: createCustomer === null || createCustomer === void 0 ? void 0 : createCustomer.name,
            email: createCustomer === null || createCustomer === void 0 ? void 0 : createCustomer.email,
            phoneNo: createCustomer === null || createCustomer === void 0 ? void 0 : createCustomer.phoneNo,
            image: createCustomer === null || createCustomer === void 0 ? void 0 : createCustomer.image,
            role: createCustomer === null || createCustomer === void 0 ? void 0 : createCustomer.role,
            restaurantId: restaurantId,
        };
        yield (0, outlet_1.getOutletCustomerAndFetchToRedis)(restaurantId);
        (0, jwt_1.sendToken)(customerData, 200, res);
    }
});
exports.CustomerLogin = CustomerLogin;
const customerUpdateSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, customerId } = req.params;
    const { userType, tableId, address, location } = req.body;
    if (!outletId) {
        throw new bad_request_1.BadRequestsException("Restuarant ID Required", root_1.ErrorCode.NOT_FOUND);
    }
    if (!customerId) {
        throw new bad_request_1.BadRequestsException("Customer ID Required", root_1.ErrorCode.NOT_FOUND);
    }
    if (!userType) {
        throw new bad_request_1.BadRequestsException("UserType Required", root_1.ErrorCode.NOT_FOUND);
    }
    const getCustomer = yield __1.prismaDB.customerRestaurantAccess.findFirst({
        where: {
            customerId: customerId,
            restaurantId: outletId,
        },
    });
    if (!(getCustomer === null || getCustomer === void 0 ? void 0 : getCustomer.id)) {
        throw new not_found_1.NotFoundException("No User Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.customerRestaurantAccess.update({
        where: {
            id: getCustomer.id,
            customerId: getCustomer.customerId,
            restaurantId: outletId,
        },
        data: {
            userType: userType,
            address: `${address === null || address === void 0 ? void 0 : address.area},${address === null || address === void 0 ? void 0 : address.address}`,
            landmark: address === null || address === void 0 ? void 0 : address.landmark,
            latitude: (location === null || location === void 0 ? void 0 : location.lat) ? location === null || location === void 0 ? void 0 : location.lat.toString() : null,
            longitude: (location === null || location === void 0 ? void 0 : location.lng) ? location === null || location === void 0 ? void 0 : location.lng.toString() : null,
        },
    });
    if (tableId) {
        yield __1.prismaDB.table.updateMany({
            where: {
                id: tableId,
                restaurantId: outletId,
            },
            data: {
                customerId: getCustomer === null || getCustomer === void 0 ? void 0 : getCustomer.id,
                occupied: true,
            },
        });
    }
    return res.json({
        success: true,
        message: "Profile Session ot updated",
    });
});
exports.customerUpdateSession = customerUpdateSession;
const getCustomerOrdersById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, customerId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const customer = yield (0, get_users_1.getCustomerById)(customerId, outlet === null || outlet === void 0 ? void 0 : outlet.id);
    if (!(customer === null || customer === void 0 ? void 0 : customer.id)) {
        throw new not_found_1.NotFoundException("Customer Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const formattedOrder = customer === null || customer === void 0 ? void 0 : customer.orderSession.filter((s) => s.active === false).map((session) => {
        var _a;
        return ({
            id: session === null || session === void 0 ? void 0 : session.id,
            billId: session === null || session === void 0 ? void 0 : session.billId,
            active: session === null || session === void 0 ? void 0 : session.active,
            invoiceUrl: session === null || session === void 0 ? void 0 : session.invoiceUrl,
            orderType: session === null || session === void 0 ? void 0 : session.orderType,
            status: session === null || session === void 0 ? void 0 : session.sessionStatus,
            isPaid: session === null || session === void 0 ? void 0 : session.isPaid,
            subTotal: session === null || session === void 0 ? void 0 : session.subTotal,
            paymentMethod: session === null || session === void 0 ? void 0 : session.paymentMethod,
            deliveryFee: session === null || session === void 0 ? void 0 : session.deliveryFee,
            packingFee: session === null || session === void 0 ? void 0 : session.packingFee,
            paymentMode: session === null || session === void 0 ? void 0 : session.paymentMode,
            orders: (_a = session === null || session === void 0 ? void 0 : session.orders) === null || _a === void 0 ? void 0 : _a.map((order) => ({
                id: order === null || order === void 0 ? void 0 : order.generatedOrderId,
                status: order === null || order === void 0 ? void 0 : order.orderStatus,
                s: order === null || order === void 0 ? void 0 : order.totalAmount,
                orderItems: order === null || order === void 0 ? void 0 : order.orderItems.map((item) => ({
                    id: item === null || item === void 0 ? void 0 : item.id,
                    name: item === null || item === void 0 ? void 0 : item.name,
                    quantity: item.quantity,
                    originalRate: item.originalRate,
                    total: item === null || item === void 0 ? void 0 : item.totalPrice,
                })),
            })),
        });
    });
    return res.json({
        success: true,
        orders: formattedOrder,
    });
});
exports.getCustomerOrdersById = getCustomerOrdersById;
const getCurrentOrderForCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, customerId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const customer = yield (0, get_users_1.getCustomerById)(customerId, outlet === null || outlet === void 0 ? void 0 : outlet.id);
    if (!(customer === null || customer === void 0 ? void 0 : customer.id)) {
        throw new not_found_1.NotFoundException("Customer Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const formattedOrder = customer === null || customer === void 0 ? void 0 : customer.orderSession.filter((s) => s.active === true).map((session) => {
        var _a, _b;
        return ({
            id: session === null || session === void 0 ? void 0 : session.id,
            orderStatus: (_a = session === null || session === void 0 ? void 0 : session.orders) === null || _a === void 0 ? void 0 : _a.some((o) => (o === null || o === void 0 ? void 0 : o.orderStatus) !== "SERVED" && (o === null || o === void 0 ? void 0 : o.orderStatus) !== "CANCELLED"),
            billId: session === null || session === void 0 ? void 0 : session.billId,
            active: session === null || session === void 0 ? void 0 : session.active,
            invoiceUrl: session === null || session === void 0 ? void 0 : session.invoiceUrl,
            orderType: session === null || session === void 0 ? void 0 : session.orderType,
            status: session === null || session === void 0 ? void 0 : session.sessionStatus,
            isPaid: session === null || session === void 0 ? void 0 : session.isPaid,
            subTotal: session === null || session === void 0 ? void 0 : session.subTotal,
            paymentMethod: session === null || session === void 0 ? void 0 : session.paymentMethod,
            deliveryFee: session === null || session === void 0 ? void 0 : session.deliveryFee,
            packingFee: session === null || session === void 0 ? void 0 : session.packingFee,
            paymentMode: session === null || session === void 0 ? void 0 : session.paymentMode,
            orders: (_b = session === null || session === void 0 ? void 0 : session.orders) === null || _b === void 0 ? void 0 : _b.map((order) => ({
                id: order === null || order === void 0 ? void 0 : order.generatedOrderId,
                orderStatus: order === null || order === void 0 ? void 0 : order.orderStatus,
                totalAmount: order === null || order === void 0 ? void 0 : order.totalAmount,
                preparationTime: order === null || order === void 0 ? void 0 : order.preparationTime,
                createdAt: order === null || order === void 0 ? void 0 : order.createdAt,
                updatedAt: order === null || order === void 0 ? void 0 : order.updatedAt,
                orderItems: order === null || order === void 0 ? void 0 : order.orderItems.map((item) => ({
                    id: item === null || item === void 0 ? void 0 : item.id,
                    name: item === null || item === void 0 ? void 0 : item.name,
                    quantity: item.quantity,
                    originalRate: item.originalRate,
                    total: item === null || item === void 0 ? void 0 : item.totalPrice,
                })),
            })),
        });
    });
    return res.json({
        success: true,
        orders: formattedOrder,
    });
});
exports.getCurrentOrderForCustomer = getCurrentOrderForCustomer;
const CustomerUpdateAccessToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers.authorization;
    const refresh_token = authHeader && authHeader.split(" ")[1];
    const payload = jwt.verify(refresh_token, secrets_2.REFRESH_TOKEN);
    if (!payload) {
        throw new not_found_1.NotFoundException("Could Not refresh token", root_1.ErrorCode.TOKENS_NOT_VALID);
    }
    const session = yield redis_1.redis.get(payload.id);
    if (!session) {
        throw new not_found_1.NotFoundException("User Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const user = JSON.parse(session);
    const accessToken = jwt.sign({ id: user.id }, secrets_1.ACCESS_TOKEN, {
        expiresIn: "5m",
    });
    const refreshToken = jwt.sign({ id: user === null || user === void 0 ? void 0 : user.id }, secrets_2.REFRESH_TOKEN, {
        expiresIn: "7d",
    });
    res.status(200).json({
        success: true,
        tokens: {
            accessToken,
            refreshToken,
        },
    });
});
exports.CustomerUpdateAccessToken = CustomerUpdateAccessToken;
