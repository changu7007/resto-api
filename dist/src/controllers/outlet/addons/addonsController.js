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
const utils_1 = require("../../../lib/utils");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
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
const formSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, { message: "AddOn Group Name required" }),
    description: zod_1.z.string().optional(),
    minSelect: zod_1.z.coerce.number().optional().default(0),
    maxSelect: zod_1.z.coerce.number().optional().default(0),
    addOnVariants: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        name: zod_1.z.string().min(1, { message: "addon name required" }),
        netPrice: zod_1.z.string().min(1, { message: "net price required" }),
        price: zod_1.z.string().min(1, { message: "price required" }),
        gst: zod_1.z.coerce.number({ required_error: "GST required" }).min(0, {
            message: "GST required",
        }),
        gstType: zod_1.z.nativeEnum(client_1.GstType, {
            required_error: "GST Type required",
        }),
        chooseProfit: zod_1.z
            .enum(["manualProfit", "itemRecipe"])
            .optional()
            .default("manualProfit"), // Default to "manualProfit",
        grossProfit: zod_1.z.coerce.number().optional().default(0),
        grossProfitType: zod_1.z.enum(["INR", "PER"]).optional().default("INR"), // Default to "INR"
        grossProfitPer: zod_1.z.string().optional(),
        type: zod_1.z.string().min(1),
        recipeId: zod_1.z.string().optional(),
    }))
        .min(1, { message: "Atleast 1 AddOn Variant is Required" }),
});
const createAddOn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { data, error } = formSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const slug = (0, utils_1.generateSlug)(data.title);
    const findSlug = yield __1.prismaDB.addOns.findFirst({
        where: {
            slug,
        },
    });
    if (findSlug) {
        throw new bad_request_1.BadRequestsException("AddOn Group Name already exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.addOns.create({
        data: {
            title: data.title,
            slug,
            description: data.description,
            minSelect: data.minSelect,
            maxSelect: data.maxSelect,
            addOnVariants: {
                create: data.addOnVariants.map((addOn) => ({
                    name: addOn.name,
                    slug: (0, utils_1.generateSlug)(addOn.name),
                    price: addOn.price,
                    type: addOn.type,
                    restaurantId: outlet.id,
                    gst: addOn.gst,
                    gstType: addOn.gstType,
                    chooseProfit: addOn.chooseProfit,
                    grossProfit: addOn.grossProfit,
                    grossProfitType: addOn.grossProfitType,
                    grossProfitPer: (addOn === null || addOn === void 0 ? void 0 : addOn.grossProfitType) === "PER" ? addOn.grossProfitPer : null,
                    itemRecipeId: (addOn === null || addOn === void 0 ? void 0 : addOn.chooseProfit) === "itemRecipe" ? addOn.recipeId : null,
                    netPrice: addOn.netPrice,
                })),
            },
            restaurantId: outlet.id,
        },
    });
    yield redis_1.redis.del(`o-${outletId}-addons`);
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
    const { data, error } = formSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!data.addOnVariants.length) {
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
    const updates = data.addOnVariants.map((variant) => {
        const existingVariant = existingVariants.find((ev) => ev.id === variant.id);
        if (existingVariant) {
            // Update existing variant
            return __1.prismaDB.addOnVariants.update({
                where: { id: existingVariant.id },
                data: {
                    name: variant.name,
                    netPrice: variant.netPrice,
                    price: variant.price,
                    type: variant.type,
                    gst: variant.gst,
                    gstType: variant.gstType,
                    chooseProfit: variant.chooseProfit,
                    grossProfit: variant.grossProfit,
                    grossProfitType: variant.grossProfitType,
                    grossProfitPer: (variant === null || variant === void 0 ? void 0 : variant.grossProfitType) === "PER" ? variant.grossProfitPer : null,
                    itemRecipeId: variant.chooseProfit === "itemRecipe" ? variant.recipeId : null,
                },
            });
        }
        else {
            // Create new variant
            return __1.prismaDB.addOnVariants.create({
                data: {
                    restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                    name: variant.name,
                    slug: (0, utils_1.generateSlug)(variant.name),
                    price: variant.price,
                    type: variant.type,
                    addonId: addOn.id,
                    gst: variant.gst,
                    gstType: variant.gstType,
                    chooseProfit: variant.chooseProfit,
                    grossProfit: variant.grossProfit,
                    grossProfitType: variant.grossProfitType,
                    grossProfitPer: (variant === null || variant === void 0 ? void 0 : variant.grossProfitType) === "PER" ? variant.grossProfitPer : null,
                    itemRecipeId: variant.chooseProfit === "itemRecipe" ? variant.recipeId : null,
                    netPrice: variant.netPrice,
                },
            });
        }
    });
    // Identify variants to delete
    const variantIdsToKeep = data.addOnVariants
        .map((v) => v.id)
        .filter(Boolean);
    const variantsToDelete = existingVariants.filter((ev) => !variantIdsToKeep.includes(ev.id));
    // Perform the update
    yield __1.prismaDB.$transaction([
        // Update AddOn
        __1.prismaDB.addOns.update({
            where: { id: addOn.id },
            data: { title: data.title, description: data.description },
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
    yield redis_1.redis.del(`o-${outletId}-addons`);
    return res.json({
        success: true,
        message: " Addon Updated ",
    });
});
exports.updateAddon = updateAddon;
