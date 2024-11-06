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
exports.deleteItem = exports.postItem = exports.updateItembyId = exports.getAddONById = exports.getVariantById = exports.getItemById = exports.getAllItem = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const client_1 = require("@prisma/client");
const bad_request_1 = require("../../../exceptions/bad-request");
const redis_1 = require("../../../services/redis");
const get_items_1 = require("../../../lib/outlet/get-items");
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
const updateItembyId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { itemId, outletId } = req.params;
    const validFoodTypes = Object.values(client_1.FoodRole);
    const { name, shortCode, description, categoryId, isFeatured, isArchived, isVariants, isAddons, isDelivery, isPickUp, isDineIn, isOnline, type, price, menuItemVariants, menuGroupAddOns, images, } = req.body;
    if (!name) {
        throw new bad_request_1.BadRequestsException("Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (isVariants === false) {
        if (!price) {
            throw new bad_request_1.BadRequestsException("Price is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    else {
        if (!menuItemVariants || !menuItemVariants.length)
            throw new bad_request_1.BadRequestsException("Variants is Required if this food has Multiples", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (isAddons && !menuGroupAddOns.length) {
        throw new bad_request_1.BadRequestsException("If Add-Ons Selected, Assign required Group AddOn to it", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!description) {
        throw new bad_request_1.BadRequestsException("Description is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!categoryId) {
        throw new bad_request_1.BadRequestsException("CategoryId is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validFoodTypes.includes(type)) {
        throw new bad_request_1.BadRequestsException("Meal Type is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!images || !images.length) {
        throw new bad_request_1.BadRequestsException("Images are Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const menuItem = yield (0, outlet_1.getItemByOutletId)(outlet.id, itemId);
    if (!(menuItem === null || menuItem === void 0 ? void 0 : menuItem.id)) {
        throw new not_found_1.NotFoundException("Item Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const category = yield (0, outlet_1.getCategoryByOutletId)(outlet.id, categoryId);
    if (!(category === null || category === void 0 ? void 0 : category.id)) {
        throw new not_found_1.NotFoundException("Category Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    let updateData = {
        name,
        shortCode,
        description,
        isFeatured,
        categoryId,
        isArchived,
        isVariants,
        isAddons,
        isDelivery,
        isPickUp,
        isDineIn,
        isOnline,
        type,
        price: isVariants ? "0" : price,
    };
    // Prepare updates for variants
    const variantUpdates = isVariants
        ? menuItemVariants.map((variant) => {
            console.log("Variant", variant);
            const existingVariant = menuItem.menuItemVariants.find((ev) => ev.id === variant.id);
            if (existingVariant) {
                return __1.prismaDB.menuItemVariant.update({
                    where: { id: existingVariant.id },
                    data: {
                        foodType: variant.foodType,
                        price: variant.price,
                        variantId: variant.variantId,
                    },
                });
            }
            else {
                return __1.prismaDB.menuItemVariant.create({
                    data: {
                        foodType: variant.foodType,
                        price: variant.price,
                        variantId: variant.variantId,
                        menuItemId: menuItem.id,
                    },
                });
            }
        })
        : [];
    const variantIdsToKeep = isVariants
        ? menuItemVariants.map((v) => v.id).filter(Boolean)
        : [];
    const variantsToDelete = menuItem.menuItemVariants.filter((ev) => !variantIdsToKeep.includes(ev.id));
    // Prepare updates for addons
    const addonUpdates = isAddons
        ? menuGroupAddOns.map((addon) => {
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
    const addonIdsToKeep = isAddons
        ? menuGroupAddOns.map((a) => a.id).filter(Boolean)
        : [];
    const addonsToDelete = menuItem.menuGroupAddOns.filter((ea) => !addonIdsToKeep.includes(ea.id));
    // Prepare updates for images
    const imageUpdates = images === null || images === void 0 ? void 0 : images.map((image) => {
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
    const imageUrlsToKeep = images.map((i) => i.url);
    const imagesToDelete = menuItem.images.filter((ei) => !imageUrlsToKeep.includes(ei.url));
    // Perform all updates in a transaction
    yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        // Update main menu item
        yield prisma.menuItem.update({
            where: {
                id: menuItem.id,
            },
            data: updateData,
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
    const validFoodTypes = Object.values(client_1.FoodRole);
    const { name, shortCode, description, categoryId, isFeatured, isArchived, isVariants, isAddons, isDelivery, isPickUp, isDineIn, isOnline, type, price, menuItemVariants, menuGroupAddOns, images, } = req.body;
    if (!name) {
        throw new bad_request_1.BadRequestsException("Name is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (isVariants === false) {
        if (!price) {
            throw new bad_request_1.BadRequestsException("Price is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    else {
        if (!menuItemVariants || !menuItemVariants.length)
            throw new bad_request_1.BadRequestsException("Variants is Required if this food has Multiples", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (isAddons && !menuGroupAddOns.length) {
        throw new bad_request_1.BadRequestsException("If Add-Ons Selected, Assign required Group AddOn to it", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!description) {
        throw new bad_request_1.BadRequestsException("Description is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!categoryId) {
        throw new bad_request_1.BadRequestsException("CategoryId is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!validFoodTypes.includes(type)) {
        throw new bad_request_1.BadRequestsException("Meal Type is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!images || !images.length) {
        throw new bad_request_1.BadRequestsException("Images are Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const validPrice = isVariants ? "0" : price;
    const validVariants = isVariants && menuItemVariants.length > 0 ? menuItemVariants : [];
    const validAddons = isAddons && menuGroupAddOns.length > 0 ? menuGroupAddOns : [];
    const menuItem = yield __1.prismaDB.menuItem.create({
        data: {
            name,
            shortCode,
            description,
            categoryId,
            isFeatured,
            isArchived,
            isVariants,
            isAddons,
            isDelivery,
            isPickUp,
            isDineIn,
            isOnline,
            price: validPrice,
            type,
            menuItemVariants: {
                create: validVariants,
            },
            menuGroupAddOns: {
                create: validAddons,
            },
            images: {
                createMany: {
                    data: [...images.map((image) => image)],
                },
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
