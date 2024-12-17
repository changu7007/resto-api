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
exports.getCurrentOrderForCustomer = exports.getCustomerOrdersById = exports.customerUpdateSession = exports.CustomerLogin = exports.generateOtp = exports.updateOtp = exports.checkCustomer = exports.otpCheck = void 0;
const __1 = require("../../..");
const jwt_1 = require("../../../services/jwt");
const bad_request_1 = require("../../../exceptions/bad-request");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const outlet_1 = require("../../../lib/outlet");
const get_users_1 = require("../../../lib/get-users");
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
    const { mobile } = req.body;
    const newOtp = generateOtp();
    const newExpiry = new Date(Date.now() + 300000);
    const existingOtp = yield __1.prismaDB.otp.findUnique({
        where: {
            mobile: mobile.toString(),
        },
    });
    if (existingOtp) {
        const update = yield __1.prismaDB.otp.update({
            where: { mobile: mobile.toString() },
            data: { otp: newOtp, expires: newExpiry },
        });
        return res.json({ success: true, otp: update.otp });
    }
    else {
        const createdOTP = yield __1.prismaDB.otp.create({
            data: {
                mobile: mobile.toString(),
                otp: newOtp,
                expires: newExpiry,
            }, // expires in 5 minutes
        });
        return res.json({ success: true, otp: createdOTP.otp });
    }
});
exports.updateOtp = updateOtp;
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}
exports.generateOtp = generateOtp;
const CustomerLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phoneNo, name, restaurantId } = req.body;
    const customer = yield __1.prismaDB.customer.findFirst({
        where: {
            phoneNo: phoneNo,
            restaurantId: restaurantId,
        },
    });
    if (customer) {
        const updateCustomer = yield __1.prismaDB.customer.update({
            where: {
                id: customer.id,
                phoneNo: phoneNo,
                restaurantId: restaurantId,
            },
            data: {
                name: name,
            },
        });
        const customerData = {
            id: updateCustomer === null || updateCustomer === void 0 ? void 0 : updateCustomer.id,
            name: updateCustomer === null || updateCustomer === void 0 ? void 0 : updateCustomer.name,
            email: updateCustomer === null || updateCustomer === void 0 ? void 0 : updateCustomer.email,
            phoneNo: updateCustomer === null || updateCustomer === void 0 ? void 0 : updateCustomer.phoneNo,
            image: updateCustomer === null || updateCustomer === void 0 ? void 0 : updateCustomer.image,
            role: updateCustomer === null || updateCustomer === void 0 ? void 0 : updateCustomer.role,
            restaurantId: updateCustomer.restaurantId,
        };
        yield (0, outlet_1.getOutletCustomerAndFetchToRedis)(restaurantId);
        (0, jwt_1.sendToken)(customerData, 200, res);
    }
    else {
        const createCustomer = yield __1.prismaDB.customer.create({
            data: {
                name,
                phoneNo,
                restaurantId,
            },
        });
        const customerData = {
            id: createCustomer === null || createCustomer === void 0 ? void 0 : createCustomer.id,
            name: createCustomer === null || createCustomer === void 0 ? void 0 : createCustomer.name,
            email: createCustomer === null || createCustomer === void 0 ? void 0 : createCustomer.email,
            phoneNo: createCustomer === null || createCustomer === void 0 ? void 0 : createCustomer.phoneNo,
            image: createCustomer === null || createCustomer === void 0 ? void 0 : createCustomer.image,
            role: createCustomer === null || createCustomer === void 0 ? void 0 : createCustomer.role,
            restaurantId: createCustomer.restaurantId,
        };
        yield (0, outlet_1.getOutletCustomerAndFetchToRedis)(restaurantId);
        (0, jwt_1.sendToken)(customerData, 200, res);
    }
});
exports.CustomerLogin = CustomerLogin;
const customerUpdateSession = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, customerId } = req.params;
    const { userType, tableId } = req.body;
    if (!outletId) {
        throw new bad_request_1.BadRequestsException("Restuarant ID Required", root_1.ErrorCode.NOT_FOUND);
    }
    if (!customerId) {
        throw new bad_request_1.BadRequestsException("Customer ID Required", root_1.ErrorCode.NOT_FOUND);
    }
    if (!userType) {
        throw new bad_request_1.BadRequestsException("UserType Required", root_1.ErrorCode.NOT_FOUND);
    }
    const getCustomer = yield __1.prismaDB.customer.findUnique({
        where: {
            id: customerId,
            restaurantId: outletId,
        },
    });
    if (!(getCustomer === null || getCustomer === void 0 ? void 0 : getCustomer.id)) {
        throw new not_found_1.NotFoundException("No User Found", root_1.ErrorCode.NOT_FOUND);
    }
    const updateCustomerDetails = yield __1.prismaDB.customer.updateMany({
        where: {
            id: getCustomer.id,
            restaurantId: outletId,
        },
        data: {
            userType: userType,
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
    yield (0, outlet_1.getOutletCustomerAndFetchToRedis)(outletId);
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
            orders: (_a = session === null || session === void 0 ? void 0 : session.orders) === null || _a === void 0 ? void 0 : _a.map((order) => ({
                id: order === null || order === void 0 ? void 0 : order.generatedOrderId,
                orderStatus: order === null || order === void 0 ? void 0 : order.orderStatus,
                totalAmount: order === null || order === void 0 ? void 0 : order.totalAmount,
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
