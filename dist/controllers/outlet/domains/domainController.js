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
exports.linkFranchiseDomain = exports.verifyFranchiseCode = exports.checkDomain = exports.unlinkDomainForRestaurant = exports.deleteSite = exports.createSubDomain = exports.getPrimeDomain = exports.getDomain = void 0;
const __1 = require("../../..");
const outlet_1 = require("../../../lib/outlet");
const redis_1 = require("../../../services/redis");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const bad_request_1 = require("../../../exceptions/bad-request");
const unauthorized_1 = require("../../../exceptions/unauthorized");
const orderOutletController_1 = require("../order/orderOutletController");
const getDomain = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            restaurants: {
                some: {
                    id: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                },
            },
        },
    });
    if ((getDomain === null || getDomain === void 0 ? void 0 : getDomain.code) === null) {
        yield __1.prismaDB.site.update({
            where: {
                id: getDomain === null || getDomain === void 0 ? void 0 : getDomain.id,
            },
            data: { code: (0, orderOutletController_1.inviteCode)() },
        });
    }
    yield redis_1.redis.set(`o-domain-${outletId}`, JSON.stringify(Object.assign(Object.assign({}, getDomain), { franchiseModel: outlet === null || outlet === void 0 ? void 0 : outlet.franchiseModel })), "EX", 60 * 60 // 1 hour
    );
    return res.json({
        success: true,
        domain: Object.assign(Object.assign({}, getDomain), { franchiseModel: outlet === null || outlet === void 0 ? void 0 : outlet.franchiseModel }),
        message: "Fetched Items by database ✅",
    });
});
exports.getDomain = getDomain;
const getPrimeDomain = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
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
        select: {
            id: true,
            subdomain: true,
            customDomain: true,
            restaurants: {
                select: {
                    id: true,
                    name: true,
                    legalName: true,
                    phoneNo: true,
                    address: true,
                    pincode: true,
                    city: true,
                    outletType: true,
                    email: true,
                    restaurantName: true,
                    imageUrl: true,
                    siteId: true,
                    areaLat: true,
                    onlinePortal: true,
                    areaLong: true,
                    orderRadius: true,
                    openTime: true,
                    closeTime: true,
                    isDineIn: true,
                    isDelivery: true,
                    isPickUp: true,
                    fssai: true,
                    deliveryFee: true,
                    googlePlaceId: true,
                    description: true,
                    packagingFee: true,
                    integrations: {
                        select: {
                            name: true,
                            status: true,
                            connected: true,
                        },
                    },
                },
            },
        },
    });
    const formattedSite = Object.assign({ name: (_a = getSite === null || getSite === void 0 ? void 0 : getSite.restaurants[0]) === null || _a === void 0 ? void 0 : _a.name, restaurantName: (_b = getSite === null || getSite === void 0 ? void 0 : getSite.restaurants[0]) === null || _b === void 0 ? void 0 : _b.restaurantName, phoneNo: (_c = getSite === null || getSite === void 0 ? void 0 : getSite.restaurants[0]) === null || _c === void 0 ? void 0 : _c.phoneNo, legalName: (_d = getSite === null || getSite === void 0 ? void 0 : getSite.restaurants[0]) === null || _d === void 0 ? void 0 : _d.legalName, imageUrl: (_e = getSite === null || getSite === void 0 ? void 0 : getSite.restaurants[0]) === null || _e === void 0 ? void 0 : _e.imageUrl, outletType: (_f = getSite === null || getSite === void 0 ? void 0 : getSite.restaurants[0]) === null || _f === void 0 ? void 0 : _f.outletType }, getSite);
    if (getSite === null || getSite === void 0 ? void 0 : getSite.id) {
        yield redis_1.redis.set(`app-domain-${getSite === null || getSite === void 0 ? void 0 : getSite.subdomain}`, JSON.stringify(formattedSite), "EX", 60 * 60 // 1 hour
        );
    }
    return res.json({
        success: true,
        site: formattedSite,
    });
});
exports.getPrimeDomain = getPrimeDomain;
const createSubDomain = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _g;
    const { outletId } = req.params;
    const { subdomain } = req.body;
    if (!subdomain) {
        throw new bad_request_1.BadRequestsException("Subdomain is required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (outlet === undefined || !outlet.id) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const findSubDomain = yield __1.prismaDB.site.findFirst({
        where: {
            subdomain: subdomain,
        },
    });
    if (findSubDomain === null || findSubDomain === void 0 ? void 0 : findSubDomain.id) {
        throw new bad_request_1.BadRequestsException("Subdomain already exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (subdomain.match(/[^a-zA-Z0-9-]/)) {
        throw new bad_request_1.BadRequestsException("Subdomain cannot contain spaces, dashes, or underscores", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (subdomain.length < 3) {
        throw new bad_request_1.BadRequestsException("Subdomain must be at least 3 characters long", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (subdomain.length > 30) {
        throw new bad_request_1.BadRequestsException("Subdomain must be less than 30 characters long", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (subdomain.startsWith("-") || subdomain.endsWith("-")) {
        throw new bad_request_1.BadRequestsException("Subdomain cannot start or end with a dash", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (subdomain.includes(" ")) {
        throw new bad_request_1.BadRequestsException("Subdomain cannot contain spaces", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (subdomain.includes("..")) {
        throw new bad_request_1.BadRequestsException("Subdomain cannot contain multiple dots", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const restaurantHasDomain = yield __1.prismaDB.site.findFirst({
        where: {
            restaurants: {
                some: {
                    id: outletId,
                },
            },
        },
    });
    if (restaurantHasDomain === null || restaurantHasDomain === void 0 ? void 0 : restaurantHasDomain.id) {
        throw new bad_request_1.BadRequestsException("Restaurant already has a domain", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getDomain = yield __1.prismaDB.site.create({
        data: {
            // @ts-ignore
            adminId: (_g = req === null || req === void 0 ? void 0 : req.user) === null || _g === void 0 ? void 0 : _g.id,
            subdomain: subdomain,
            code: (0, orderOutletController_1.inviteCode)(),
            restaurants: {
                connect: {
                    id: outletId,
                },
            },
        },
    });
    yield __1.prismaDB.restaurant.update({
        where: {
            id: outletId,
        },
        data: {
            siteId: getDomain === null || getDomain === void 0 ? void 0 : getDomain.id,
            franchiseModel: "MASTER",
        },
    });
    yield Promise.all([
        redis_1.redis.del(`O-${outlet === null || outlet === void 0 ? void 0 : outlet.id}`),
        redis_1.redis.del(`app-domain-${getDomain === null || getDomain === void 0 ? void 0 : getDomain.subdomain}`),
        redis_1.redis.del(`o-domain-${outletId}`),
    ]);
    return res.json({
        success: true,
        id: getDomain === null || getDomain === void 0 ? void 0 : getDomain.id,
        subdomain: getDomain === null || getDomain === void 0 ? void 0 : getDomain.subdomain,
        message: "SubDomain Created Successfully",
    });
});
exports.createSubDomain = createSubDomain;
const deleteSite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _h;
    const { outletId, siteId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    const userId = (_h = req === null || req === void 0 ? void 0 : req.user) === null || _h === void 0 ? void 0 : _h.id;
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
            adminId: userId,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`O-${outlet === null || outlet === void 0 ? void 0 : outlet.id}`),
        redis_1.redis.del(`app-domain-${findDomain === null || findDomain === void 0 ? void 0 : findDomain.subdomain}`),
        redis_1.redis.del(`o-domain-${outletId}`),
    ]);
    return res.json({
        success: true,
        message: "Domain Settings Deleted Success",
    });
});
exports.deleteSite = deleteSite;
const unlinkDomainForRestaurant = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _j;
    const { outletId, siteId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    const userId = (_j = req === null || req === void 0 ? void 0 : req.user) === null || _j === void 0 ? void 0 : _j.id;
    if (outlet === undefined || !outlet.id) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const findDomain = yield __1.prismaDB.site.findFirst({
        where: {
            id: siteId,
            restaurants: {
                some: {
                    id: outletId,
                },
            },
        },
    });
    if (!(findDomain === null || findDomain === void 0 ? void 0 : findDomain.id)) {
        throw new bad_request_1.BadRequestsException("Franchise Domain not Found", root_1.ErrorCode.UNAUTHORIZED);
    }
    if ((findDomain === null || findDomain === void 0 ? void 0 : findDomain.adminId) === userId) {
        throw new unauthorized_1.UnauthorizedException("Your Unauthorized To Unlink this Domain, this feature is only available for Franchise Domain", root_1.ErrorCode.UNAUTHORIZED);
    }
    yield __1.prismaDB.site.update({
        where: {
            id: findDomain === null || findDomain === void 0 ? void 0 : findDomain.id,
            restaurants: {
                some: {
                    id: outletId,
                },
            },
        },
        data: {
            restaurants: {
                disconnect: {
                    id: outletId,
                },
            },
        },
    });
    yield __1.prismaDB.restaurant.update({
        where: {
            id: outletId,
        },
        data: {
            siteId: null,
            franchiseModel: "MASTER",
        },
    });
    yield Promise.all([
        redis_1.redis.del(`O-${outlet === null || outlet === void 0 ? void 0 : outlet.id}`),
        redis_1.redis.del(`app-domain-${findDomain === null || findDomain === void 0 ? void 0 : findDomain.subdomain}`),
        redis_1.redis.del(`o-domain-${outletId}`),
    ]);
    return res.json({
        success: true,
        message: "Domain Unlinked Successfully",
    });
});
exports.unlinkDomainForRestaurant = unlinkDomainForRestaurant;
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
const verifyFranchiseCode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { code, franchiseModel } = req.body;
    if (!code || !franchiseModel) {
        throw new bad_request_1.BadRequestsException("Code and Franchise Model are required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (franchiseModel === "MASTER") {
        throw new bad_request_1.BadRequestsException("Master Cannot be linked for Franchise Domain", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const findMaster = yield __1.prismaDB.site.findFirst({
        where: {
            code: code,
        },
    });
    if (!(findMaster === null || findMaster === void 0 ? void 0 : findMaster.id)) {
        throw new bad_request_1.BadRequestsException("Invalid Franchise Code", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    console.log(findMaster);
    // await prismaDB.site.update({
    //   where: {
    //     id: findMaster?.id,
    //   },
    //   data: {
    //     restaurants: {
    //       connect: {
    //         id: outletId,
    //       },
    //     },
    //   },
    // });
    // await redis.del(`app-domain-${findMaster?.subdomain}`);
    // await redis.del(`o-domain-${outletId}`);
    return res.json({
        success: true,
        message: "Franchise Domain Fetched",
        data: {
            id: findMaster === null || findMaster === void 0 ? void 0 : findMaster.id,
            subDomain: findMaster === null || findMaster === void 0 ? void 0 : findMaster.subdomain,
        },
    });
});
exports.verifyFranchiseCode = verifyFranchiseCode;
const linkFranchiseDomain = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { siteId, franchiseModel } = req.body;
    if (!siteId || !franchiseModel) {
        throw new bad_request_1.BadRequestsException("Verify Franchise Code and try again ", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (franchiseModel === "MASTER") {
        throw new bad_request_1.BadRequestsException("Master Cannot be linked for Franchise Domain", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const findMaster = yield __1.prismaDB.site.findFirst({
        where: {
            id: siteId,
        },
    });
    if (!(findMaster === null || findMaster === void 0 ? void 0 : findMaster.id)) {
        throw new bad_request_1.BadRequestsException("Franchise Domain Not Found", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.site.update({
        where: {
            id: findMaster === null || findMaster === void 0 ? void 0 : findMaster.id,
        },
        data: {
            restaurants: {
                connect: {
                    id: outletId,
                },
            },
        },
    });
    yield __1.prismaDB.restaurant.update({
        where: {
            id: outletId,
        },
        data: {
            siteId: findMaster === null || findMaster === void 0 ? void 0 : findMaster.id,
            franchiseModel: franchiseModel,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`O-${outlet === null || outlet === void 0 ? void 0 : outlet.id}`),
        redis_1.redis.del(`app-domain-${findMaster === null || findMaster === void 0 ? void 0 : findMaster.subdomain}`),
        redis_1.redis.del(`o-domain-${outletId}`),
    ]);
    return res.json({
        success: true,
        message: "Franchise Domain Linked Successfully",
    });
});
exports.linkFranchiseDomain = linkFranchiseDomain;
