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
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getAllDomainCategories = exports.getAllCategories = exports.getCategories = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const bad_request_1 = require("../../../exceptions/bad-request");
const redis_1 = require("../../../services/redis");
const get_items_1 = require("../../../lib/outlet/get-items");
const utils_1 = require("../../../lib/utils");
const getCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const categories = yield redis_1.redis.get(`${outletId}-categories`);
    if (categories) {
        return res.json({
            success: true,
            categories: JSON.parse(categories),
            message: "POWEREDUP ⚡",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getCategories = yield (0, get_items_1.getOAllCategoriesToRedis)(outlet.id);
    return res.json({
        success: true,
        categories: getCategories,
        message: "POWERINGUP.. ✅",
    });
});
exports.getCategories = getCategories;
const getAllCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const categories = yield redis_1.redis.get(`o-${outletId}-categories`);
    if (categories) {
        return res.json({
            success: true,
            categories: JSON.parse(categories),
            message: "POWEREDUP ⚡",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getCategories = yield (0, get_items_1.getOAllMenuCategoriesToRedis)(outlet.id);
    return res.json({
        success: true,
        categories: getCategories,
        message: "POWERINGUP.. ✅",
    });
});
exports.getAllCategories = getAllCategories;
const getAllDomainCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const categories = yield redis_1.redis.get(`o-d-${outletId}-categories`);
    if (categories) {
        return res.json({
            success: true,
            categories: JSON.parse(categories),
            message: "POWEREDUP ⚡",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getCategories = yield (0, get_items_1.getOAllMenuCategoriesForOnlineAndDeliveryToRedis)(outlet.id);
    return res.json({
        success: true,
        categories: getCategories,
        message: "POWERINGUP.. ✅",
    });
});
exports.getAllDomainCategories = getAllDomainCategories;
const createCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const { name, printLocationId } = req.body;
    const slug = (0, utils_1.generateSlug)(name);
    if (!name) {
        throw new bad_request_1.BadRequestsException("Name Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (printLocationId !== undefined || printLocationId !== null) {
        const findPrintLocation = yield __1.prismaDB.printLocation.findFirst({
            where: {
                id: printLocationId,
            },
        });
        if (!findPrintLocation) {
            throw new not_found_1.NotFoundException("The selected Print Location is not available", root_1.ErrorCode.NOT_FOUND);
        }
    }
    const checkSlug = yield __1.prismaDB.category.findFirst({
        where: {
            restaurantId: outlet.id,
            slug,
        },
    });
    if (checkSlug) {
        throw new bad_request_1.BadRequestsException("Category already exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.category.create({
        data: {
            name,
            slug,
            restaurantId: outlet.id,
            printLocationId: printLocationId,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`o-${outlet.id}-categories`),
        redis_1.redis.del(`${outlet.id}-categories`),
        redis_1.redis.del(`o-d-${outletId}-categories`),
    ]);
    return res.json({
        success: true,
        message: "Category Created ",
    });
});
exports.createCategory = createCategory;
const updateCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, categoryId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const { name, printLocationId } = req.body;
    const slug = (0, utils_1.generateSlug)(name);
    if (!name) {
        throw new bad_request_1.BadRequestsException("Name Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const category = yield (0, outlet_1.getCategoryByOutletId)(outlet.id, categoryId);
    const checkSlug = yield __1.prismaDB.category.findFirst({
        where: {
            NOT: {
                id: category === null || category === void 0 ? void 0 : category.id,
            },
            restaurantId: outlet.id,
            slug,
        },
    });
    if (checkSlug) {
        throw new bad_request_1.BadRequestsException("Category Name already exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (printLocationId !== undefined || printLocationId !== null) {
        const findPrintLocation = yield __1.prismaDB.printLocation.findFirst({
            where: {
                id: printLocationId,
            },
        });
        if (!findPrintLocation) {
            throw new not_found_1.NotFoundException("The selected Print Location is not available", root_1.ErrorCode.NOT_FOUND);
        }
    }
    yield __1.prismaDB.category.update({
        where: {
            restaurantId: outlet.id,
            id: category === null || category === void 0 ? void 0 : category.id,
        },
        data: {
            name,
            slug,
            printLocationId,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`o-${outlet.id}-categories`),
        redis_1.redis.del(`${outlet.id}-categories`),
        redis_1.redis.del(`o-d-${outletId}-categories`),
    ]);
    return res.json({
        success: true,
        message: "Category Updated ",
    });
});
exports.updateCategory = updateCategory;
const deleteCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, categoryId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const category = yield (0, outlet_1.getCategoryByOutletId)(outlet.id, categoryId);
    if (!(category === null || category === void 0 ? void 0 : category.id)) {
        throw new not_found_1.NotFoundException("Category Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.category.delete({
        where: {
            restaurantId: outlet.id,
            id: category === null || category === void 0 ? void 0 : category.id,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`o-${outlet.id}-categories`),
        redis_1.redis.del(`o-d-${outletId}-categories`),
        redis_1.redis.del(`${outlet.id}-categories`),
    ]);
    return res.json({
        success: true,
        message: "Category Deleted ",
    });
});
exports.deleteCategory = deleteCategory;
