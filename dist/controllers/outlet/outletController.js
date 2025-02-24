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
exports.updateOnlinePortalStatus = exports.updateOutletType = exports.createOutletFromOutletHub = exports.getrazorpayConfig = exports.deleteOutlet = exports.fetchInvoiceDetails = exports.updateInvoiceDetails = exports.createInvoiceDetails = exports.getIntegration = exports.updateOrCreateOperatingHours = exports.patchOutletOnlinePOrtalDetails = exports.addFMCTokenToOutlet = exports.patchOutletDetails = exports.getMainOutlet = exports.deleteNotificationById = exports.deleteAllNotifications = exports.getAllNotifications = exports.getByOutletId = exports.getPOSStaffOutlet = exports.getStaffOutlet = exports.getAllOutlets = void 0;
const outlet_1 = require("../../lib/outlet");
const not_found_1 = require("../../exceptions/not-found");
const root_1 = require("../../exceptions/root");
const redis_1 = require("../../services/redis");
const __1 = require("../..");
const bad_request_1 = require("../../exceptions/bad-request");
const staff_1 = require("../../schema/staff");
const get_items_1 = require("../../lib/outlet/get-items");
const unauthorized_1 = require("../../exceptions/unauthorized");
const get_users_1 = require("../../lib/get-users");
const zod_1 = require("zod");
const utils_1 = require("../../lib/utils");
const getAllOutlets = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const outlets = yield __1.prismaDB.restaurant.findMany({
        select: {
            id: true,
        },
    });
    return res.json({
        success: true,
        outlets: outlets || [],
        message: "Fetched Successfully",
    });
});
exports.getAllOutlets = getAllOutlets;
const getStaffOutlet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    console.log("Request Initiated");
    // @ts-ignore
    console.log((_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.restaurantId);
    // @ts-ignore
    const getOutlet = yield redis_1.redis.get(`O-${(_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.restaurantId}`);
    console.log(getOutlet);
    if (getOutlet) {
        return res.status(200).json({
            success: true,
            outlet: JSON.parse(getOutlet),
            message: "Fetched Successfully from Redis",
        });
    }
    //@ts-ignore
    const outlet = yield (0, outlet_1.getOutletByIdForStaff)((_c = req === null || req === void 0 ? void 0 : req.user) === null || _c === void 0 ? void 0 : _c.restaurantId);
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
const getPOSStaffOutlet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _d, _e, _f, _g, _h, _j;
    // @ts-ignore
    console.log((_e = (_d = req === null || req === void 0 ? void 0 : req.user) === null || _d === void 0 ? void 0 : _d.restaurant) === null || _e === void 0 ? void 0 : _e.id);
    // @ts-ignore
    const getOutlet = yield redis_1.redis.get(`O-${(_g = (_f = req === null || req === void 0 ? void 0 : req.user) === null || _f === void 0 ? void 0 : _f.restaurant) === null || _g === void 0 ? void 0 : _g.id}`);
    if (getOutlet) {
        return res.status(200).json({
            success: true,
            outlet: JSON.parse(getOutlet),
            message: "Fetched Successfully from Redis",
        });
    }
    //@ts-ignore
    const outlet = yield (0, outlet_1.getOutletByIdForStaff)((_j = (_h = req === null || req === void 0 ? void 0 : req.user) === null || _h === void 0 ? void 0 : _h.restaurant) === null || _j === void 0 ? void 0 : _j.id);
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
exports.getPOSStaffOutlet = getPOSStaffOutlet;
const getByOutletId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _k;
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
            adminId: (_k = req.user) === null || _k === void 0 ? void 0 : _k.id,
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
    var _l, _m, _o, _p;
    const { userId } = req.params;
    //@ts-ignore
    if (userId !== ((_l = req.user) === null || _l === void 0 ? void 0 : _l.id)) {
        throw new bad_request_1.BadRequestsException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    //@ts-ignore
    const getOutlet = yield redis_1.redis.get(`O-${(_m = req === null || req === void 0 ? void 0 : req.user) === null || _m === void 0 ? void 0 : _m.restaurantId}`);
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
    (_o = req === null || req === void 0 ? void 0 : req.user) === null || _o === void 0 ? void 0 : _o.restaurantId, 
    //@ts-ignore
    (_p = req === null || req === void 0 ? void 0 : req.user) === null || _p === void 0 ? void 0 : _p.id);
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
    var _q, _r, _s, _t;
    const { outletId } = req.params;
    const { name, imageUrl, restaurantName, phoneNo, email, address, city, pincode, } = req.body;
    console.log(req.body);
    const getOutlet = yield __1.prismaDB.restaurant.findFirst({
        where: {
            // @ts-ignore
            adminId: (_q = req.user) === null || _q === void 0 ? void 0 : _q.id,
            id: outletId,
        },
        include: {
            users: {
                select: {
                    sites: true,
                },
            },
        },
    });
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.restaurant.update({
        where: {
            id: getOutlet.id,
        },
        data: {
            name: name !== null && name !== void 0 ? name : getOutlet.name,
            restaurantName: restaurantName !== null && restaurantName !== void 0 ? restaurantName : getOutlet.restaurantName,
            phoneNo: phoneNo !== null && phoneNo !== void 0 ? phoneNo : getOutlet.phoneNo,
            email: email !== null && email !== void 0 ? email : getOutlet.email,
            imageUrl: imageUrl ? imageUrl : getOutlet.imageUrl,
            address: address !== null && address !== void 0 ? address : getOutlet.address,
            city: city !== null && city !== void 0 ? city : getOutlet.city,
            pincode: pincode !== null && pincode !== void 0 ? pincode : getOutlet.pincode,
        },
    });
    yield redis_1.redis.del(`O-${getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id}`);
    if (((_s = (_r = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.users) === null || _r === void 0 ? void 0 : _r.sites) === null || _s === void 0 ? void 0 : _s.length) > 0) {
        for (const site of (_t = getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.users) === null || _t === void 0 ? void 0 : _t.sites) {
            if (site === null || site === void 0 ? void 0 : site.subdomain) {
                yield redis_1.redis.del(`app-domain-${site === null || site === void 0 ? void 0 : site.subdomain}`);
            }
        }
    }
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
    var _u, _v, _w, _x;
    const validateFields = staff_1.outletOnlinePortalSchema.safeParse(req.body);
    if (!validateFields.success) {
        throw new bad_request_1.BadRequestsException(validateFields.error.message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
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
            openTime: validateFields.data.openTime.time,
            closeTime: validateFields.data.closeTime.time,
            areaLat: validateFields.data.areaLat,
            areaLong: validateFields.data.areaLong,
            orderRadius: Number(validateFields.data.orderRadius),
            isDelivery: validateFields.data.isDelivery,
            isDineIn: validateFields.data.isDineIn,
            isPickUp: validateFields.data.isPickUp,
        },
    });
    if (!outlet.integrations.find((outlet) => (outlet === null || outlet === void 0 ? void 0 : outlet.name) === "ONLINEHUB")) {
        yield __1.prismaDB.integration.create({
            data: {
                restaurantId: outlet.id,
                name: "ONLINEHUB",
                connected: true,
                status: true,
                link: validateFields.data.subdomain,
            },
        });
        yield __1.prismaDB.site.create({
            data: {
                // @ts-ignore
                adminId: (_u = req === null || req === void 0 ? void 0 : req.user) === null || _u === void 0 ? void 0 : _u.id,
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                subdomain: validateFields.data.subdomain,
            },
        });
    }
    yield (0, outlet_1.fetchOutletByIdToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
    yield (0, get_users_1.getFormatUserAndSendToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.adminId);
    if (((_w = (_v = outlet === null || outlet === void 0 ? void 0 : outlet.users) === null || _v === void 0 ? void 0 : _v.sites) === null || _w === void 0 ? void 0 : _w.length) > 0) {
        for (const site of (_x = outlet === null || outlet === void 0 ? void 0 : outlet.users) === null || _x === void 0 ? void 0 : _x.sites) {
            yield redis_1.redis.del(`app-domain-${site === null || site === void 0 ? void 0 : site.subdomain}`);
        }
    }
    return res.json({
        success: true,
        message: "Online Hub Integrated Success",
    });
});
exports.patchOutletOnlinePOrtalDetails = patchOutletOnlinePOrtalDetails;
const updateOrCreateOperatingHours = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _y, _z, _0;
    const { outletId } = req.params;
    const validateFields = staff_1.operatingHoursSchema.safeParse(req.body);
    if (!validateFields.success) {
        throw new bad_request_1.BadRequestsException(validateFields.error.message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.restaurant.update({
        where: {
            id: outlet.id,
        },
        data: {
            openTime: validateFields.data.openTime.time,
            closeTime: validateFields.data.closeTime.time,
        },
    });
    yield redis_1.redis.del(`O-${outlet.id}`);
    if (((_z = (_y = outlet === null || outlet === void 0 ? void 0 : outlet.users) === null || _y === void 0 ? void 0 : _y.sites) === null || _z === void 0 ? void 0 : _z.length) > 0) {
        for (const site of (_0 = outlet === null || outlet === void 0 ? void 0 : outlet.users) === null || _0 === void 0 ? void 0 : _0.sites) {
            yield redis_1.redis.del(`app-domain-${site === null || site === void 0 ? void 0 : site.subdomain}`);
        }
    }
    return res.json({
        success: true,
        message: "Operating Hours Updated Successfully",
    });
});
exports.updateOrCreateOperatingHours = updateOrCreateOperatingHours;
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
    yield (0, outlet_1.fetchOutletByIdToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
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
    yield (0, outlet_1.fetchOutletByIdToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
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
    yield (0, outlet_1.fetchOutletByIdToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
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
    var _1;
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    const userId = (_1 = req === null || req === void 0 ? void 0 : req.user) === null || _1 === void 0 ? void 0 : _1.id;
    if (outlet === undefined || !outlet.id) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (outlet.adminId !== userId) {
        throw new unauthorized_1.UnauthorizedException("Your Unauthorized To delete this Outlet", root_1.ErrorCode.UNAUTHORIZED);
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
    yield (0, get_users_1.getFormatUserAndSendToRedis)(userId);
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
const formSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Restaurant Legal Name is Required"),
    outletType: zod_1.z.enum([
        "RESTAURANT",
        "HYBRIDKITCHEN",
        "EXPRESS",
        "BAKERY",
        "CAFE",
        "FOODTRUCK",
        "NONE",
    ]),
    shortName: zod_1.z.string().min(1, "Restaurant Short Name is Required"),
    address: zod_1.z.string().min(1, "Restaurant Address is Required"),
    city: zod_1.z.string().min(1, "Restaurant City is Required"),
    pincode: zod_1.z.string().min(1, "Restaurant Pincode is Required"),
    gst: zod_1.z.string().optional(),
    fssai: zod_1.z.string().optional(),
    copy: zod_1.z.boolean(),
    // copyInventory: z.boolean(),
    // copyRecipes: z.boolean(),
});
const createOutletFromOutletHub = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Validate request body (using Zod or your chosen library)
    const parsedBody = formSchema.safeParse(req.body);
    if (!parsedBody.success) {
        throw new bad_request_1.BadRequestsException(parsedBody.error.message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const { name, outletType, shortName, address, city, pincode, gst, fssai, copy: copyMenu, } = parsedBody.data;
    const firstTxResult = yield __1.prismaDB.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // STEP 0: Create the new outlet (restaurant)
        const createOutlet = yield tx.restaurant.create({
            data: {
                adminId: outlet.adminId,
                restaurantName: name,
                outletType: outletType,
                name: shortName,
                address,
                city,
                pincode,
                GSTIN: gst,
                fssai,
            },
        });
        // If copyMenu is false, we skip copying menu data.
        if (!copyMenu) {
            return {
                createOutlet,
                categoryMap: new Map(),
                variantMap: new Map(),
                addonGroupMap: new Map(),
                categories: [],
            };
        }
        // STEP 1: Fetch source outlet's categories (with menu items, variants, add-on groups)
        const categories = yield tx.category.findMany({
            where: { restaurantId: outlet.id },
            include: {
                menuItems: {
                    include: {
                        menuItemVariants: { include: { variant: true } },
                        menuGroupAddOns: {
                            include: {
                                addOnGroups: { include: { addOnVariants: true } },
                            },
                        },
                    },
                },
            },
        });
        // STEP 2: Create new categories for the new outlet and build a map.
        const categoryMap = new Map();
        for (const cat of categories) {
            const newCat = yield tx.category.create({
                data: {
                    name: cat.name,
                    slug: (0, utils_1.generateSlug)(cat.name),
                    description: cat.description,
                    restaurantId: createOutlet.id,
                },
            });
            categoryMap.set((0, utils_1.generateSlug)(cat.name), newCat);
        }
        // STEP 3: Collect unique variants across all menu items.
        const variantDataMap = new Map();
        for (const cat of categories) {
            for (const menuItem of cat.menuItems) {
                for (const miv of menuItem.menuItemVariants) {
                    const variantSlug = (0, utils_1.generateSlug)(miv.variant.name);
                    if (!variantDataMap.has(variantSlug)) {
                        variantDataMap.set(variantSlug, miv.variant);
                    }
                }
            }
        }
        // Create variants and build a variant map.
        const variantMap = new Map();
        for (const [slug, variant] of variantDataMap.entries()) {
            const newVariant = yield tx.variants.create({
                data: {
                    restaurantId: createOutlet.id,
                    name: variant.name,
                    slug,
                    variantCategory: variant.variantCategory,
                    status: variant.status,
                },
            });
            variantMap.set(slug, newVariant);
        }
        const addonGroupData = new Map();
        for (const cat of categories) {
            for (const menuItem of cat.menuItems) {
                for (const groupAddon of menuItem.menuGroupAddOns) {
                    const groupSlug = (0, utils_1.generateSlug)(groupAddon.addOnGroups.title);
                    if (!addonGroupData.has(groupSlug)) {
                        addonGroupData.set(groupSlug, {
                            title: groupAddon.addOnGroups.title,
                            description: groupAddon.addOnGroups.description || "",
                            status: groupAddon.addOnGroups.status ? "true" : "false",
                            minSelect: Number(groupAddon.addOnGroups.minSelect) || 0,
                            maxSelectString: groupAddon.addOnGroups.maxSelectString || "",
                            variants: groupAddon.addOnGroups.addOnVariants.map((variant) => ({
                                name: variant.name,
                                price: Number(variant.price),
                                type: variant.type,
                            })),
                        });
                    }
                }
            }
        }
        // Create add-on groups and their variants.
        const addonGroupMap = new Map();
        for (const [slug, groupData] of addonGroupData.entries()) {
            const newGroup = yield tx.addOns.create({
                data: {
                    restaurantId: createOutlet.id,
                    title: groupData.title,
                    slug: (0, utils_1.generateSlug)(groupData.title),
                    description: groupData.description,
                    status: groupData.status === "true" ? true : false,
                    minSelect: groupData.minSelect.toString(),
                    maxSelectString: groupData.maxSelectString,
                },
            });
            const newVariants = [];
            for (const variant of groupData.variants) {
                const newAddonVariant = yield tx.addOnVariants.create({
                    data: {
                        addonId: newGroup.id,
                        restaurantId: createOutlet.id,
                        name: variant.name,
                        slug: (0, utils_1.generateSlug)(variant.name),
                        price: variant.price.toString(),
                        type: variant.type,
                    },
                });
                newVariants.push(newAddonVariant);
            }
            addonGroupMap.set(slug, { group: newGroup, variants: newVariants });
        }
        return {
            createOutlet,
            categoryMap,
            variantMap,
            addonGroupMap,
            categories,
        };
    }));
    // If we aren't copying menu data, update cache and return.
    if (!copyMenu) {
        yield (0, get_users_1.getFormatUserAndSendToRedis)(outlet.adminId);
        return res.json({
            success: true,
            message: "Outlet Added Successfully",
        });
    }
    //
    // ---------------------------
    // SECOND TRANSACTION
    // Use the previously built maps and original categories data
    // to create menu items (and their related variants and add-on links).
    // ---------------------------
    yield __1.prismaDB.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        // Loop over each category from the source data.
        for (const cat of firstTxResult.categories) {
            const newCategory = firstTxResult.categoryMap.get((0, utils_1.generateSlug)(cat.name));
            if (!newCategory) {
                throw new Error(`New category not found for: ${cat.name}`);
            }
            // For each menu item in this category:
            for (const menuItem of cat.menuItems) {
                const newMenuItem = yield tx.menuItem.create({
                    data: {
                        restaurantId: firstTxResult.createOutlet.id,
                        categoryId: newCategory.id,
                        name: menuItem.name,
                        shortCode: menuItem.shortCode,
                        slug: (0, utils_1.generateSlug)(menuItem.name),
                        description: menuItem.description,
                        isVariants: menuItem.isVariants,
                        isAddons: menuItem.isAddons,
                        netPrice: menuItem.netPrice,
                        gst: menuItem.gst,
                        price: menuItem.price,
                        chooseProfit: menuItem.chooseProfit,
                        grossProfitType: menuItem.grossProfitType,
                        grossProfitPer: menuItem.grossProfitPer,
                        grossProfit: menuItem.grossProfit,
                        type: menuItem.type,
                        isDelivery: menuItem.isDelivery,
                        isPickUp: menuItem.isPickUp,
                        isDineIn: menuItem.isDineIn,
                        isOnline: menuItem.isOnline,
                    },
                });
                // Create menu item variants.
                for (const miv of menuItem.menuItemVariants) {
                    const variantSlug = (0, utils_1.generateSlug)(miv.variant.name);
                    const newVariant = firstTxResult.variantMap.get(variantSlug);
                    if (!newVariant) {
                        throw new Error(`Variant not found for slug: ${variantSlug}`);
                    }
                    yield tx.menuItemVariant.create({
                        data: {
                            menuItemId: newMenuItem.id,
                            restaurantId: firstTxResult.createOutlet.id,
                            variantId: newVariant.id,
                            netPrice: miv.netPrice,
                            gst: miv.gst,
                            price: miv.price,
                            chooseProfit: miv.chooseProfit,
                            grossProfitType: miv.grossProfitType,
                            grossProfitPer: miv.grossProfitPer,
                            grossProfit: miv.grossProfit,
                            foodType: miv.foodType,
                        },
                    });
                }
                // Create menu group add-on links.
                for (const groupAddon of menuItem.menuGroupAddOns) {
                    const groupSlug = (0, utils_1.generateSlug)(groupAddon.addOnGroups.title);
                    const addonGroupInfo = firstTxResult.addonGroupMap.get(groupSlug);
                    if (addonGroupInfo) {
                        yield tx.menuGroupAddOns.create({
                            data: {
                                menuItemId: newMenuItem.id,
                                addOnGroupId: addonGroupInfo.group.id,
                                minSelect: groupAddon.minSelect,
                                maxSelectString: groupAddon.maxSelectString,
                            },
                        });
                    }
                }
            }
        }
    }));
    // Update the Redis cache (outside of any transaction)
    yield (0, get_users_1.getFormatUserAndSendToRedis)(outlet.adminId);
    return res.json({
        success: true,
        message: "Outlet Added Successfully",
    });
});
exports.createOutletFromOutletHub = createOutletFromOutletHub;
const updateOutletType = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _2, _3, _4, _5;
    const { outletId } = req.params;
    const { outletType } = req.body;
    // @ts-ignore
    const userId = (_2 = req === null || req === void 0 ? void 0 : req.user) === null || _2 === void 0 ? void 0 : _2.id;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (outlet.adminId !== userId) {
        throw new unauthorized_1.UnauthorizedException("You are not authorized to update this outlet type", root_1.ErrorCode.UNAUTHORIZED);
    }
    yield __1.prismaDB.restaurant.update({
        where: { id: outlet.id },
        data: { outletType },
    });
    yield (0, outlet_1.fetchOutletByIdToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
    yield (0, get_users_1.getFormatUserAndSendToRedis)(userId);
    if (((_4 = (_3 = outlet === null || outlet === void 0 ? void 0 : outlet.users) === null || _3 === void 0 ? void 0 : _3.sites) === null || _4 === void 0 ? void 0 : _4.length) > 0) {
        for (const site of (_5 = outlet === null || outlet === void 0 ? void 0 : outlet.users) === null || _5 === void 0 ? void 0 : _5.sites) {
            yield redis_1.redis.del(`app-domain-${site === null || site === void 0 ? void 0 : site.subdomain}`);
        }
    }
    return res.json({
        success: true,
        message: "Outlet Type Updated Successfully",
    });
});
exports.updateOutletType = updateOutletType;
const updateOnlinePortalStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _6, _7, _8, _9;
    const { outletId } = req.params;
    const { status } = req.body;
    // @ts-ignore
    const userId = (_6 = req === null || req === void 0 ? void 0 : req.user) === null || _6 === void 0 ? void 0 : _6.id;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (outlet.adminId !== userId) {
        throw new unauthorized_1.UnauthorizedException("You are not authorized to update this outlet type", root_1.ErrorCode.UNAUTHORIZED);
    }
    yield __1.prismaDB.restaurant.update({
        where: { id: outlet.id },
        data: { onlinePortal: status },
    });
    yield Promise.all([
        redis_1.redis.del(`O-${outletId}`),
        (0, get_users_1.getFormatUserAndSendToRedis)(userId),
    ]);
    if (((_8 = (_7 = outlet === null || outlet === void 0 ? void 0 : outlet.users) === null || _7 === void 0 ? void 0 : _7.sites) === null || _8 === void 0 ? void 0 : _8.length) > 0) {
        for (const site of (_9 = outlet === null || outlet === void 0 ? void 0 : outlet.users) === null || _9 === void 0 ? void 0 : _9.sites) {
            yield redis_1.redis.del(`app-domain-${site === null || site === void 0 ? void 0 : site.subdomain}`);
        }
    }
    return res.json({
        success: true,
        message: "Online Portal Status Updated Successfully",
    });
});
exports.updateOnlinePortalStatus = updateOnlinePortalStatus;
