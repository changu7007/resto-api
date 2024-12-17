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
exports.getrazorpayConfig = exports.deleteOutlet = exports.fetchInvoiceDetails = exports.updateInvoiceDetails = exports.createInvoiceDetails = exports.getIntegration = exports.patchOutletOnlinePOrtalDetails = exports.addFMCTokenToOutlet = exports.patchOutletDetails = exports.getMainOutlet = exports.deleteNotificationById = exports.deleteAllNotifications = exports.getAllNotifications = exports.getByOutletId = exports.getStaffOutlet = void 0;
const outlet_1 = require("../../lib/outlet");
const not_found_1 = require("../../exceptions/not-found");
const root_1 = require("../../exceptions/root");
const redis_1 = require("../../services/redis");
const __1 = require("../..");
const bad_request_1 = require("../../exceptions/bad-request");
const staff_1 = require("../../schema/staff");
const get_items_1 = require("../../lib/outlet/get-items");
const unauthorized_1 = require("../../exceptions/unauthorized");
const getStaffOutlet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    //@ts-ignore
    const getOutlet = yield redis_1.redis.get(`O-${(_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.restaurantId}`);
    if (getOutlet) {
        return res.status(200).json({
            success: true,
            outlet: JSON.parse(getOutlet),
            message: "Fetched Successfully from Redis",
        });
    }
    //@ts-ignore
    const outlet = yield (0, outlet_1.getOutletByIdForStaff)((_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.restaurantId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield redis_1.redis.set(`O-${outlet.id}`, JSON.stringify(outlet));
    return res.status(200).json({
        success: true,
        outlet,
        message: "Fetched Successfully from DB",
    });
});
exports.getStaffOutlet = getStaffOutlet;
const getByOutletId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const { outletId } = req.params;
    const outlet = yield redis_1.redis.get(`O-${outletId}`);
    if (outlet) {
        return res.json({
            success: true,
            outlet: JSON.parse(outlet),
            message: "Powered up ⚡",
        });
    }
    const getOutlet = yield __1.prismaDB.restaurant.findFirst({
        where: {
            // @ts-ignore
            adminId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.id,
            id: outletId,
        },
        include: {
            integrations: true,
            invoice: true,
        },
    });
    return res.json({ success: true, outlet: getOutlet });
});
exports.getByOutletId = getByOutletId;
const getAllNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const { outletId } = req.params;
    const rNotifications = yield redis_1.redis.get(`o-n-${outletId}`);
    if (rNotifications) {
        return res.json({
            success: true,
            notifications: JSON.parse(rNotifications),
            message: "Powered up ⚡",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const notifications = yield __1.prismaDB.notification.findMany({
        where: {
            restaurantId: outlet.id,
            status: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    yield redis_1.redis.set(`o-n-${outlet.id}`, JSON.stringify(notifications));
    return res.json({
        success: true,
        notifications: notifications,
        message: "Powering UP",
    });
});
exports.getAllNotifications = getAllNotifications;
const deleteAllNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.notification.deleteMany({
        where: {
            restaurantId: getOutlet.id,
        },
    });
    yield (0, get_items_1.getFetchAllNotificationToRedis)(outletId);
    return res.json({
        success: true,
        message: "Marked All Read",
    });
});
exports.deleteAllNotifications = deleteAllNotifications;
const deleteNotificationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, id } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.notification.delete({
        where: {
            id: id,
            restaurantId: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id,
        },
    });
    yield (0, get_items_1.getFetchAllNotificationToRedis)(outletId);
    return res.json({
        success: true,
        message: "Marked as Read",
    });
});
exports.deleteNotificationById = deleteNotificationById;
const getMainOutlet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _d, _e, _f, _g;
    const { userId } = req.params;
    //@ts-ignore
    if (userId !== ((_d = req.user) === null || _d === void 0 ? void 0 : _d.id)) {
        throw new bad_request_1.BadRequestsException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    //@ts-ignore
    const getOutlet = yield redis_1.redis.get(`O-${(_e = req === null || req === void 0 ? void 0 : req.user) === null || _e === void 0 ? void 0 : _e.restaurantId}`);
    if (getOutlet) {
        console.log("Redis");
        return res.status(200).json({
            success: true,
            outlet: JSON.parse(getOutlet),
            message: "Fetched Successfully from Redis",
        });
    }
    const outlet = yield (0, outlet_1.getOutletByAdminId)(
    //@ts-ignore
    (_f = req === null || req === void 0 ? void 0 : req.user) === null || _f === void 0 ? void 0 : _f.restaurantId, 
    //@ts-ignore
    (_g = req === null || req === void 0 ? void 0 : req.user) === null || _g === void 0 ? void 0 : _g.id);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield redis_1.redis.set(`O-${outlet.id}`, JSON.stringify(outlet));
    return res.status(200).json({
        success: true,
        outlet,
        message: "Fetched Successfully from DB",
    });
});
exports.getMainOutlet = getMainOutlet;
const patchOutletDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _h;
    const { outletId } = req.params;
    const { name, imageurl, restaurantName, phoneNo, email, address, city, pincode, } = req.body;
    const getOutlet = yield __1.prismaDB.restaurant.findFirst({
        where: {
            // @ts-ignore
            adminId: (_h = req.user) === null || _h === void 0 ? void 0 : _h.id,
            id: outletId,
        },
    });
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.restaurant.updateMany({
        where: {
            id: getOutlet.id,
        },
        data: {
            name: name !== null && name !== void 0 ? name : getOutlet.name,
            restaurantName: restaurantName !== null && restaurantName !== void 0 ? restaurantName : getOutlet.restaurantName,
            phoneNo: phoneNo !== null && phoneNo !== void 0 ? phoneNo : getOutlet.phoneNo,
            email: email !== null && email !== void 0 ? email : getOutlet.email,
            imageUrl: imageurl !== null && imageurl !== void 0 ? imageurl : getOutlet.imageUrl,
            address: address !== null && address !== void 0 ? address : getOutlet.address,
            city: city !== null && city !== void 0 ? city : getOutlet.city,
            pincode: pincode !== null && pincode !== void 0 ? pincode : getOutlet.pincode,
        },
    });
    yield (0, outlet_1.fetchOutletByIdToRedis)(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id);
    return res.json({ success: true, message: "Updated Success" });
});
exports.patchOutletDetails = patchOutletDetails;
const addFMCTokenToOutlet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { token } = req.body;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    const updateOutlet = yield __1.prismaDB.restaurant.update({
        where: {
            id: getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id,
        },
        data: {
            fcmToken: token,
        },
    });
    yield (0, outlet_1.fetchOutletByIdToRedis)(updateOutlet === null || updateOutlet === void 0 ? void 0 : updateOutlet.id);
    return res.json({
        success: true,
        message: "FMC TOKEN ADDED SUCCESFULLY",
    });
});
exports.addFMCTokenToOutlet = addFMCTokenToOutlet;
const patchOutletOnlinePOrtalDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const validateFields = staff_1.outletOnlinePortalSchema.parse(req.body);
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.restaurant.update({
        where: {
            id: outlet.id,
        },
        data: {
            onlinePortal: true,
            openTime: validateFields.openTime,
            closeTime: validateFields.closeTime,
            areaLat: validateFields.areaLat,
            areaLong: validateFields.areaLong,
            orderRadius: Number(validateFields.orderRadius),
            isDelivery: validateFields.isDelivery,
            isDineIn: validateFields.isDineIn,
            isPickUp: validateFields.isPickUp,
        },
    });
    if (!outlet.integrations.find((outlet) => (outlet === null || outlet === void 0 ? void 0 : outlet.name) === "ONLINEHUB")) {
        yield __1.prismaDB.integration.create({
            data: {
                restaurantId: outlet.id,
                name: "ONLINEHUB",
                connected: true,
                status: true,
                link: validateFields.subdomain,
            },
        });
    }
    yield (0, outlet_1.fetchOutletByIdToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
    return res.json({
        success: true,
        message: "Online Hub Integrated Success",
    });
});
exports.patchOutletOnlinePOrtalDetails = patchOutletOnlinePOrtalDetails;
const getIntegration = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getINtegrations = yield __1.prismaDB.integration.findMany({
        where: {
            restaurantId: outlet.id,
        },
    });
    return res.json({
        success: true,
        integrations: getINtegrations,
    });
});
exports.getIntegration = getIntegration;
const createInvoiceDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { isGSTEnabled, isPrefix, invoiceNo, prefix } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.invoice.create({
        data: {
            restaurantId: outlet.id,
            isGSTEnabled,
            isPrefix,
            invoiceNo,
            prefix: isPrefix ? prefix : "",
        },
    });
    return res.json({
        success: true,
        message: "Created Tax & Invoice Details",
    });
});
exports.createInvoiceDetails = createInvoiceDetails;
const updateInvoiceDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { isGSTEnabled, isPrefix, invoiceNo, prefix } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.invoice.update({
        where: {
            restaurantId: outlet.id,
        },
        data: {
            isGSTEnabled,
            isPrefix,
            invoiceNo,
            prefix: isPrefix ? prefix : "",
        },
    });
    return res.json({
        success: true,
        message: "Updated Tax & Invoice Details",
    });
});
exports.updateInvoiceDetails = updateInvoiceDetails;
const fetchInvoiceDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getInvoiceDetails = yield __1.prismaDB.invoice.findFirst({
        where: {
            restaurantId: outlet.id,
        },
    });
    return res.json({
        success: true,
        invoiceData: getInvoiceDetails,
    });
});
exports.fetchInvoiceDetails = fetchInvoiceDetails;
const deleteOutlet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _j;
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    const userId = (_j = req === null || req === void 0 ? void 0 : req.user) === null || _j === void 0 ? void 0 : _j.id;
    if (outlet === undefined || !outlet.id) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (outlet.adminId !== userId) {
        throw new unauthorized_1.UnauthorizedException("Your Unauthorized To delete this Settings", root_1.ErrorCode.UNAUTHORIZED);
    }
    yield __1.prismaDB.restaurant.delete({
        where: {
            id: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            adminId: userId,
        },
    });
    yield __1.prismaDB.onboardingStatus.delete({
        where: {
            userId: userId,
        },
    });
    yield redis_1.redis.del(`O-${outletId}`);
    return res.json({ success: true, message: "Outlet Deleted" });
});
exports.deleteOutlet = deleteOutlet;
const getrazorpayConfig = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (outlet === undefined || !outlet.id) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const razorpayConfig = yield __1.prismaDB.razorpayIntegration.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    });
    return res.json({
        success: true,
        config: razorpayConfig,
    });
});
exports.getrazorpayConfig = getrazorpayConfig;
