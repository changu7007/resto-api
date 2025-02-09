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
exports.updateVariant = exports.deleteVariant = exports.createVariant = exports.getVariants = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const bad_request_1 = require("../../../exceptions/bad-request");
const utils_1 = require("../../../lib/utils");
const getVariants = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const variant = yield __1.prismaDB.variants.findMany({
        where: {
            restaurantId: outlet.id,
        },
    });
    return res.json({
        success: true,
        variants: variant,
    });
});
exports.getVariants = getVariants;
const createVariant = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { name, variantCategory } = req.body;
    if (!name) {
        throw new bad_request_1.BadRequestsException("Variant Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!variantCategory) {
        throw new bad_request_1.BadRequestsException("Variant Category is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.variants.create({
        data: {
            name,
            slug: (0, utils_1.generateSlug)(name),
            variantCategory,
            restaurantId: outlet.id,
        },
    });
    return res.json({
        success: true,
        message: " Variant Created ",
    });
});
exports.createVariant = createVariant;
const deleteVariant = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, variantId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const variant = yield (0, outlet_1.getVariantByOutletId)(outlet.id, variantId);
    if (!(variant === null || variant === void 0 ? void 0 : variant.id)) {
        throw new not_found_1.NotFoundException("Variant Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.variants.deleteMany({
        where: {
            restaurantId: outlet.id,
            id: variantId,
        },
    });
    return res.json({
        success: true,
        message: " Variant Deleted ",
    });
});
exports.deleteVariant = deleteVariant;
const updateVariant = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, variantId } = req.params;
    const { name, variantCategory } = req.body;
    if (!name) {
        throw new bad_request_1.BadRequestsException("Variant Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!variantCategory) {
        throw new bad_request_1.BadRequestsException("Variant Category is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const variant = yield (0, outlet_1.getVariantByOutletId)(outlet.id, variantId);
    if (!(variant === null || variant === void 0 ? void 0 : variant.id)) {
        throw new not_found_1.NotFoundException("Variant Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.variants.update({
        where: {
            restaurantId: outlet.id,
            id: variantId,
        },
        data: {
            name,
            variantCategory,
        },
    });
    return res.json({
        success: true,
        message: " Variant Updated ",
    });
});
exports.updateVariant = updateVariant;
