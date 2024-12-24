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
exports.getSingleAddons = exports.addItemToUserFav = exports.getMenuVariants = exports.getShortCodeStatus = exports.deleteItem = exports.postItem = exports.updateItembyId = exports.getAddONById = exports.getVariantById = exports.getItemById = exports.getAllItem = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const client_1 = require("@prisma/client");
const bad_request_1 = require("../../../exceptions/bad-request");
const redis_1 = require("../../../services/redis");
const get_items_1 = require("../../../lib/outlet/get-items");
const zod_1 = require("zod");
const get_users_1 = require("../../../lib/get-users");
const getAllItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const allItems = yield redis_1.redis.get(`${outletId}-all-items`);
    if (allItems) {
        return res.json({
            success: true,
            items: JSON.parse(allItems),
            message: "Fetched Items By Redis ✅",
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const items = yield (0, get_items_1.getOAllItems)(outlet.id);
    return res.json({
        success: true,
        items: items,
        message: "Fetched Items by database ✅",
    });
});
exports.getAllItem = getAllItem;
const getItemById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { itemId, outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const menuItem = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(menuItem === null || menuItem === void 0 ? void 0 : menuItem.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    return res.json({
        success: true,
        item: menuItem,
        message: "Fetched Item Success ✅",
    });
});
exports.getItemById = getItemById;
const getVariantById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { variantId, outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const variant = yield (0, outlet_1.getVariantByOutletId)(outlet.id, variantId);
    if (!(variant === null || variant === void 0 ? void 0 : variant.id)) {
        throw new not_found_1.NotFoundException("Variant Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    return res.json({
        success: true,
        item: variant,
        message: "Fetched Variant Success ✅",
    });
});
exports.getVariantById = getVariantById;
const getAddONById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { addOnId, outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const addOn = yield (0, outlet_1.getAddOnByOutletId)(outlet.id, addOnId);
    if (!(addOn === null || addOn === void 0 ? void 0 : addOn.id)) {
        throw new not_found_1.NotFoundException("Variant Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    return res.json({
        success: true,
        item: addOn,
        message: "Fetched Variant Success ✅",
    });
});
exports.getAddONById = getAddONById;
const menuSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    shortCode: zod_1.z.string().optional(),
    description: zod_1.z.string().min(1),
    images: zod_1.z.object({ url: zod_1.z.string() }).array(),
    price: zod_1.z.string().optional(),
    netPrice: zod_1.z.string().optional(),
    gst: zod_1.z.coerce.number().optional(),
    chooseProfit: zod_1.z
        .enum(["manualProfit", "itemRecipe"], {
        required_error: "You need to select a gross profit type.",
    })
        .optional(),
    grossProfit: zod_1.z.coerce.number().optional(),
    grossProfitType: zod_1.z
        .enum(["INR", "PER"], {
        required_error: "You need to select a gross profit type.",
    })
        .optional(),
    grossProfitPer: zod_1.z.string().optional(),
    type: zod_1.z.enum(["VEG", "NONVEG", "EGG", "SOFTDRINKS", "ALCOHOL", "NONALCOHOLIC", "MILK"], {
        required_error: "You need to select a food type.",
    }),
    menuItemVariants: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        variantId: zod_1.z.string(),
        price: zod_1.z.string(),
        netPrice: zod_1.z.string(),
        gst: zod_1.z.coerce.number().min(0, { message: "Gst Required" }),
        chooseProfit: zod_1.z.enum(["manualProfit", "itemRecipe"], {
            required_error: "You need to select a gross profit type.",
        }),
        grossProfit: zod_1.z.coerce.number().optional(),
        grossProfitType: zod_1.z.enum(["INR", "PER"], {
            required_error: "You need to select a gross profit type.",
        }),
        grossProfitPer: zod_1.z.string().optional(),
        foodType: zod_1.z.enum([
            "VEG",
            "NONVEG",
            "EGG",
            "SOFTDRINKS",
            "ALCOHOL",
            "NONALCOHOLIC",
            "MILK",
        ], {
            required_error: "You need to select a food type.",
        }),
    })),
    menuGroupAddOns: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        addOnGroupId: zod_1.z.string(),
    })),
    isVariants: zod_1.z.boolean().default(false),
    isAddons: zod_1.z.boolean().default(false),
    categoryId: zod_1.z.string().min(1),
    isDelivery: zod_1.z.boolean().optional(),
    isPickUp: zod_1.z.boolean().optional(),
    isDineIn: zod_1.z.boolean().optional(),
    isOnline: zod_1.z.boolean().optional(),
});
const updateItembyId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { itemId, outletId } = req.params;
    const validateFields = menuSchema.parse(req.body);
    const validFoodTypes = Object.values(client_1.FoodRole);
    if (!validateFields.name) {
        throw new bad_request_1.BadRequestsException("Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (validateFields.isVariants === false) {
        if (!validateFields.price) {
            throw new bad_request_1.BadRequestsException("Price is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    else {
        if (!validateFields.menuItemVariants ||
            !validateFields.menuItemVariants.length)
            throw new bad_request_1.BadRequestsException("Variants is Required if this food has Multiples", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (validateFields.isAddons && !validateFields.menuGroupAddOns.length) {
        throw new bad_request_1.BadRequestsException("If Add-Ons Selected, Assign required Group AddOn to it", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validateFields.description) {
        throw new bad_request_1.BadRequestsException("Description is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validateFields.categoryId) {
        throw new bad_request_1.BadRequestsException("CategoryId is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validFoodTypes.includes(validateFields.type)) {
        throw new bad_request_1.BadRequestsException("Meal Type is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // if (!images || !images.length) {
    //   throw new BadRequestsException(
    //     "Images are Required",
    //     ErrorCode.UNPROCESSABLE_ENTITY
    //   );
    // }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const menuItem = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(menuItem === null || menuItem === void 0 ? void 0 : menuItem.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const category = yield (0, outlet_1.getCategoryByOutletId)(outlet.id, validateFields === null || validateFields === void 0 ? void 0 : validateFields.categoryId);
    if (!(category === null || category === void 0 ? void 0 : category.id)) {
        throw new not_found_1.NotFoundException("Category Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Prepare updates for variants
    const variantUpdates = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuItemVariants.map((variant) => {
            console.log("Variant", variant);
            const existingVariant = menuItem.menuItemVariants.find((ev) => ev.id === variant.id);
            if (existingVariant) {
                return __1.prismaDB.menuItemVariant.update({
                    where: { id: existingVariant.id },
                    data: {
                        foodType: variant.foodType,
                        netPrice: variant === null || variant === void 0 ? void 0 : variant.netPrice,
                        gst: variant === null || variant === void 0 ? void 0 : variant.gst,
                        price: variant.price,
                        chooseProfit: variant === null || variant === void 0 ? void 0 : variant.chooseProfit,
                        grossProfitType: variant === null || variant === void 0 ? void 0 : variant.grossProfitType,
                        grossProfitPer: (variant === null || variant === void 0 ? void 0 : variant.grossProfitType) === "PER"
                            ? variant === null || variant === void 0 ? void 0 : variant.grossProfitPer
                            : null,
                        grossProfit: variant === null || variant === void 0 ? void 0 : variant.grossProfit,
                        variantId: variant.variantId,
                    },
                });
            }
            else {
                return __1.prismaDB.menuItemVariant.create({
                    data: {
                        restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                        foodType: variant.foodType,
                        netPrice: variant === null || variant === void 0 ? void 0 : variant.netPrice,
                        gst: variant === null || variant === void 0 ? void 0 : variant.gst,
                        price: variant.price,
                        chooseProfit: variant === null || variant === void 0 ? void 0 : variant.chooseProfit,
                        grossProfitType: variant === null || variant === void 0 ? void 0 : variant.grossProfitType,
                        grossProfitPer: (variant === null || variant === void 0 ? void 0 : variant.grossProfitType) === "PER"
                            ? variant === null || variant === void 0 ? void 0 : variant.grossProfitPer
                            : null,
                        grossProfit: variant === null || variant === void 0 ? void 0 : variant.grossProfit,
                        variantId: variant === null || variant === void 0 ? void 0 : variant.variantId,
                        menuItemId: menuItem.id,
                    },
                });
            }
        })
        : [];
    const variantIdsToKeep = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuItemVariants.map((v) => v.id).filter(Boolean)
        : [];
    const variantsToDelete = menuItem.menuItemVariants.filter((ev) => !variantIdsToKeep.includes(ev.id));
    // Prepare updates for addons
    const addonUpdates = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isAddons)
        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuGroupAddOns.map((addon) => {
            const existingAddon = menuItem.menuGroupAddOns.find((ea) => ea.id === addon.id);
            if (existingAddon) {
                return __1.prismaDB.menuGroupAddOns.update({
                    where: { id: existingAddon.id },
                    data: {
                        addOnGroupId: addon.addOnGroupId,
                    },
                });
            }
            else {
                return __1.prismaDB.menuGroupAddOns.create({
                    data: { addOnGroupId: addon.addOnGroupId, menuItemId: menuItem.id },
                });
            }
        })
        : [];
    const addonIdsToKeep = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isAddons)
        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuGroupAddOns.map((a) => a.id).filter(Boolean)
        : [];
    const addonsToDelete = menuItem.menuGroupAddOns.filter((ea) => !addonIdsToKeep.includes(ea.id));
    // Prepare updates for images
    const imageUpdates = (_a = validateFields === null || validateFields === void 0 ? void 0 : validateFields.images) === null || _a === void 0 ? void 0 : _a.map((image) => {
        const existingImage = menuItem.images.find((ei) => ei.url === (image === null || image === void 0 ? void 0 : image.url));
        if (existingImage) {
            return __1.prismaDB.image.update({
                where: { id: existingImage.id },
                data: {
                    url: image.url,
                },
            });
        }
        else {
            return __1.prismaDB.image.create({
                data: Object.assign(Object.assign({}, image), { menuId: menuItem.id }),
            });
        }
    });
    const imageUrlsToKeep = validateFields === null || validateFields === void 0 ? void 0 : validateFields.images.map((i) => i.url);
    const imagesToDelete = menuItem.images.filter((ei) => !imageUrlsToKeep.includes(ei.url));
    // Perform all updates in a transaction
    yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        // Update main menu item
        yield prisma.menuItem.update({
            where: {
                id: menuItem.id,
            },
            data: {
                name: validateFields === null || validateFields === void 0 ? void 0 : validateFields.name,
                shortCode: validateFields === null || validateFields === void 0 ? void 0 : validateFields.shortCode,
                description: validateFields === null || validateFields === void 0 ? void 0 : validateFields.description,
                categoryId: validateFields === null || validateFields === void 0 ? void 0 : validateFields.categoryId,
                isVariants: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants,
                isAddons: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isAddons,
                isDelivery: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isDelivery,
                isPickUp: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isPickUp,
                isDineIn: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isDineIn,
                isOnline: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isOnline,
                type: validateFields === null || validateFields === void 0 ? void 0 : validateFields.type,
                price: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? "0" : validateFields === null || validateFields === void 0 ? void 0 : validateFields.price,
                gst: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? null : validateFields === null || validateFields === void 0 ? void 0 : validateFields.gst,
                netPrice: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? null : validateFields === null || validateFields === void 0 ? void 0 : validateFields.netPrice,
                chooseProfit: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                    ? null
                    : validateFields === null || validateFields === void 0 ? void 0 : validateFields.chooseProfit,
                grossProfitType: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                    ? null
                    : validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfitType,
                grossProfitPer: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                    ? null
                    : (validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfitType) === "PER"
                        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfitPer
                        : null,
                grossProfit: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                    ? null
                    : validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfit,
            },
        });
        // Handle variants
        yield Promise.all(variantUpdates);
        if (variantsToDelete.length > 0) {
            yield prisma.menuItemVariant.deleteMany({
                where: { id: { in: variantsToDelete.map((v) => v.id) } },
            });
        }
        // Handle addons
        yield Promise.all(addonUpdates);
        if (addonsToDelete.length > 0) {
            yield prisma.menuGroupAddOns.deleteMany({
                where: { id: { in: addonsToDelete.map((a) => a.id) } },
            });
        }
        // Handle images
        yield Promise.all(imageUpdates);
        if (imagesToDelete.length > 0) {
            yield prisma.image.deleteMany({
                where: { id: { in: imagesToDelete.map((i) => i.id) } },
            });
        }
    }));
    yield (0, get_items_1.getOAllItems)(outlet.id);
    return res.json({
        success: true,
        message: "Update Success ✅",
    });
});
exports.updateItembyId = updateItembyId;
const postItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const validateFields = menuSchema.parse(req.body);
    const validFoodTypes = Object.values(client_1.FoodRole);
    if (!validateFields.name) {
        throw new bad_request_1.BadRequestsException("Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (validateFields.isVariants === false) {
        if (!validateFields.price) {
            throw new bad_request_1.BadRequestsException("Price is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    else {
        if (!validateFields.menuItemVariants ||
            !validateFields.menuItemVariants.length)
            throw new bad_request_1.BadRequestsException("Variants is Required if this food has Multiples", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (validateFields.isAddons && !validateFields.menuGroupAddOns.length) {
        throw new bad_request_1.BadRequestsException("If Add-Ons Selected, Assign required Group AddOn to it", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validateFields.description) {
        throw new bad_request_1.BadRequestsException("Description is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validateFields.categoryId) {
        throw new bad_request_1.BadRequestsException("CategoryId is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validFoodTypes.includes(validateFields.type)) {
        throw new bad_request_1.BadRequestsException("Meal Type is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // if (!images || !images.length) {
    //   throw new BadRequestsException(
    //     "Images are Required",
    //     ErrorCode.UNPROCESSABLE_ENTITY
    //   );
    // }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const validVariants = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) && (validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuItemVariants.length) > 0
        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuItemVariants
        : [];
    const validAddons = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isAddons) && (validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuGroupAddOns.length) > 0
        ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.menuGroupAddOns
        : [];
    const menuItem = yield __1.prismaDB.menuItem.create({
        data: {
            name: validateFields === null || validateFields === void 0 ? void 0 : validateFields.name,
            shortCode: validateFields === null || validateFields === void 0 ? void 0 : validateFields.shortCode,
            description: validateFields === null || validateFields === void 0 ? void 0 : validateFields.description,
            categoryId: validateFields === null || validateFields === void 0 ? void 0 : validateFields.categoryId,
            isVariants: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants,
            isAddons: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isAddons,
            isDelivery: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isDelivery,
            isPickUp: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isPickUp,
            isDineIn: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isDineIn,
            isOnline: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isOnline,
            price: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? "0" : validateFields === null || validateFields === void 0 ? void 0 : validateFields.price,
            gst: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? null : validateFields === null || validateFields === void 0 ? void 0 : validateFields.gst,
            netPrice: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants) ? null : validateFields === null || validateFields === void 0 ? void 0 : validateFields.netPrice,
            chooseProfit: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                ? null
                : validateFields === null || validateFields === void 0 ? void 0 : validateFields.chooseProfit,
            grossProfitType: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                ? null
                : validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfitType,
            grossProfitPer: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                ? null
                : (validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfitType) === "PER"
                    ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfitPer
                    : null,
            grossProfit: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.isVariants)
                ? null
                : validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfit,
            type: validateFields === null || validateFields === void 0 ? void 0 : validateFields.type,
            menuItemVariants: {
                create: validVariants.map((variant) => ({
                    restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                    variantId: variant === null || variant === void 0 ? void 0 : variant.variantId,
                    foodType: variant === null || variant === void 0 ? void 0 : variant.foodType,
                    netPrice: variant === null || variant === void 0 ? void 0 : variant.netPrice,
                    gst: variant === null || variant === void 0 ? void 0 : variant.gst,
                    price: variant === null || variant === void 0 ? void 0 : variant.price,
                    chooseProfit: variant === null || variant === void 0 ? void 0 : variant.chooseProfit,
                    grossProfitType: variant === null || variant === void 0 ? void 0 : variant.grossProfitType,
                    grossProfitPer: (variant === null || variant === void 0 ? void 0 : variant.grossProfitType) === "PER" ? variant === null || variant === void 0 ? void 0 : variant.grossProfitPer : null,
                    grossProfit: variant === null || variant === void 0 ? void 0 : variant.grossProfit,
                })),
            },
            menuGroupAddOns: {
                create: validAddons,
            },
            images: {
                createMany: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.images.length) > 0
                    ? {
                        data: [
                            ...validateFields === null || validateFields === void 0 ? void 0 : validateFields.images.map((image) => image),
                        ],
                    }
                    : undefined,
            },
            restaurantId: outlet.id,
        },
    });
    yield (0, get_items_1.getOAllItems)(outlet.id);
    return res.json({
        success: true,
        item: menuItem,
        message: "Creattion of Item Success ✅",
    });
});
exports.postItem = postItem;
const deleteItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, itemId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const item = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(item === null || item === void 0 ? void 0 : item.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.menuItem.delete({
        where: {
            restaurantId: outlet.id,
            id: item === null || item === void 0 ? void 0 : item.id,
        },
    });
    yield (0, get_items_1.getOAllItems)(outlet.id);
    return res.json({
        success: true,
        message: "Item Deleted ",
    });
});
exports.deleteItem = deleteItem;
const getShortCodeStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { shortCode } = req.body;
    console.log("Short Code", shortCode);
    const findShortCode = yield __1.prismaDB.menuItem.findFirst({
        where: {
            restaurantId: outletId,
            shortCode: shortCode,
        },
    });
    if (findShortCode === null || findShortCode === void 0 ? void 0 : findShortCode.id) {
        return res.json({
            success: true,
        });
    }
    else {
        return res.json({
            success: false,
        });
    }
});
exports.getShortCodeStatus = getShortCodeStatus;
const getMenuVariants = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getVariants = yield __1.prismaDB.menuItemVariant.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        include: {
            menuItem: true,
            variant: true,
        },
    });
    const formattedVariants = getVariants === null || getVariants === void 0 ? void 0 : getVariants.map((variant) => {
        var _a, _b;
        return ({
            id: variant === null || variant === void 0 ? void 0 : variant.id,
            name: `${(_a = variant === null || variant === void 0 ? void 0 : variant.menuItem) === null || _a === void 0 ? void 0 : _a.name}-${(_b = variant === null || variant === void 0 ? void 0 : variant.variant) === null || _b === void 0 ? void 0 : _b.name}`,
            price: variant === null || variant === void 0 ? void 0 : variant.price,
        });
    });
    return res.json({
        success: true,
        menuVariants: formattedVariants,
    });
});
exports.getMenuVariants = getMenuVariants;
const addItemToUserFav = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { id } = req.body;
    const { outletId } = req.params;
    // @ts-ignore
    const userId = (_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.id;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const user = yield __1.prismaDB.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!user) {
        throw new bad_request_1.BadRequestsException("Admin Not found", root_1.ErrorCode.UNAUTHORIZED);
    }
    // Check if the menu ID exists in favItems
    const updatedFavItems = (user === null || user === void 0 ? void 0 : user.favItems.includes(id))
        ? user.favItems.filter((favId) => favId !== id) // Remove the ID if present
        : [...user.favItems, id]; // Add the ID if not present
    // Update the favItems field
    yield __1.prismaDB.user.update({
        where: {
            id: user.id,
        },
        data: {
            favItems: updatedFavItems, // Directly set the updated array
        },
    });
    yield (0, get_users_1.getFormatUserAndSendToRedis)(user === null || user === void 0 ? void 0 : user.id);
    return res.json({
        success: true,
        message: "Added to favourites",
    });
});
exports.addItemToUserFav = addItemToUserFav;
const getSingleAddons = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getAddons = yield __1.prismaDB.addOnVariants.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        include: {
            addon: true,
        },
    });
    const formattedAddOns = getAddons === null || getAddons === void 0 ? void 0 : getAddons.map((addOn) => ({
        id: addOn === null || addOn === void 0 ? void 0 : addOn.id,
        name: addOn === null || addOn === void 0 ? void 0 : addOn.name,
        price: addOn === null || addOn === void 0 ? void 0 : addOn.price,
    }));
    return res.json({
        success: true,
        addOnItems: formattedAddOns,
    });
});
exports.getSingleAddons = getSingleAddons;
