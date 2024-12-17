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
exports.updateAddon = exports.deleteAddon = exports.createAddOn = exports.getAddon = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const __1 = require("../../..");
const root_1 = require("../../../exceptions/root");
const bad_request_1 = require("../../../exceptions/bad-request");
const redis_1 = require("../../../services/redis");
const getAddon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const addOns = yield redis_1.redis.get(`o-${outletId}-addons`);
    if (addOns) {
        return res.json({
            success: true,
            addons: JSON.parse(addOns),
            message: "SUCKED",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const addOn = yield __1.prismaDB.addOns.findMany({
        where: {
            restaurantId: outlet.id,
        },
    });
    yield redis_1.redis.set(`o-${outletId}-addons`, JSON.stringify(addOn));
    return res.json({
        success: true,
        addons: addOn,
    });
});
exports.getAddon = getAddon;
const createAddOn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { title, description, addOnVariants } = req.body;
    if (!title) {
        throw new bad_request_1.BadRequestsException("Addon Title is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!addOnVariants.length) {
        throw new bad_request_1.BadRequestsException("Atleast 1 AddOn Variants is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.addOns.create({
        data: {
            title,
            description,
            addOnVariants: {
                create: addOnVariants.map((addOn) => ({
                    name: addOn.name,
                    price: addOn.price,
                    type: addOn.type,
                })),
            },
            restaurantId: outlet.id,
        },
    });
    const addOn = yield __1.prismaDB.addOns.findMany({
        where: {
            restaurantId: outlet.id,
        },
    });
    yield redis_1.redis.set(`o-${outletId}-addons`, JSON.stringify(addOn));
    return res.json({
        success: true,
        message: " AddOn Created ",
    });
});
exports.createAddOn = createAddOn;
const deleteAddon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, addOnId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const addOn = yield (0, outlet_1.getAddOnByOutletId)(outlet.id, addOnId);
    if (!(addOn === null || addOn === void 0 ? void 0 : addOn.id)) {
        throw new not_found_1.NotFoundException("Variant Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.addOns.deleteMany({
        where: {
            restaurantId: outlet.id,
            id: addOn.id,
        },
    });
    const addOns = yield __1.prismaDB.addOns.findMany({
        where: {
            restaurantId: outlet.id,
        },
    });
    yield redis_1.redis.set(`o-${outletId}-addons`, JSON.stringify(addOns));
    return res.json({
        success: true,
        message: " AddOn Deleted ",
    });
});
exports.deleteAddon = deleteAddon;
const updateAddon = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, addOnId } = req.params;
    const { title, description, addOnVariants } = req.body;
    if (!title) {
        throw new bad_request_1.BadRequestsException("Addon Title is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!addOnVariants.length) {
        throw new bad_request_1.BadRequestsException("Atleast 1 AddOn Variants is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const addOn = yield (0, outlet_1.getAddOnByOutletId)(outlet.id, addOnId);
    if (!(addOn === null || addOn === void 0 ? void 0 : addOn.id)) {
        throw new not_found_1.NotFoundException("Variant Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const existingVariants = addOn.addOnVariants;
    const updates = addOnVariants.map((variant) => {
        const existingVariant = existingVariants.find((ev) => ev.id === variant.id);
        if (existingVariant) {
            // Update existing variant
            return __1.prismaDB.addOnVariants.update({
                where: { id: existingVariant.id },
                data: {
                    name: variant.name,
                    price: variant.price,
                    type: variant.type,
                },
            });
        }
        else {
            // Create new variant
            return __1.prismaDB.addOnVariants.create({
                data: {
                    restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                    name: variant.name,
                    price: variant.price,
                    type: variant.type,
                    addonId: addOn.id,
                },
            });
        }
    });
    // Identify variants to delete
    const variantIdsToKeep = addOnVariants.map((v) => v.id).filter(Boolean);
    const variantsToDelete = existingVariants.filter((ev) => !variantIdsToKeep.includes(ev.id));
    // Perform the update
    yield __1.prismaDB.$transaction([
        // Update AddOn
        __1.prismaDB.addOns.update({
            where: { id: addOn.id },
            data: { title, description },
        }),
        // Update or create variants
        ...updates,
        // Delete removed variants
        __1.prismaDB.addOnVariants.deleteMany({
            where: {
                id: { in: variantsToDelete.map((v) => v.id) },
            },
        }),
    ]);
    const addOns = yield __1.prismaDB.addOns.findMany({
        where: {
            restaurantId: outlet.id,
        },
    });
    yield redis_1.redis.set(`o-${outletId}-addons`, JSON.stringify(addOns));
    return res.json({
        success: true,
        message: " Addon Updated ",
    });
});
exports.updateAddon = updateAddon;
