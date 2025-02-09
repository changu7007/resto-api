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
exports.checkDomain = exports.deleteSite = exports.createSubDomain = exports.getPrimeDomain = exports.getDomain = void 0;
const __1 = require("../../..");
const outlet_1 = require("../../../lib/outlet");
const redis_1 = require("../../../services/redis");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const bad_request_1 = require("../../../exceptions/bad-request");
const unauthorized_1 = require("../../../exceptions/unauthorized");
const getDomain = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { outletId } = req.params;
    const rDomains = yield redis_1.redis.get(`o-domain-${outletId}`);
    if (rDomains) {
        return res.json({
            success: true,
            domain: JSON.parse(rDomains),
            message: "Fetched Items By Redis ✅",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getDomain = yield __1.prismaDB.site.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            // @ts-ignore
            adminId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
        },
    });
    yield redis_1.redis.set(`o-domain-${outletId}`, JSON.stringify(getDomain));
    return res.json({
        success: true,
        domain: getDomain,
        message: "Fetched Items by database ✅",
    });
});
exports.getDomain = getDomain;
const getPrimeDomain = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { subdomain } = req.params;
    const site = yield redis_1.redis.get(`app-domain-${subdomain}`);
    if (site) {
        return res.json({
            success: true,
            message: "Boosted",
            site: JSON.parse(site),
        });
    }
    const getSite = yield __1.prismaDB.site.findUnique({
        where: {
            subdomain: subdomain,
        },
        include: { user: true, restaurant: true },
    });
    if (getSite === null || getSite === void 0 ? void 0 : getSite.id) {
        yield redis_1.redis.set(`app-domain-${getSite === null || getSite === void 0 ? void 0 : getSite.subdomain}`, JSON.stringify(getSite));
    }
    return res.json({
        success: true,
        site: getSite,
    });
});
exports.getPrimeDomain = getPrimeDomain;
const createSubDomain = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c;
    const { outletId } = req.params;
    const { subdomain } = req.body;
    if (!subdomain) {
        throw new bad_request_1.BadRequestsException("Subdomain is required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (outlet === undefined || !outlet.id) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.site.create({
        data: {
            // @ts-ignore
            adminId: (_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            subdomain: subdomain,
        },
    });
    const getDomain = yield __1.prismaDB.site.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            // @ts-ignore
            adminId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.id,
        },
    });
    if (getDomain === null || getDomain === void 0 ? void 0 : getDomain.id) {
        yield redis_1.redis.set(`o-domain-${outletId}`, JSON.stringify(getDomain));
    }
    return res.json({
        success: true,
        message: "SubDomain Created Successfully",
    });
});
exports.createSubDomain = createSubDomain;
const deleteSite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    const { outletId, siteId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    const userId = (_d = req === null || req === void 0 ? void 0 : req.user) === null || _d === void 0 ? void 0 : _d.id;
    if (outlet === undefined || !outlet.id) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (outlet.adminId !== userId) {
        throw new unauthorized_1.UnauthorizedException("Your Unauthorized To delete this Settings", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findDomain = yield __1.prismaDB.site.findFirst({
        where: {
            id: siteId,
        },
    });
    if (!(findDomain === null || findDomain === void 0 ? void 0 : findDomain.id)) {
        throw new bad_request_1.BadRequestsException("Domain settings not Found", root_1.ErrorCode.UNAUTHORIZED);
    }
    yield __1.prismaDB.site.delete({
        where: {
            id: findDomain === null || findDomain === void 0 ? void 0 : findDomain.id,
            restaurantId: outletId,
            adminId: userId,
        },
    });
    yield redis_1.redis.del(`app-domain-${findDomain === null || findDomain === void 0 ? void 0 : findDomain.subdomain}`);
    yield redis_1.redis.del(`o-domain-${outletId}`);
    return res.json({
        success: true,
        message: "Domain Settings Deleted Success",
    });
});
exports.deleteSite = deleteSite;
const checkDomain = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { subdomain } = req.query;
    if (subdomain === undefined || subdomain === "") {
        return res.json({ success: false, message: "Subdomain is required" });
    }
    if (subdomain.match(/[^a-zA-Z0-9-]/)) {
        return res.json({
            success: false,
            message: "Subdomain cannot contain spaces, dashes, or underscores",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (outlet === undefined || !outlet.id) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const site = yield __1.prismaDB.site.findFirst({
        where: {
            subdomain: subdomain,
        },
    });
    if (site === null || site === void 0 ? void 0 : site.id) {
        return res.json({
            success: false,
            message: "This subdomain is already taken",
        });
    }
    return res.json({
        success: true,
        message: "Domain is available",
    });
});
exports.checkDomain = checkDomain;
