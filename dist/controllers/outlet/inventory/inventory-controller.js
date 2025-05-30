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
exports.calculateItemServes = exports.deleteItemRecipe = exports.getAllTableRawMaterialUnit = exports.getAllSettledTablePurcahses = exports.getAllRequestedTablePurcahses = exports.getAllCompletedTablePurcahses = exports.getTableAllRawMaterialUnit = exports.getAllTableItemRecipe = exports.allTableStocks = exports.getAllTableRawMaterialCategory = exports.getAllVendorsForTable = exports.getAllTableRawMaterials = exports.updateStockRawMaterial = exports.settlePayForRaisedPurchase = exports.restockPurchase = exports.getRecipeById = exports.getAllItemRecipe = exports.updateItemRecipe = exports.createItemRecipe = exports.allStocks = exports.createVendorCategory = exports.getAllVendorCategories = exports.getAllVendors = exports.deleteVendor = exports.updateVendor = exports.createVendor = exports.getPurchaseId = exports.validatePurchasenRestock = exports.cancelRequestPurchase = exports.deleteRequestPurchase = exports.updateRequestPurchase = exports.createRaiseRequestPurchase = exports.createRequestPurchase = exports.getAllPurcahses = exports.getAllRawMaterialUnit = exports.deleteCategoryById = exports.updateCategoryById = exports.getCategoryById = exports.createRawMaterialCategory = exports.deleteUnitById = exports.updateUnitById = exports.getUnitById = exports.createUnit = exports.getAllRawMaterialCategory = exports.deleteRawMaterialById = exports.getRawMaterialById = exports.updateRawMaterialById = exports.createRawMaterial = exports.getAllRawMaterials = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const staff_1 = require("../../../schema/staff");
const zod_1 = require("zod");
const redis_1 = require("../../../services/redis");
const get_inventory_1 = require("../../../lib/outlet/get-inventory");
const unauthorized_1 = require("../../../exceptions/unauthorized");
const bad_request_1 = require("../../../exceptions/bad-request");
const get_items_1 = require("../../../lib/outlet/get-items");
const ws_1 = require("../../../services/ws");
const utils_1 = require("../../../lib/utils");
const client_1 = require("@prisma/client");
const unitSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
});
const rawMaterialCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
});
const getAllRawMaterials = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const rawMaterialsFromRedis = yield redis_1.redis.get(`${outletId}-raw-materials`);
    if (rawMaterialsFromRedis) {
        return res.json({
            success: true,
            rawMaterials: JSON.parse(rawMaterialsFromRedis),
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const rawMaterials = yield (0, get_inventory_1.fetchOutletRawMaterialsToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
    return res.json({
        success: true,
        rawMaterials: rawMaterials,
    });
});
exports.getAllRawMaterials = getAllRawMaterials;
const createRawMaterial = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const validateFields = staff_1.rawMaterialSchema.parse(req.body);
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    const slugName = (0, utils_1.generateSlug)(validateFields.name);
    const rawMaterial = yield __1.prismaDB.rawMaterial.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            slug: slugName,
        },
    });
    if (rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.id) {
        throw new bad_request_1.BadRequestsException("Raw Material Already Exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.rawMaterial.create({
        data: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            name: validateFields.name,
            slug: slugName,
            shortcode: validateFields.barcode,
            categoryId: validateFields.categoryId,
            consumptionUnitId: validateFields.consumptionUnitId,
            conversionFactor: validateFields.conversionFactor,
            minimumStockLevelUnit: validateFields.minimumStockLevelUnitId,
            minimumStockLevel: validateFields.minimumStockLevel,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outlet.id}-raw-materials`),
        redis_1.redis.del(`${outlet.id}-stocks`),
    ]);
    return res.json({
        success: true,
        message: "Raw Material Created",
    });
});
exports.createRawMaterial = createRawMaterial;
const updateRawMaterialById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const validateFields = staff_1.rawMaterialSchema.parse(req.body);
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const rawMaterial = yield __1.prismaDB.rawMaterial.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            id: id,
        },
    });
    if (!(rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.id)) {
        throw new not_found_1.NotFoundException("Raw Material Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const slugName = (0, utils_1.generateSlug)(validateFields.name);
    if ((rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.slug) !== slugName) {
        const findSlug = yield __1.prismaDB.rawMaterial.findFirst({
            where: {
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                slug: slugName,
            },
        });
        if (findSlug === null || findSlug === void 0 ? void 0 : findSlug.id) {
            throw new bad_request_1.BadRequestsException("Raw Material Already Exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    yield __1.prismaDB.rawMaterial.update({
        where: {
            id: rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        data: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            name: validateFields.name,
            shortcode: validateFields.barcode,
            categoryId: validateFields.categoryId,
            conversionFactor: validateFields.conversionFactor,
            consumptionUnitId: validateFields.consumptionUnitId,
            minimumStockLevelUnit: validateFields.minimumStockLevelUnitId,
            minimumStockLevel: validateFields.minimumStockLevel,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outlet.id}-raw-materials`),
        redis_1.redis.del(`${outlet.id}-stocks`),
    ]);
    return res.json({
        success: true,
        message: "Raw Material Updated",
    });
});
exports.updateRawMaterialById = updateRawMaterialById;
const getRawMaterialById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const rawMaterial = yield __1.prismaDB.rawMaterial.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            id: id,
        },
    });
    if (!(rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.id)) {
        throw new not_found_1.NotFoundException("Raw Material Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    return res.json({
        success: true,
        rawMaterial,
        message: "Raw Material Updated",
    });
});
exports.getRawMaterialById = getRawMaterialById;
const deleteRawMaterialById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const rawMaterial = yield __1.prismaDB.rawMaterial.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            id: id,
        },
    });
    if (!(rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.id)) {
        throw new not_found_1.NotFoundException("Raw Material Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.rawMaterial.delete({
        where: {
            id: rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    });
    yield Promise.all([
        redis_1.redis.del(`${outlet.id}-raw-materials`),
        redis_1.redis.del(`${outlet.id}-stocks`),
    ]);
    return res.json({
        success: true,
        message: "Raw Material Deleted",
    });
});
exports.deleteRawMaterialById = deleteRawMaterialById;
const getAllRawMaterialCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const rawMaterialsCategoriesFromRedis = yield redis_1.redis.get(`${outletId}-raw-materials-category`);
    if (rawMaterialsCategoriesFromRedis) {
        return res.json({
            success: true,
            categories: JSON.parse(rawMaterialsCategoriesFromRedis),
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const rawMaterialsCategory = yield (0, get_inventory_1.fetchOutletRawMaterialCAtegoryToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
    return res.json({
        success: true,
        categories: rawMaterialsCategory,
    });
});
exports.getAllRawMaterialCategory = getAllRawMaterialCategory;
const createUnit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const validateFields = unitSchema.parse(req.body);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.unit.create({
        data: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            name: validateFields.name,
            slug: (0, utils_1.generateSlug)(validateFields.name),
        },
    });
    const rawMaterialsUnit = yield __1.prismaDB.unit.findMany({
        where: {
            restaurantId: outletId,
        },
    });
    yield redis_1.redis.set(`${outletId}-raw-materials-unit`, JSON.stringify(rawMaterialsUnit));
    return res.json({
        success: true,
        message: "Unit Created Success ✅",
    });
});
exports.createUnit = createUnit;
const getUnitById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, unitId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const unit = yield __1.prismaDB.unit.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            id: unitId,
        },
    });
    if (!(unit === null || unit === void 0 ? void 0 : unit.id)) {
        throw new not_found_1.NotFoundException("Unit Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    return res.json({
        success: true,
        unit,
        message: "Unit Updated Success ✅",
    });
});
exports.getUnitById = getUnitById;
const updateUnitById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, unitId } = req.params;
    const validateFields = unitSchema.parse(req.body);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const unit = yield __1.prismaDB.unit.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            id: unitId,
        },
    });
    if (!(unit === null || unit === void 0 ? void 0 : unit.id)) {
        throw new not_found_1.NotFoundException("Unit Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.unit.update({
        where: {
            id: unit === null || unit === void 0 ? void 0 : unit.id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        data: {
            name: validateFields.name,
        },
    });
    yield (0, get_inventory_1.fetchOutletRawMaterialUnitToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
    return res.json({
        success: true,
        message: "Unit Updated Success ✅",
    });
});
exports.updateUnitById = updateUnitById;
const deleteUnitById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, unitId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const unit = yield __1.prismaDB.unit.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            id: unitId,
        },
    });
    if (!(unit === null || unit === void 0 ? void 0 : unit.id)) {
        throw new not_found_1.NotFoundException("Unit Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.unit.delete({
        where: {
            id: unit === null || unit === void 0 ? void 0 : unit.id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    });
    yield (0, get_inventory_1.fetchOutletRawMaterialUnitToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
    return res.json({
        success: true,
        message: "Unit Deleted Success ✅",
    });
});
exports.deleteUnitById = deleteUnitById;
const createRawMaterialCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const validateFields = rawMaterialCategorySchema.parse(req.body);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.rawMaterialCategory.create({
        data: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            name: validateFields.name,
            slug: (0, utils_1.generateSlug)(validateFields.name),
        },
    });
    yield (0, get_inventory_1.fetchOutletRawMaterialCAtegoryToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
    return res.json({
        success: true,
        message: "Category Created Success ✅",
    });
});
exports.createRawMaterialCategory = createRawMaterialCategory;
const getCategoryById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, categoryId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const category = yield __1.prismaDB.rawMaterialCategory.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            id: categoryId,
        },
    });
    if (!(category === null || category === void 0 ? void 0 : category.id)) {
        throw new not_found_1.NotFoundException("Category Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    return res.json({
        success: true,
        category,
        message: "Category Updated Success ✅",
    });
});
exports.getCategoryById = getCategoryById;
const updateCategoryById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, categoryId } = req.params;
    const validateFields = rawMaterialCategorySchema.parse(req.body);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const category = yield __1.prismaDB.rawMaterialCategory.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            id: categoryId,
        },
    });
    if (!(category === null || category === void 0 ? void 0 : category.id)) {
        throw new not_found_1.NotFoundException("Category Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.rawMaterialCategory.update({
        where: {
            id: category === null || category === void 0 ? void 0 : category.id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        data: {
            name: validateFields.name,
        },
    });
    yield (0, get_inventory_1.fetchOutletRawMaterialCAtegoryToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
    return res.json({
        success: true,
        message: "Category Updated Success ✅",
    });
});
exports.updateCategoryById = updateCategoryById;
const deleteCategoryById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, categoryId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const category = yield __1.prismaDB.rawMaterialCategory.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            id: categoryId,
        },
    });
    if (!(category === null || category === void 0 ? void 0 : category.id)) {
        throw new not_found_1.NotFoundException("Category Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.rawMaterialCategory.delete({
        where: {
            id: category === null || category === void 0 ? void 0 : category.id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    });
    yield (0, get_inventory_1.fetchOutletRawMaterialCAtegoryToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
    return res.json({
        success: true,
        message: "Category Deleted Success ✅",
    });
});
exports.deleteCategoryById = deleteCategoryById;
const getAllRawMaterialUnit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const rawMaterialsUnitFromRedis = yield redis_1.redis.get(`${outletId}-raw-materials-unit`);
    if (rawMaterialsUnitFromRedis) {
        return res.json({
            success: true,
            units: JSON.parse(rawMaterialsUnitFromRedis),
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const rawMaterialsUnit = yield __1.prismaDB.unit.findMany({
        where: {
            restaurantId: outletId,
        },
    });
    yield redis_1.redis.set(`${outletId}-raw-materials-unit`, JSON.stringify(rawMaterialsUnit));
    return res.json({
        success: true,
        units: rawMaterialsUnit,
    });
});
exports.getAllRawMaterialUnit = getAllRawMaterialUnit;
const getAllPurcahses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const allPurchasesFromRedis = yield redis_1.redis.get(`${outletId}-purchases`);
    if (allPurchasesFromRedis) {
        return res.json({
            success: true,
            allPurchases: JSON.parse(allPurchasesFromRedis),
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const allPurchases = yield __1.prismaDB.purchase.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        include: {
            purchaseItems: {
                include: {
                    purchaseUnit: true,
                    rawMaterial: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    yield redis_1.redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases), "EX", 60 * 60 * 3);
    return res.json({
        success: true,
        allPurchases,
    });
});
exports.getAllPurcahses = getAllPurcahses;
const purchaseRequestFormSchema = zod_1.z.object({
    vendorId: zod_1.z
        .string({
        required_error: "Vendor Is Required",
    })
        .min(1, { message: "Vendor Is Required" }),
    rawMaterials: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        rawMaterialId: zod_1.z.string().min(1, { message: "Raw Material Is Required" }),
        rawMaterialName: zod_1.z.string().min(1, { message: "Raw Material Name" }),
        unitName: zod_1.z.string().min(1, { message: "Unit Name is required" }),
        requestUnitId: zod_1.z.string().min(1, { message: "Request Unit is Required" }),
        requestQuantity: zod_1.z.coerce
            .number()
            .min(0, { message: "Request Quantity is Required" }),
        netRate: zod_1.z.number().optional(),
        gstType: zod_1.z.nativeEnum(client_1.GstType),
        taxAmount: zod_1.z.number().optional(),
        totalAmount: zod_1.z.number().optional(),
    })),
    summary: zod_1.z
        .object({
        totalItems: zod_1.z.number(),
        subTotal: zod_1.z.number(),
        totalTax: zod_1.z.number(),
        grandTotal: zod_1.z.number(),
    })
        .optional(),
});
const createRequestPurchase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { outletId } = req.params;
    // const validateFields
    const { data: validateFields, error } = purchaseRequestFormSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = req.user.id;
    // @ts-ignore
    const username = `${(_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.name}-(${(_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.role})`;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findVendor = yield __1.prismaDB.vendor.findFirst({
        where: {
            restaurantId: outlet.id,
            id: validateFields.vendorId,
        },
    });
    if (!(findVendor === null || findVendor === void 0 ? void 0 : findVendor.id)) {
        throw new not_found_1.NotFoundException("Vendor Not found", root_1.ErrorCode.NOT_FOUND);
    }
    const invoiceNo = yield (0, outlet_1.generatePurchaseNo)(outlet.id);
    yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _c, _d, _e;
        yield prisma.purchase.create({
            data: {
                invoiceNo: invoiceNo,
                restaurantId: outlet.id,
                vendorId: findVendor.id,
                createdBy: username,
                isPaid: false,
                purchaseItems: {
                    create: validateFields.rawMaterials.map((item) => ({
                        rawMaterialId: item === null || item === void 0 ? void 0 : item.rawMaterialId,
                        rawMaterialName: item === null || item === void 0 ? void 0 : item.rawMaterialName,
                        purchaseQuantity: item === null || item === void 0 ? void 0 : item.requestQuantity,
                        purchaseUnitId: item === null || item === void 0 ? void 0 : item.requestUnitId,
                        purchaseUnitName: item === null || item === void 0 ? void 0 : item.unitName,
                        gstType: item === null || item === void 0 ? void 0 : item.gstType,
                        netRate: item === null || item === void 0 ? void 0 : item.netRate,
                        taxAmount: item === null || item === void 0 ? void 0 : item.taxAmount,
                        purchasePrice: item === null || item === void 0 ? void 0 : item.totalAmount,
                    })),
                },
                subTotal: (_c = validateFields.summary) === null || _c === void 0 ? void 0 : _c.subTotal,
                totalAmount: (_d = validateFields.summary) === null || _d === void 0 ? void 0 : _d.grandTotal,
                taxes: (_e = validateFields.summary) === null || _e === void 0 ? void 0 : _e.totalTax,
            },
        });
        yield redis_1.redis.del(`${outletId}-purchases`);
    }));
    return res.json({
        success: true,
        message: "Request Purchase Created",
    });
});
exports.createRequestPurchase = createRequestPurchase;
const createRaiseRequestPurchase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _f, _g;
    const { outletId } = req.params;
    // const validateFields
    const { data: validateFields, error } = purchaseRequestFormSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = req.user.id;
    // @ts-ignore
    const username = `${(_f = req === null || req === void 0 ? void 0 : req.user) === null || _f === void 0 ? void 0 : _f.name}-(${(_g = req === null || req === void 0 ? void 0 : req.user) === null || _g === void 0 ? void 0 : _g.role})`;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const findVendor = yield __1.prismaDB.vendor.findFirst({
        where: {
            restaurantId: outlet.id,
            id: validateFields.vendorId,
        },
    });
    if (!(findVendor === null || findVendor === void 0 ? void 0 : findVendor.id)) {
        throw new not_found_1.NotFoundException("Vendor Not found", root_1.ErrorCode.NOT_FOUND);
    }
    const invoiceNo = yield (0, outlet_1.generatePurchaseNo)(outlet.id);
    yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _h, _j, _k;
        yield prisma.purchase.create({
            data: {
                invoiceNo: invoiceNo,
                restaurantId: outlet.id,
                vendorId: findVendor.id,
                createdBy: username,
                isPaid: false,
                purchaseItems: {
                    create: validateFields.rawMaterials.map((item) => ({
                        rawMaterialId: item === null || item === void 0 ? void 0 : item.rawMaterialId,
                        rawMaterialName: item === null || item === void 0 ? void 0 : item.rawMaterialName,
                        purchaseQuantity: item === null || item === void 0 ? void 0 : item.requestQuantity,
                        purchaseUnitId: item === null || item === void 0 ? void 0 : item.requestUnitId,
                        purchaseUnitName: item === null || item === void 0 ? void 0 : item.unitName,
                        gstType: item === null || item === void 0 ? void 0 : item.gstType,
                        netRate: item === null || item === void 0 ? void 0 : item.netRate,
                        taxAmount: item === null || item === void 0 ? void 0 : item.taxAmount,
                        purchasePrice: item === null || item === void 0 ? void 0 : item.totalAmount,
                    })),
                },
                purchaseStatus: "REQUESTED",
                subTotal: (_h = validateFields.summary) === null || _h === void 0 ? void 0 : _h.subTotal,
                totalAmount: (_j = validateFields.summary) === null || _j === void 0 ? void 0 : _j.grandTotal,
                taxes: (_k = validateFields.summary) === null || _k === void 0 ? void 0 : _k.totalTax,
            },
        });
        yield redis_1.redis.del(`${outletId}-purchases`);
    }));
    return res.json({
        success: true,
        message: "Purchase Order Raised",
    });
});
exports.createRaiseRequestPurchase = createRaiseRequestPurchase;
const updateRequestPurchase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _l, _m;
    const { outletId, id } = req.params;
    // const validateFields
    const { data: validateFields, error } = purchaseRequestFormSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = req.user.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findVendor = yield __1.prismaDB.vendor.findFirst({
        where: {
            restaurantId: outlet.id,
            id: validateFields.vendorId,
        },
    });
    if (!(findVendor === null || findVendor === void 0 ? void 0 : findVendor.id)) {
        throw new not_found_1.NotFoundException("Vendor Not found", root_1.ErrorCode.NOT_FOUND);
    }
    const findPurchase = yield __1.prismaDB.purchase.findFirst({
        where: {
            id: id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        include: {
            purchaseItems: true,
        },
    });
    if (!(findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id)) {
        throw new not_found_1.NotFoundException("No Requested Purchases found", root_1.ErrorCode.NOT_FOUND);
    }
    //prepare purchaseItems to update & delete
    const existingPurchaseItems = (_l = findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.purchaseItems) === null || _l === void 0 ? void 0 : _l.map((pi) => pi.id);
    const incommingItems = (_m = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _m === void 0 ? void 0 : _m.map((i) => i === null || i === void 0 ? void 0 : i.id).filter(Boolean);
    // Determine purchaseItem to delete (those in existing but not in incoming)
    const purchaseItemsToDelete = existingPurchaseItems.filter((id) => !incommingItems.includes(id));
    // Prepare transaction for atomic update
    yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _o, _p, _q, _r;
        //update purchase details
        yield __1.prismaDB.purchase.update({
            where: {
                id: findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id,
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
            data: {
                vendorId: findVendor.id,
                isPaid: false,
                subTotal: (_o = validateFields.summary) === null || _o === void 0 ? void 0 : _o.subTotal,
                totalAmount: (_p = validateFields.summary) === null || _p === void 0 ? void 0 : _p.grandTotal,
                taxes: (_q = validateFields.summary) === null || _q === void 0 ? void 0 : _q.totalTax,
            },
        });
        // Handle purchaseItems updates in a single operation
        if (((_r = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _r === void 0 ? void 0 : _r.length) > 0) {
            // Perform upsert operations for ingredients
            const purchaseItemsUpserts = validateFields.rawMaterials.map((item) => {
                // If ingredientId exists, it's an update. Otherwise, it's a create
                return item.id
                    ? prisma.purchaseItems.update({
                        where: {
                            id: item === null || item === void 0 ? void 0 : item.id,
                            purchaseId: findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id,
                        },
                        data: {
                            rawMaterialId: item.rawMaterialId,
                            rawMaterialName: item.rawMaterialName,
                            purchaseQuantity: item.requestQuantity,
                            purchaseUnitId: item === null || item === void 0 ? void 0 : item.requestUnitId,
                            purchaseUnitName: item === null || item === void 0 ? void 0 : item.unitName,
                            gstType: item === null || item === void 0 ? void 0 : item.gstType,
                            netRate: item === null || item === void 0 ? void 0 : item.netRate,
                            taxAmount: item === null || item === void 0 ? void 0 : item.taxAmount,
                            purchasePrice: item === null || item === void 0 ? void 0 : item.totalAmount,
                        },
                    })
                    : prisma.purchaseItems.create({
                        data: {
                            purchaseId: findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id,
                            rawMaterialId: item === null || item === void 0 ? void 0 : item.rawMaterialId,
                            rawMaterialName: item.rawMaterialName,
                            purchaseQuantity: item.requestQuantity,
                            purchaseUnitId: item.requestUnitId,
                            purchaseUnitName: item.unitName,
                            gstType: item === null || item === void 0 ? void 0 : item.gstType,
                            netRate: item === null || item === void 0 ? void 0 : item.netRate,
                            taxAmount: item === null || item === void 0 ? void 0 : item.taxAmount,
                            purchasePrice: item === null || item === void 0 ? void 0 : item.totalAmount,
                        },
                    });
            });
            // Execute all upsert operations
            yield Promise.all(purchaseItemsUpserts);
        }
        // Delete ingredients that are no longer in the recipe
        if (purchaseItemsToDelete.length > 0) {
            yield prisma.purchaseItems.deleteMany({
                where: {
                    id: { in: purchaseItemsToDelete },
                    purchaseId: findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id,
                },
            });
        }
    }));
    yield redis_1.redis.del(`${outletId}-purchases`);
    return res.json({
        success: true,
        message: "Request Purchase Updated",
    });
});
exports.updateRequestPurchase = updateRequestPurchase;
const deleteRequestPurchase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = req.user.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findPurchase = yield __1.prismaDB.purchase.findFirst({
        where: {
            id: id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    });
    if (!(findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id)) {
        throw new not_found_1.NotFoundException("No Requested Purchases found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.purchase.delete({
        where: {
            id: findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    });
    yield redis_1.redis.del(`${outletId}-purchases`);
    return res.json({
        success: true,
        message: "Request Purchase Deleted ✅",
    });
});
exports.deleteRequestPurchase = deleteRequestPurchase;
const cancelRequestPurchase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = req.user.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findPurchase = yield __1.prismaDB.purchase.findFirst({
        where: {
            id: id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    });
    if (!(findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id)) {
        throw new not_found_1.NotFoundException("No Requested Purchases found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.purchase.update({
        where: {
            id: findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        data: {
            purchaseStatus: "CANCELLED",
        },
    });
    yield redis_1.redis.del(`${outletId}-purchases`);
    return res.json({
        success: true,
        message: "Request Purchase Cancelled ✅",
    });
});
exports.cancelRequestPurchase = cancelRequestPurchase;
const validatePurchaseSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, { message: "Purchase Id Missing" }),
    vendorId: zod_1.z
        .string({ required_error: "Vendor is Missing" })
        .min(1, { message: "Vendor is Missing" }),
    rawMaterials: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string().min(1, { message: "Purchase Item Id is missing" }),
        rawMaterialId: zod_1.z
            .string({ required_error: "Raw Material is required" })
            .min(1, { message: "Raw Material Is Required" }),
        rawMaterialName: zod_1.z.string().min(1, { message: "Raw Material Name" }),
        unitName: zod_1.z.string().min(1, { message: "Unit Name is required" }),
        requestUnitId: zod_1.z
            .string({ required_error: "Request Unit is Required" })
            .min(1, { message: "Request Unit is Required" }),
        requestQuantity: zod_1.z.coerce
            .number()
            .min(0, { message: "Request Quantity is Required" }),
        netRate: zod_1.z.coerce.number(),
        gstType: zod_1.z.nativeEnum(client_1.GstType),
        taxAmount: zod_1.z.coerce.number(),
        totalRate: zod_1.z.coerce
            .number()
            .min(0, { message: "Purchase price is required" }),
    }))
        .min(1, { message: "Atleast 1 Raw Material you need to request" }),
    isPaid: zod_1.z.boolean({ required_error: "You need to choose" }),
    billImage: zod_1.z.string().optional(),
    amountToBePaid: zod_1.z.coerce.number().min(0, { message: "Amount Required" }),
    chooseInvoice: zod_1.z
        .enum(["generateInvoice", "uploadInvoice"], {
        required_error: "You need to select a invoice type.",
    })
        .optional(),
    paymentMethod: zod_1.z
        .enum(["CASH", "UPI", "DEBIT", "CREDIT"], {
        required_error: "Settlement Payment Method Required.",
    })
        .optional(),
});
const validatePurchasenRestock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _s;
    const { outletId, id } = req.params;
    const { data: validateFields, error } = validatePurchaseSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.isPaid) && (validateFields === null || validateFields === void 0 ? void 0 : validateFields.paymentMethod) === undefined) {
        throw new bad_request_1.BadRequestsException("Please select your payment settlement mode", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.amountToBePaid) < 1) {
        throw new bad_request_1.BadRequestsException("You have selected IsPaid, Please Input the Amount you Paid", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = (_s = req.user) === null || _s === void 0 ? void 0 : _s.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findPurchase = yield __1.prismaDB.purchase.findFirst({
        where: {
            id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    });
    if (!(findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id)) {
        throw new not_found_1.NotFoundException("Purchase Not Found to Validate", root_1.ErrorCode.NOT_FOUND);
    }
    const findVendor = yield __1.prismaDB.vendor.findFirst({
        where: {
            restaurantId: outlet.id,
            id: validateFields.vendorId,
        },
    });
    if (!(findVendor === null || findVendor === void 0 ? void 0 : findVendor.id)) {
        throw new not_found_1.NotFoundException("Vendor Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const transaction = yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _t, _u, _v;
        // Step 1: Restock raw materials and update `RecipeIngredient` costs
        yield Promise.all((_t = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _t === void 0 ? void 0 : _t.map((item) => __awaiter(void 0, void 0, void 0, function* () {
            var _w, _x;
            const rawMaterial = yield prisma.rawMaterial.findFirst({
                where: {
                    id: item.rawMaterialId,
                    restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                },
                include: {
                    RecipeIngredient: true,
                },
            });
            if (rawMaterial) {
                console.log(`Raw Material Restocking started for ${rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.name}, the old stock is ${rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.currentStock}`);
                const newStock = Number((_w = rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.currentStock) !== null && _w !== void 0 ? _w : 0) + (item === null || item === void 0 ? void 0 : item.requestQuantity);
                console.log(`New Stock Calculated for ${rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.name}: ${newStock}`);
                const newPricePerItem = Number(item.totalRate) / Number(item.requestQuantity);
                console.log(`New Price Per Item Calculated for ${rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.name}: ${newPricePerItem}`);
                const updatedRawMaterial = yield prisma.rawMaterial.update({
                    where: {
                        id: rawMaterial.id,
                    },
                    data: {
                        currentStock: newStock,
                        purchasedPrice: item.totalRate,
                        purchasedPricePerItem: newPricePerItem,
                        purchasedUnit: item.unitName,
                        lastPurchasedPrice: (_x = rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.purchasedPrice) !== null && _x !== void 0 ? _x : 0,
                        purchasedStock: item.requestQuantity,
                    },
                });
                console.log(`Raw Material Restocking completed for ${rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.name}, updated raw material stock: ${updatedRawMaterial === null || updatedRawMaterial === void 0 ? void 0 : updatedRawMaterial.currentStock}`);
                // Update related alerts to resolved
                yield __1.prismaDB.alert.deleteMany({
                    where: {
                        restaurantId: outlet.id,
                        itemId: rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.id,
                        status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
                    },
                });
                const findRecipeIngredients = yield prisma.recipeIngredient.findFirst({
                    where: {
                        rawMaterialId: rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.id,
                    },
                });
                console.log(`finding recipe ingredients for ${rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.name}`);
                if (findRecipeIngredients) {
                    console.log(`recipe ingredients found for ${rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.name}`);
                    const recipeCostWithQuantity = Number(findRecipeIngredients === null || findRecipeIngredients === void 0 ? void 0 : findRecipeIngredients.quantity) /
                        Number(rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.conversionFactor);
                    console.log(`recipe cost with quantity for ${rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.name}: ${recipeCostWithQuantity}`);
                    const ingredientCost = recipeCostWithQuantity * newPricePerItem;
                    console.log(`ingredient cost for ${rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.name}: ${ingredientCost}`);
                    // Update linked `RecipeIngredient` cost
                    yield prisma.recipeIngredient.updateMany({
                        where: {
                            rawMaterialId: rawMaterial.id,
                        },
                        data: {
                            cost: ingredientCost,
                        },
                    });
                    console.log(`recipe ingredient updated for ${rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.name}`);
                }
            }
        })));
        console.log(`Raw Materials Restocking completed for all items`);
        // Step 2: Recalculate `ItemRecipe` gross margin and related fields
        const recipesToUpdate = yield prisma.itemRecipe.findMany({
            where: {
                restaurantId: outlet.id,
                ingredients: {
                    some: {
                        rawMaterial: {
                            restaurantId: outlet.id,
                            id: {
                                in: (_u = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _u === void 0 ? void 0 : _u.map((item) => item.rawMaterialId),
                            },
                        },
                    },
                },
            },
            include: {
                ingredients: {
                    include: {
                        rawMaterial: true,
                    },
                },
            },
        });
        console.log(`Recipes to update started for ${recipesToUpdate === null || recipesToUpdate === void 0 ? void 0 : recipesToUpdate.length} recipes`);
        yield Promise.all(recipesToUpdate.map((recipe) => __awaiter(void 0, void 0, void 0, function* () {
            console.log(`Recipe to update started for ${recipe === null || recipe === void 0 ? void 0 : recipe.name}`);
            const totalCost = recipe.ingredients.reduce((sum, ingredient) => {
                var _a, _b;
                return sum +
                    (Number(ingredient.quantity) /
                        Number((_a = ingredient === null || ingredient === void 0 ? void 0 : ingredient.rawMaterial) === null || _a === void 0 ? void 0 : _a.conversionFactor)) *
                        Number((_b = ingredient === null || ingredient === void 0 ? void 0 : ingredient.rawMaterial) === null || _b === void 0 ? void 0 : _b.purchasedPricePerItem);
            }, 0);
            console.log(`Total cost for ${recipe === null || recipe === void 0 ? void 0 : recipe.name}: ${totalCost}`);
            const grossMargin = Number(recipe.itemPrice) - totalCost;
            console.log(`Gross margin for ${recipe === null || recipe === void 0 ? void 0 : recipe.name}: ${grossMargin}`);
            yield prisma.itemRecipe.update({
                where: {
                    id: recipe.id,
                },
                data: {
                    itemCost: totalCost,
                    grossMargin,
                },
            });
            console.log(`Recipe updated for ${recipe === null || recipe === void 0 ? void 0 : recipe.name}`);
            // Update linked entities
            if (recipe.menuId) {
                yield prisma.menuItem.update({
                    where: {
                        id: recipe.menuId,
                        restaurantId: outlet.id,
                    },
                    data: {
                        grossProfit: grossMargin,
                    },
                });
                console.log(`Menu Item updated for ${recipe === null || recipe === void 0 ? void 0 : recipe.name}`);
            }
            if (recipe.menuVariantId) {
                yield prisma.menuItemVariant.update({
                    where: {
                        id: recipe.menuVariantId,
                        restaurantId: outlet.id,
                    },
                    data: {
                        grossProfit: grossMargin,
                    },
                });
            }
            if (recipe.addonItemVariantId) {
                yield prisma.addOnVariants.update({
                    where: {
                        id: recipe.addonItemVariantId,
                        restaurantId: outlet.id,
                    },
                    data: {
                        grossProfit: grossMargin,
                    },
                });
            }
        })));
        // Step 3: Update purchase details
        const updatePurchase = yield prisma.purchase.update({
            where: {
                id: findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id,
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
            data: {
                isPaid: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.paymentMethod) !== undefined,
                paymentMethod: validateFields === null || validateFields === void 0 ? void 0 : validateFields.paymentMethod,
                billImageUrl: validateFields === null || validateFields === void 0 ? void 0 : validateFields.billImage,
                invoiceType: validateFields === null || validateFields === void 0 ? void 0 : validateFields.chooseInvoice,
                purchaseStatus: "COMPLETED",
                purchaseItems: {
                    update: (_v = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _v === void 0 ? void 0 : _v.map((item) => ({
                        where: {
                            id: item === null || item === void 0 ? void 0 : item.id,
                            purchaseId: validateFields === null || validateFields === void 0 ? void 0 : validateFields.id,
                        },
                        data: {
                            purchasePrice: item === null || item === void 0 ? void 0 : item.totalRate,
                        },
                    })),
                },
            },
        });
        //register with cash register
        if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.isPaid) && validateFields.paymentMethod !== undefined) {
            yield prisma.expenses.create({
                data: {
                    restaurantId: outletId,
                    category: "Ingredients",
                    amount: validateFields === null || validateFields === void 0 ? void 0 : validateFields.amountToBePaid,
                    date: new Date(),
                    description: `${findVendor === null || findVendor === void 0 ? void 0 : findVendor.name} - Purchase (${findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.invoiceNo})`,
                    paymentMethod: validateFields === null || validateFields === void 0 ? void 0 : validateFields.paymentMethod,
                },
            });
        }
        return updatePurchase;
    }));
    if (transaction === null || transaction === void 0 ? void 0 : transaction.id) {
        ws_1.websocketManager.notifyClients(outletId, "NEW_ALERT");
        yield Promise.all([
            redis_1.redis.del(`${outletId}-purchases`),
            redis_1.redis.del(`${outletId}-stocks`),
            redis_1.redis.del(`${outletId}-vendors`),
            redis_1.redis.del(`${outletId}-raw-materials`),
            redis_1.redis.del(`alerts-${outletId}`),
        ]);
        return res.json({
            success: true,
            message: "Purchase Validated, Restocked, and Recipes Updated",
        });
    }
});
exports.validatePurchasenRestock = validatePurchasenRestock;
const getPurchaseId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const purchase = yield __1.prismaDB.purchase.findFirst({
        where: {
            id: id,
            restaurantId: outlet.id,
        },
        include: {
            purchaseItems: {
                include: {
                    purchaseUnit: true,
                    rawMaterial: true,
                },
            },
        },
    });
    if (!(purchase === null || purchase === void 0 ? void 0 : purchase.id)) {
        throw new not_found_1.NotFoundException("Purchased Conent Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    return res.json({
        success: true,
        purchase: purchase,
    });
});
exports.getPurchaseId = getPurchaseId;
const vendorFormSchema = zod_1.z.object({
    name: zod_1.z.string({ required_error: "Vendor name is required" }).min(1, {
        message: "Vendor name is required",
    }),
    categoryId: zod_1.z.string({ required_error: "Category is required" }).min(1, {
        message: "Category is required",
    }),
    contactName: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email("Invalid email").optional().or(zod_1.z.literal("")),
    isContract: zod_1.z.boolean().default(false),
    rawMaterials: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        rawMaterialId: zod_1.z
            .string()
            .min(1, { message: "Raw Material Is Required" }),
        rawMaterialName: zod_1.z.string().min(1, { message: "Raw Material Name" }),
        unitId: zod_1.z.string().min(1, { message: "Unit is Required" }),
        unitName: zod_1.z.string().min(1, { message: "Unit Name is required" }),
        netRate: zod_1.z.coerce
            .number({ required_error: "Rate is required" })
            .min(0.01, { message: "Rate must be greater than 0" }),
        gstType: zod_1.z.nativeEnum(client_1.GstType, {
            required_error: "GST Type is required",
        }),
        taxAmount: zod_1.z.coerce
            .number({ required_error: "Tax Amount is required" })
            .min(0, { message: "Tax amount must be positive" }),
        totalRate: zod_1.z.coerce
            .number({ required_error: "Total Rate is required" })
            .min(0, { message: "Rate must be positive" }),
        validFrom: zod_1.z.string(),
        validTo: zod_1.z.string(),
    }))
        .optional(),
});
const createVendor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _y;
    const { outletId } = req.params;
    const validateFields = vendorFormSchema.safeParse(req.body);
    if (!validateFields.success) {
        throw new bad_request_1.BadRequestsException(validateFields.error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const slugName = (0, utils_1.generateSlug)(validateFields.data.name);
    const findSlug = yield __1.prismaDB.vendor.findFirst({
        where: {
            slug: slugName,
            restaurantId: outlet.id,
        },
    });
    if (findSlug === null || findSlug === void 0 ? void 0 : findSlug.id) {
        throw new bad_request_1.BadRequestsException("Vendor Already Exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.vendor.create({
        data: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            name: validateFields.data.name,
            slug: slugName,
            categoryId: validateFields.data.categoryId,
            contactName: validateFields.data.contactName,
            phone: validateFields.data.phone,
            email: validateFields.data.email,
            isContract: validateFields.data.isContract,
            contractRates: {
                create: (_y = validateFields.data.rawMaterials) === null || _y === void 0 ? void 0 : _y.map((item) => ({
                    rawMaterialId: item.rawMaterialId,
                    rawMaterialName: item.rawMaterialName,
                    unitId: item.unitId,
                    unitName: item.unitName,
                    netRate: item.netRate,
                    gstType: item.gstType,
                    taxAmount: item.taxAmount,
                    totalRate: item.totalRate,
                    validFrom: new Date(item.validFrom),
                    validTo: new Date(item.validTo),
                })),
            },
        },
    });
    yield redis_1.redis.del(`${outlet.id}-vendors`);
    return res.json({
        success: true,
        message: "Vendor Created Success ✅",
    });
});
exports.createVendor = createVendor;
const updateVendor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _z;
    const { outletId, id } = req.params;
    const validateFields = vendorFormSchema.parse(req.body);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const vendor = yield __1.prismaDB.vendor.findFirst({
        where: {
            id: id,
            restaurantId: outlet.id,
        },
        include: {
            contractRates: {
                include: {
                    rawMaterial: true,
                    unit: true,
                },
            },
        },
    });
    if (!(vendor === null || vendor === void 0 ? void 0 : vendor.id)) {
        throw new not_found_1.NotFoundException("Vendor Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const slugName = (0, utils_1.generateSlug)(validateFields.name);
    if (slugName !== vendor.slug) {
        const findSlug = yield __1.prismaDB.vendor.findFirst({
            where: {
                slug: slugName,
                restaurantId: outlet.id,
            },
        });
        if (findSlug === null || findSlug === void 0 ? void 0 : findSlug.id) {
            throw new bad_request_1.BadRequestsException("Vendor Already Exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    const existingContractRates = vendor.contractRates.map((rate) => rate.id);
    const newContractRates = (_z = validateFields.rawMaterials) === null || _z === void 0 ? void 0 : _z.map((i) => i === null || i === void 0 ? void 0 : i.id).filter(Boolean);
    const deleteContractRates = existingContractRates.filter((id) => !(newContractRates === null || newContractRates === void 0 ? void 0 : newContractRates.includes(id)));
    yield __1.prismaDB.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _0;
        //update vendor
        yield tx.vendor.update({
            where: {
                id: vendor.id,
                restaurantId: outlet.id,
            },
            data: {
                name: validateFields.name,
                slug: slugName,
                categoryId: validateFields.categoryId,
                contactName: validateFields.contactName,
                phone: validateFields.phone,
                email: validateFields.email,
                isContract: validateFields.isContract,
            },
        });
        if (validateFields.isContract &&
            (validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) &&
            ((_0 = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _0 === void 0 ? void 0 : _0.length) > 0) {
            const contractRatesUpsert = validateFields.rawMaterials.map((item) => {
                return (item === null || item === void 0 ? void 0 : item.id)
                    ? tx.vendorContractRate.update({
                        where: {
                            id: item.id,
                            vendorId: vendor.id,
                        },
                        data: {
                            rawMaterialId: item.rawMaterialId,
                            rawMaterialName: item.rawMaterialName,
                            unitId: item.unitId,
                            unitName: item.unitName,
                            netRate: item.netRate,
                            gstType: item.gstType,
                            taxAmount: item.taxAmount,
                            totalRate: item.totalRate,
                            validFrom: new Date(item.validFrom),
                            validTo: new Date(item.validTo),
                        },
                    })
                    : tx.vendorContractRate.create({
                        data: {
                            vendorId: vendor.id,
                            rawMaterialId: item.rawMaterialId,
                            rawMaterialName: item.rawMaterialName,
                            unitId: item.unitId,
                            unitName: item.unitName,
                            netRate: item.netRate,
                            gstType: item.gstType,
                            taxAmount: item.taxAmount,
                            totalRate: item.totalRate,
                            validFrom: new Date(item.validFrom),
                            validTo: new Date(item.validTo),
                        },
                    });
            });
            yield Promise.all(contractRatesUpsert);
            if ((deleteContractRates === null || deleteContractRates === void 0 ? void 0 : deleteContractRates.length) > 0) {
                yield tx.vendorContractRate.deleteMany({
                    where: {
                        id: {
                            in: deleteContractRates,
                        },
                        vendorId: vendor.id,
                    },
                });
            }
        }
    }));
    yield redis_1.redis.del(`${outlet.id}-vendors`);
    return res.json({
        success: true,
        message: "Vendor Updated Success ✅",
    });
});
exports.updateVendor = updateVendor;
const deleteVendor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const vendor = yield __1.prismaDB.vendor.findFirst({
        where: {
            id: id,
            restaurantId: outlet.id,
        },
    });
    if (!(vendor === null || vendor === void 0 ? void 0 : vendor.id)) {
        throw new not_found_1.NotFoundException("Vendor Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.vendor.delete({
        where: {
            id: vendor.id,
            restaurantId: outlet.id,
        },
    });
    yield redis_1.redis.del(`${outlet.id}-vendors`);
    return res.json({
        success: true,
        message: "Vendor Deleted Success ✅",
    });
});
exports.deleteVendor = deleteVendor;
const getAllVendors = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisVendors = yield redis_1.redis.get(`${outletId}-vendors`);
    if (redisVendors) {
        return res.json({
            success: true,
            vendors: JSON.parse(redisVendors),
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const vendors = yield __1.prismaDB.vendor.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        include: {
            purchases: {
                include: {
                    purchaseItems: {
                        include: {
                            purchaseUnit: true,
                            rawMaterial: true,
                        },
                    },
                },
            },
            contractRates: {
                include: {
                    rawMaterial: true,
                    unit: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    yield redis_1.redis.set(`${outlet.id}-vendors`, JSON.stringify(vendors), "EX", 60 * 60 * 12 // 24 hours
    );
    return res.json({
        success: true,
        vednors: vendors,
        message: "Vendors Fetched ✅",
    });
});
exports.getAllVendors = getAllVendors;
const getAllVendorCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisVendorsCategories = yield redis_1.redis.get(`${outletId}-vendors-categories`);
    if (redisVendorsCategories) {
        return res.json({
            success: true,
            vendorsCategories: JSON.parse(redisVendorsCategories),
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const vendorsCategories = yield __1.prismaDB.vendorCategory.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        select: {
            id: true,
            name: true,
        },
    });
    yield redis_1.redis.set(`${outlet.id}-vendors-categories`, JSON.stringify(vendorsCategories), "EX", 60 * 60 * 24 // 24 hours
    );
    return res.json({
        success: true,
        vendorsCategories: vendorsCategories,
        message: "Vendors Categories Fetched ✅",
    });
});
exports.getAllVendorCategories = getAllVendorCategories;
const vendorCategoryFormSchema = zod_1.z.object({
    name: zod_1.z
        .string({
        required_error: "Name is required",
    })
        .min(1, {
        message: "Name is required",
    }),
});
const createVendorCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const validateFields = vendorCategoryFormSchema.safeParse(req.body);
    if (!validateFields.success) {
        throw new bad_request_1.BadRequestsException(validateFields.error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const slugName = (0, utils_1.generateSlug)(validateFields.data.name);
    const findSlug = yield __1.prismaDB.vendorCategory.findFirst({
        where: {
            slug: slugName,
            restaurantId: outlet.id,
        },
    });
    if (findSlug === null || findSlug === void 0 ? void 0 : findSlug.id) {
        throw new bad_request_1.BadRequestsException("Vendor Category Already Exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.vendorCategory.create({
        data: {
            restaurantId: outlet.id,
            name: validateFields.data.name,
            slug: slugName,
        },
    });
    yield redis_1.redis.del(`${outlet.id}-vendors-categories`);
    return res.json({
        success: true,
        message: "Vendor Category Created Successfully",
    });
});
exports.createVendorCategory = createVendorCategory;
const allStocks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const redisStocks = yield redis_1.redis.get(`${outletId}-stocks`);
    if (redisStocks) {
        return res.json({
            success: true,
            stocks: JSON.parse(redisStocks),
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const rawMaterials = yield __1.prismaDB.rawMaterial.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        include: {
            rawMaterialCategory: true,
            consumptionUnit: true,
            minimumStockUnit: true,
        },
    });
    const formattedStocks = rawMaterials === null || rawMaterials === void 0 ? void 0 : rawMaterials.map((rawItem) => {
        var _a, _b, _c, _d;
        return ({
            id: rawItem === null || rawItem === void 0 ? void 0 : rawItem.id,
            name: rawItem === null || rawItem === void 0 ? void 0 : rawItem.name,
            consumptionUnit: rawItem.consumptionUnit.name,
            stock: `${(_a = rawItem.currentStock) === null || _a === void 0 ? void 0 : _a.toFixed(2)} - ${rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedUnit}`,
            minStockLevel: `${(_b = rawItem === null || rawItem === void 0 ? void 0 : rawItem.minimumStockLevel) === null || _b === void 0 ? void 0 : _b.toFixed(2)} - ${(_c = rawItem === null || rawItem === void 0 ? void 0 : rawItem.minimumStockUnit) === null || _c === void 0 ? void 0 : _c.name}`,
            purchasedPrice: rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedPrice,
            lastPurchasedPrice: rawItem === null || rawItem === void 0 ? void 0 : rawItem.lastPurchasedPrice,
            purchasedPricePerItem: rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedPricePerItem,
            purchasedStock: `${(_d = rawItem.currentStock) === null || _d === void 0 ? void 0 : _d.toFixed(2)} - ${rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedUnit}`,
            createdAt: rawItem.createdAt,
        });
    });
    yield redis_1.redis.set(`${outletId}-stocks`, JSON.stringify(formattedStocks), "EX", 60 * 60 * 12 // 12 hours
    );
    return res.json({
        success: true,
        stocks: formattedStocks,
    });
});
exports.allStocks = allStocks;
const recipeSchema = zod_1.z.object({
    recipeType: zod_1.z.enum(["RECIPE", "PREP_RECIPE"], {
        invalid_type_error: "invalid type",
        required_error: "Need to select your recipe type",
    }),
    recipeFor: zod_1.z.enum(["MENU_ITEMS", "MENU_VARIANTS", "ADD_ONS"], {
        invalid_type_error: "invalid type",
        required_error: "Need to select your recipe For",
    }),
    itemId: zod_1.z.string({
        invalid_type_error: "itemId should be a string",
        required_error: "you need to select an Item",
    }),
    ingredients: zod_1.z
        .array(zod_1.z.object({
        ingredientId: zod_1.z.string().optional(),
        rawMaterialId: zod_1.z.string({
            invalid_type_error: "rawMaterial should be a string",
            required_error: "you need to select a ingredient",
        }),
        mou: zod_1.z.string({
            invalid_type_error: "Quantity should be a string",
            required_error: "quantity is required",
        }),
        quantity: zod_1.z.coerce.number({
            invalid_type_error: "Quantity should be a number",
            required_error: "quantity is required",
        }),
        wastage: zod_1.z.coerce.number({
            invalid_type_error: "Wastage should be a number",
            required_error: "Wastage is required",
        }),
        cost: zod_1.z.coerce.number({
            invalid_type_error: "Cost should be a number",
            required_error: "Cost is required",
        }),
    }))
        .min(1, {
        message: "You need at aleast one ingredients to prepare recipe",
    }),
    totalCost: zod_1.z.coerce.number({
        invalid_type_error: "Total Cost should be a string",
        required_error: "Total Cost is required",
    }),
    itemCost: zod_1.z.coerce.number({
        invalid_type_error: "Item Cost should be a string",
        required_error: "Item Cost is required",
    }),
    grossProfit: zod_1.z.coerce.number({
        invalid_type_error: "Gross profit should be a string",
        required_error: "Gross profit is required",
    }),
});
const createItemRecipe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _1, _2, _3, _4, _5, _6, _7, _8, _9, _10;
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    const userId = (_1 = req === null || req === void 0 ? void 0 : req.user) === null || _1 === void 0 ? void 0 : _1.id;
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findUser = yield __1.prismaDB.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const validateFields = recipeSchema.parse(req.body);
    const menuItems = yield __1.prismaDB.menuItem.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        select: {
            id: true,
            name: true,
        },
    });
    const menuVariants = yield __1.prismaDB.menuItemVariant.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        select: {
            variant: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });
    const addOns = yield __1.prismaDB.addOnVariants.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        select: {
            id: true,
            name: true,
        },
    });
    const slugName = (validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor) === "MENU_ITEMS"
        ? (_2 = menuItems === null || menuItems === void 0 ? void 0 : menuItems.find((item) => (item === null || item === void 0 ? void 0 : item.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId))) === null || _2 === void 0 ? void 0 : _2.name
        : (validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor) === "MENU_VARIANTS"
            ? (_4 = (_3 = menuVariants === null || menuVariants === void 0 ? void 0 : menuVariants.find((variant) => { var _a; return ((_a = variant === null || variant === void 0 ? void 0 : variant.variant) === null || _a === void 0 ? void 0 : _a.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId); })) === null || _3 === void 0 ? void 0 : _3.variant) === null || _4 === void 0 ? void 0 : _4.name
            : (_5 = addOns === null || addOns === void 0 ? void 0 : addOns.find((addOn) => (addOn === null || addOn === void 0 ? void 0 : addOn.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId))) === null || _5 === void 0 ? void 0 : _5.name;
    const itemRecipe = yield __1.prismaDB.itemRecipe.create({
        data: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            recipeFor: validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor,
            recipeType: validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeType,
            createdBy: `${findUser === null || findUser === void 0 ? void 0 : findUser.name} (${findUser === null || findUser === void 0 ? void 0 : findUser.role})`,
            lastModifiedBy: `${findUser === null || findUser === void 0 ? void 0 : findUser.name} (${findUser === null || findUser === void 0 ? void 0 : findUser.role})`,
            name: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor) === "MENU_ITEMS"
                ? (_6 = menuItems === null || menuItems === void 0 ? void 0 : menuItems.find((item) => (item === null || item === void 0 ? void 0 : item.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId))) === null || _6 === void 0 ? void 0 : _6.name
                : (validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor) === "MENU_VARIANTS"
                    ? (_8 = (_7 = menuVariants === null || menuVariants === void 0 ? void 0 : menuVariants.find((variant) => { var _a; return ((_a = variant === null || variant === void 0 ? void 0 : variant.variant) === null || _a === void 0 ? void 0 : _a.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId); })) === null || _7 === void 0 ? void 0 : _7.variant) === null || _8 === void 0 ? void 0 : _8.name
                    : (_9 = addOns === null || addOns === void 0 ? void 0 : addOns.find((addOn) => (addOn === null || addOn === void 0 ? void 0 : addOn.id) === (validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId))) === null || _9 === void 0 ? void 0 : _9.name,
            slug: (0, utils_1.generateSlug)(slugName),
            menuId: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor) === "MENU_ITEMS"
                ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId
                : undefined,
            menuVariantId: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor) === "MENU_VARIANTS"
                ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId
                : undefined,
            addonItemVariantId: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor) === "ADD_ONS"
                ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId
                : undefined,
            ingredients: {
                create: (_10 = validateFields === null || validateFields === void 0 ? void 0 : validateFields.ingredients) === null || _10 === void 0 ? void 0 : _10.map((ingredient) => ({
                    rawMaterialId: ingredient === null || ingredient === void 0 ? void 0 : ingredient.rawMaterialId,
                    quantity: ingredient === null || ingredient === void 0 ? void 0 : ingredient.quantity,
                    wastage: ingredient === null || ingredient === void 0 ? void 0 : ingredient.wastage,
                    cost: ingredient === null || ingredient === void 0 ? void 0 : ingredient.cost,
                    unitId: ingredient === null || ingredient === void 0 ? void 0 : ingredient.mou,
                })),
            },
            grossMargin: validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfit,
            itemCost: validateFields === null || validateFields === void 0 ? void 0 : validateFields.totalCost,
            itemPrice: validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemCost,
        },
    });
    if (validateFields.recipeFor === "MENU_ITEMS" && validateFields.itemId) {
        yield __1.prismaDB.menuItem.update({
            where: {
                id: validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId,
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
            data: {
                chooseProfit: "itemRecipe",
                grossProfitPer: null,
                grossProfitType: null,
                itemRecipeId: itemRecipe === null || itemRecipe === void 0 ? void 0 : itemRecipe.id,
                grossProfit: validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfit,
            },
        });
    }
    if (validateFields.recipeFor === "MENU_VARIANTS" && validateFields.itemId) {
        yield __1.prismaDB.menuItemVariant.update({
            where: {
                id: validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId,
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
            data: {
                chooseProfit: "itemRecipe",
                grossProfitPer: null,
                grossProfitType: null,
                itemRecipeId: itemRecipe === null || itemRecipe === void 0 ? void 0 : itemRecipe.id,
                grossProfit: validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfit,
            },
        });
    }
    if (validateFields.recipeFor === "ADD_ONS" && validateFields.itemId) {
        yield __1.prismaDB.addOnVariants.update({
            where: {
                id: validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId,
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
            data: {
                chooseProfit: "itemRecipe",
                grossProfitPer: null,
                grossProfitType: null,
                itemRecipeId: itemRecipe === null || itemRecipe === void 0 ? void 0 : itemRecipe.id,
                grossProfit: validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfit,
            },
        });
    }
    yield (0, get_items_1.getOAllItems)(outlet.id);
    return res.json({
        success: true,
        message: "Item Created",
    });
});
exports.createItemRecipe = createItemRecipe;
const updateItemRecipe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _11;
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    const userId = (_11 = req === null || req === void 0 ? void 0 : req.user) === null || _11 === void 0 ? void 0 : _11.id;
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findUser = yield __1.prismaDB.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const findRecipe = yield __1.prismaDB.itemRecipe.findFirst({
        where: {
            id: id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        include: {
            ingredients: true,
        },
    });
    if (!findRecipe) {
        throw new not_found_1.NotFoundException("Recipe Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const validateFields = recipeSchema.parse(req.body);
    // Prepare ingredient operations
    const existingIngredientIds = findRecipe.ingredients.map((ing) => ing.id);
    const incomingIngredientIds = validateFields.ingredients
        .map((ing) => ing.ingredientId)
        .filter(Boolean);
    // Determine ingredients to delete (those in existing but not in incoming)
    const ingredientsToDelete = existingIngredientIds.filter((id) => !incomingIngredientIds.includes(id));
    // Prepare transaction for atomic update
    yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _12;
        // Main recipe update
        yield prisma.itemRecipe.update({
            where: {
                id: findRecipe.id,
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
            data: {
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                recipeFor: validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor,
                recipeType: validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeType,
                lastModifiedBy: `${findUser === null || findUser === void 0 ? void 0 : findUser.name} (${findUser === null || findUser === void 0 ? void 0 : findUser.role})`,
                menuId: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor) === "MENU_ITEMS"
                    ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId
                    : null,
                menuVariantId: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor) === "MENU_VARIANTS"
                    ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId
                    : null,
                addonItemVariantId: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor) === "ADD_ONS"
                    ? validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId
                    : null,
                grossMargin: validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfit,
                itemCost: validateFields === null || validateFields === void 0 ? void 0 : validateFields.totalCost,
                itemPrice: validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemCost,
            },
        });
        if (validateFields.recipeFor === "MENU_ITEMS" && validateFields.itemId) {
            yield prisma.menuItem.update({
                where: {
                    id: validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId,
                    restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                },
                data: {
                    chooseProfit: "itemRecipe",
                    grossProfitPer: null,
                    grossProfitType: null,
                    itemRecipeId: findRecipe === null || findRecipe === void 0 ? void 0 : findRecipe.id,
                    grossProfit: validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfit,
                },
            });
        }
        if (validateFields.recipeFor === "MENU_VARIANTS" && validateFields.itemId) {
            yield prisma.menuItemVariant.update({
                where: {
                    id: validateFields === null || validateFields === void 0 ? void 0 : validateFields.itemId,
                    restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                },
                data: {
                    chooseProfit: "itemRecipe",
                    grossProfitPer: null,
                    grossProfitType: null,
                    itemRecipeId: findRecipe === null || findRecipe === void 0 ? void 0 : findRecipe.id,
                    grossProfit: validateFields === null || validateFields === void 0 ? void 0 : validateFields.grossProfit,
                },
            });
        }
        // Handle ingredient updates in a single operation
        if (((_12 = validateFields === null || validateFields === void 0 ? void 0 : validateFields.ingredients) === null || _12 === void 0 ? void 0 : _12.length) > 0) {
            // Perform upsert operations for ingredients
            const ingredientUpserts = validateFields.ingredients.map((ingredient) => {
                // If ingredientId exists, it's an update. Otherwise, it's a create
                return ingredient.ingredientId
                    ? prisma.recipeIngredient.update({
                        where: {
                            id: ingredient.ingredientId,
                            recipeId: findRecipe.id,
                        },
                        data: {
                            rawMaterialId: ingredient.rawMaterialId,
                            quantity: ingredient.quantity,
                            wastage: ingredient.wastage,
                            cost: ingredient.cost,
                            unitId: ingredient.mou,
                        },
                    })
                    : prisma.recipeIngredient.create({
                        data: {
                            recipeId: findRecipe.id,
                            rawMaterialId: ingredient.rawMaterialId,
                            quantity: ingredient.quantity,
                            wastage: ingredient.wastage,
                            cost: ingredient.cost,
                            unitId: ingredient.mou,
                        },
                    });
            });
            // Execute all upsert operations
            yield Promise.all(ingredientUpserts);
        }
        // Delete ingredients that are no longer in the recipe
        if (ingredientsToDelete.length > 0) {
            yield prisma.recipeIngredient.deleteMany({
                where: {
                    id: { in: ingredientsToDelete },
                    recipeId: findRecipe.id,
                },
            });
        }
    }));
    yield (0, get_items_1.getOAllItems)(outlet.id);
    return res.json({
        success: true,
        message: "Recipe Updated",
    });
});
exports.updateItemRecipe = updateItemRecipe;
const getAllItemRecipe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getRecipes = yield __1.prismaDB.itemRecipe.findMany({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        include: {
            addOnItemVariant: true,
            ingredients: {
                include: {
                    rawMaterial: true,
                    unit: true,
                },
            },
            menuItem: true,
            menuItemVariant: {
                include: {
                    menuItem: true,
                    variant: true,
                },
            },
        },
    });
    const formattedRecipes = getRecipes === null || getRecipes === void 0 ? void 0 : getRecipes.map((item) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return ({
            id: item === null || item === void 0 ? void 0 : item.id,
            recipeType: item === null || item === void 0 ? void 0 : item.recipeType,
            recipeFor: item === null || item === void 0 ? void 0 : item.recipeFor,
            itemId: (item === null || item === void 0 ? void 0 : item.recipeFor) === "MENU_ITEMS"
                ? item === null || item === void 0 ? void 0 : item.menuId
                : (item === null || item === void 0 ? void 0 : item.recipeFor) === "MENU_VARIANTS"
                    ? item === null || item === void 0 ? void 0 : item.menuVariantId
                    : item === null || item === void 0 ? void 0 : item.addonItemVariantId,
            name: (item === null || item === void 0 ? void 0 : item.recipeFor) === "MENU_ITEMS"
                ? (_b = (_a = item === null || item === void 0 ? void 0 : item.menuItem) === null || _a === void 0 ? void 0 : _a.find((me) => (me === null || me === void 0 ? void 0 : me.id) === (item === null || item === void 0 ? void 0 : item.menuId))) === null || _b === void 0 ? void 0 : _b.name
                : (item === null || item === void 0 ? void 0 : item.recipeFor) === "MENU_VARIANTS"
                    ? `${(_e = (_d = (_c = item === null || item === void 0 ? void 0 : item.menuItemVariant) === null || _c === void 0 ? void 0 : _c.find((v) => v.id === (item === null || item === void 0 ? void 0 : item.menuVariantId))) === null || _d === void 0 ? void 0 : _d.menuItem) === null || _e === void 0 ? void 0 : _e.name} - ${(_h = (_g = (_f = item === null || item === void 0 ? void 0 : item.menuItemVariant) === null || _f === void 0 ? void 0 : _f.find((v) => v.id === (item === null || item === void 0 ? void 0 : item.menuVariantId))) === null || _g === void 0 ? void 0 : _g.variant) === null || _h === void 0 ? void 0 : _h.name}`
                    : (_k = (_j = item === null || item === void 0 ? void 0 : item.addOnItemVariant) === null || _j === void 0 ? void 0 : _j.find((a) => a.id === (item === null || item === void 0 ? void 0 : item.addonItemVariantId))) === null || _k === void 0 ? void 0 : _k.name,
            grossMargin: item === null || item === void 0 ? void 0 : item.grossMargin,
            itemPrice: item === null || item === void 0 ? void 0 : item.itemPrice,
            itemCost: item === null || item === void 0 ? void 0 : item.itemCost,
            ingredients: item === null || item === void 0 ? void 0 : item.ingredients.map((ing) => {
                var _a, _b;
                return ({
                    id: ing === null || ing === void 0 ? void 0 : ing.id,
                    rawMaterialId: ing === null || ing === void 0 ? void 0 : ing.rawMaterialId,
                    rawMaterialName: (_a = ing === null || ing === void 0 ? void 0 : ing.rawMaterial) === null || _a === void 0 ? void 0 : _a.name,
                    unitId: ing === null || ing === void 0 ? void 0 : ing.unitId,
                    unitName: (_b = ing === null || ing === void 0 ? void 0 : ing.unit) === null || _b === void 0 ? void 0 : _b.name,
                    wastage: ing === null || ing === void 0 ? void 0 : ing.wastage,
                    cost: ing === null || ing === void 0 ? void 0 : ing.cost,
                    quanity: ing === null || ing === void 0 ? void 0 : ing.quantity,
                });
            }),
            createdBy: item.createdBy,
            createdAt: item === null || item === void 0 ? void 0 : item.createdAt,
        });
    });
    return res.json({
        success: true,
        recipes: formattedRecipes,
    });
});
exports.getAllItemRecipe = getAllItemRecipe;
const getRecipeById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const findRecipe = yield __1.prismaDB.itemRecipe.findFirst({
        where: {
            id: id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
        include: {
            ingredients: true,
        },
    });
    if (!findRecipe) {
        throw new not_found_1.NotFoundException("Recipe Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    return res.json({ success: true, recipe: findRecipe });
});
exports.getRecipeById = getRecipeById;
const restockPurchase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _13;
    const { outletId, id } = req.params;
    const { data: validateFields, error } = validatePurchaseSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = (_13 = req.user) === null || _13 === void 0 ? void 0 : _13.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findPurchase = yield __1.prismaDB.purchase.findFirst({
        where: {
            id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    });
    if (!(findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id)) {
        throw new not_found_1.NotFoundException("Purchase Not Found to Validate", root_1.ErrorCode.NOT_FOUND);
    }
    const findVendor = yield __1.prismaDB.vendor.findFirst({
        where: {
            restaurantId: outlet.id,
            id: validateFields.vendorId,
        },
    });
    if (!(findVendor === null || findVendor === void 0 ? void 0 : findVendor.id)) {
        throw new not_found_1.NotFoundException("Vendor Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const transaction = yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _14, _15, _16;
        // Step 1: Restock raw materials and update `RecipeIngredient` costs
        console.log(`Restock for raw Materiasls Inititated`);
        yield Promise.all((_14 = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _14 === void 0 ? void 0 : _14.map((item) => __awaiter(void 0, void 0, void 0, function* () {
            var _17, _18;
            console.log(`Restock for raw Material ${item.rawMaterialName} Inititated`);
            const rawMaterial = yield prisma.rawMaterial.findFirst({
                where: {
                    id: item.rawMaterialId,
                    restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                },
                include: {
                    RecipeIngredient: true,
                },
            });
            if (rawMaterial) {
                console.log(`Raw Material ${item.rawMaterialName} Found, old stock is ${rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.currentStock}`);
                const newStock = Number((_17 = rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.currentStock) !== null && _17 !== void 0 ? _17 : 0) + (item === null || item === void 0 ? void 0 : item.requestQuantity);
                console.log(`New Stock for ${item.rawMaterialName} is ${newStock}`);
                const newPricePerItem = Number(item.totalRate) / Number(item.requestQuantity);
                console.log(`New Price per item for ${item.rawMaterialName} is ${newPricePerItem}`);
                const updateStock = yield prisma.rawMaterial.update({
                    where: {
                        id: rawMaterial.id,
                    },
                    data: {
                        currentStock: newStock,
                        purchasedPrice: item.totalRate,
                        purchasedPricePerItem: newPricePerItem,
                        purchasedUnit: item.unitName,
                        lastPurchasedPrice: (_18 = rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.purchasedPrice) !== null && _18 !== void 0 ? _18 : 0,
                        purchasedStock: item.requestQuantity,
                    },
                });
                console.log(`Stock for ${item.rawMaterialName} updated to ${updateStock === null || updateStock === void 0 ? void 0 : updateStock.currentStock}`);
                // Update related alerts to resolved
                yield __1.prismaDB.alert.deleteMany({
                    where: {
                        restaurantId: outlet.id,
                        itemId: rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.id,
                        status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
                    },
                });
                console.log(`Alerts for ${item.rawMaterialName} resolved`);
                const findRecipeIngredients = yield prisma.recipeIngredient.findFirst({
                    where: {
                        rawMaterialId: rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.id,
                    },
                });
                console.log(`findRecipeIngredients for ${item.rawMaterialName} is ${findRecipeIngredients === null || findRecipeIngredients === void 0 ? void 0 : findRecipeIngredients.id}`);
                if (findRecipeIngredients) {
                    const recipeCostWithQuantity = Number(findRecipeIngredients === null || findRecipeIngredients === void 0 ? void 0 : findRecipeIngredients.quantity) /
                        Number(rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.conversionFactor);
                    console.log(`recipeCostWithQuantity for ${item.rawMaterialName} is ${recipeCostWithQuantity}`);
                    const ingredientCost = recipeCostWithQuantity * newPricePerItem;
                    console.log(`ingredientCost for ${item.rawMaterialName} is ${ingredientCost}`);
                    // Update linked `RecipeIngredient` cost
                    yield prisma.recipeIngredient.updateMany({
                        where: {
                            rawMaterialId: rawMaterial.id,
                        },
                        data: {
                            cost: ingredientCost,
                        },
                    });
                    console.log(`RecipeIngredient for ${item.rawMaterialName} updated`);
                }
            }
        })));
        // Step 2: Recalculate `ItemRecipe` gross margin and related fields
        console.log(`Recalculate ItemRecipe gross margin and related fields Inititated`);
        const recipesToUpdate = yield prisma.itemRecipe.findMany({
            where: {
                restaurantId: outlet.id,
                ingredients: {
                    some: {
                        rawMaterial: {
                            restaurantId: outlet.id,
                            id: {
                                in: (_15 = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _15 === void 0 ? void 0 : _15.map((item) => item.rawMaterialId),
                            },
                        },
                    },
                },
            },
            include: {
                ingredients: {
                    include: {
                        rawMaterial: true,
                    },
                },
            },
        });
        console.log(`Recipes to update found ${recipesToUpdate.length}`);
        yield Promise.all(recipesToUpdate.map((recipe) => __awaiter(void 0, void 0, void 0, function* () {
            console.log(`Updating recipe ${recipe.name}`);
            const totalCost = recipe.ingredients.reduce((sum, ingredient) => {
                var _a, _b;
                return sum +
                    (Number(ingredient.quantity) /
                        Number((_a = ingredient === null || ingredient === void 0 ? void 0 : ingredient.rawMaterial) === null || _a === void 0 ? void 0 : _a.conversionFactor)) *
                        Number((_b = ingredient === null || ingredient === void 0 ? void 0 : ingredient.rawMaterial) === null || _b === void 0 ? void 0 : _b.purchasedPricePerItem);
            }, 0);
            console.log(`Total cost for ${recipe.name} is ${totalCost}`);
            const grossMargin = Number(recipe.itemPrice) - totalCost;
            console.log(`Gross margin for ${recipe.name} is ${grossMargin}`);
            yield prisma.itemRecipe.update({
                where: {
                    id: recipe.id,
                },
                data: {
                    itemCost: totalCost,
                    grossMargin,
                },
            });
            console.log(`Recipe ${recipe.name} updated`);
            // Update linked entities
            if (recipe === null || recipe === void 0 ? void 0 : recipe.menuId) {
                console.log(`Updating menu item ${recipe.name}`);
                yield prisma.menuItem.update({
                    where: {
                        id: recipe.menuId,
                        restaurantId: outlet.id,
                    },
                    data: {
                        grossProfit: grossMargin,
                    },
                });
            }
            if (recipe.menuVariantId) {
                console.log(`Updating menu variant ${recipe.name}`);
                yield prisma.menuItemVariant.update({
                    where: {
                        id: recipe.menuVariantId,
                        restaurantId: outlet.id,
                    },
                    data: {
                        grossProfit: grossMargin,
                    },
                });
            }
            if (recipe.addonItemVariantId) {
                console.log(`Updating addon variant ${recipe.name}`);
                yield prisma.addOnVariants.update({
                    where: {
                        id: recipe.addonItemVariantId,
                        restaurantId: outlet.id,
                    },
                    data: {
                        grossProfit: grossMargin,
                    },
                });
            }
        })));
        console.log(`All recipes updated`);
        // Step 3: Update purchase details
        console.log(`Updating purchase details`);
        const updatePurchase = yield prisma.purchase.update({
            where: {
                id: findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id,
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
            data: {
                isPaid: (validateFields === null || validateFields === void 0 ? void 0 : validateFields.paymentMethod) !== undefined,
                paymentMethod: validateFields === null || validateFields === void 0 ? void 0 : validateFields.paymentMethod,
                billImageUrl: validateFields === null || validateFields === void 0 ? void 0 : validateFields.billImage,
                invoiceType: validateFields === null || validateFields === void 0 ? void 0 : validateFields.chooseInvoice,
                purchaseStatus: "SETTLEMENT",
                purchaseItems: {
                    update: (_16 = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _16 === void 0 ? void 0 : _16.map((item) => ({
                        where: {
                            id: item === null || item === void 0 ? void 0 : item.id,
                            purchaseId: validateFields === null || validateFields === void 0 ? void 0 : validateFields.id,
                        },
                        data: {
                            purchasePrice: item === null || item === void 0 ? void 0 : item.totalRate,
                        },
                    })),
                },
            },
        });
        return updatePurchase;
    }));
    if (transaction === null || transaction === void 0 ? void 0 : transaction.id) {
        yield Promise.all([
            redis_1.redis.del(`${outletId}-stocks`),
            redis_1.redis.del(`${outletId}-vendors`),
            redis_1.redis.del(`${outletId}-raw-materials`),
            redis_1.redis.del(`${outletId}-purchases`),
            redis_1.redis.del(`alerts-${outletId}`),
        ]);
        ws_1.websocketManager.notifyClients(outletId, "NEW_ALERT");
        return res.json({
            success: true,
            message: "Purchase Settlement Pending & Stock Restocked,Recipes Updated",
        });
    }
});
exports.restockPurchase = restockPurchase;
const settleFormSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, { message: "Purchase Id Missing" }),
    vendorId: zod_1.z.string().min(1, { message: "Vendor is Missing" }),
    rawMaterials: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string().min(1, { message: "Purchase Item Id is missing" }),
        rawMaterialId: zod_1.z
            .string()
            .min(1, { message: "Raw Material Is Required" }),
        rawMaterialName: zod_1.z.string().min(1, { message: "Raw Material Name" }),
        unitName: zod_1.z.string().min(1, { message: "Unit Name is required" }),
        requestUnitId: zod_1.z
            .string()
            .min(1, { message: "Request Unit is Required" }),
        requestQuantity: zod_1.z.coerce
            .number()
            .min(1, { message: "Request Quantity is Required" }),
        gstType: zod_1.z.nativeEnum(client_1.GstType, {
            required_error: "GST Type is Required",
        }),
        netRate: zod_1.z.coerce.number(),
        taxAmount: zod_1.z.coerce.number(),
        total: zod_1.z.coerce
            .number()
            .min(0, { message: "Purchase price is required" }),
    }))
        .min(1, { message: "Atleast 1 Raw Material you need to request" }),
    isPaid: zod_1.z.boolean({ required_error: "You need to choose" }),
    billImage: zod_1.z.string().optional(),
    amountToBePaid: zod_1.z.coerce.number().min(0, { message: "Amount Required" }),
    chooseInvoice: zod_1.z
        .enum(["generateInvoice", "uploadInvoice"], {
        required_error: "You need to select a invoice type.",
    })
        .optional(),
    paymentMethod: zod_1.z.enum(["CASH", "UPI", "DEBIT", "CREDIT"], {
        required_error: "Settlement Payment Method Required.",
    }),
});
const settlePayForRaisedPurchase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _19;
    const { outletId, id } = req.params;
    const { data: validateFields, error } = settleFormSchema.safeParse(req.body);
    console.log("Amount to be paid", validateFields);
    if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.amountToBePaid) === undefined ||
        (validateFields === null || validateFields === void 0 ? void 0 : validateFields.amountToBePaid) < 1) {
        throw new bad_request_1.BadRequestsException("Amount Paid must be equal to the purchase amount", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.isPaid) && (validateFields === null || validateFields === void 0 ? void 0 : validateFields.paymentMethod) === undefined) {
        throw new bad_request_1.BadRequestsException("Please select your payment settlement mode", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = (_19 = req.user) === null || _19 === void 0 ? void 0 : _19.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findPurchase = yield __1.prismaDB.purchase.findFirst({
        where: {
            id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    });
    if (!(findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id)) {
        throw new not_found_1.NotFoundException("Purchase Not Found to Validate", root_1.ErrorCode.NOT_FOUND);
    }
    const findVendor = yield __1.prismaDB.vendor.findFirst({
        where: {
            restaurantId: outlet.id,
            id: validateFields.vendorId,
        },
    });
    if (!(findVendor === null || findVendor === void 0 ? void 0 : findVendor.id)) {
        throw new not_found_1.NotFoundException("Vendor Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const transaction = yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        // Step 3: Update purchase details
        const updatePurchase = yield prisma.purchase.update({
            where: {
                id: findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id,
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
            data: {
                isPaid: validateFields === null || validateFields === void 0 ? void 0 : validateFields.isPaid,
                paymentMethod: validateFields === null || validateFields === void 0 ? void 0 : validateFields.paymentMethod,
                billImageUrl: validateFields === null || validateFields === void 0 ? void 0 : validateFields.billImage,
                invoiceType: validateFields === null || validateFields === void 0 ? void 0 : validateFields.chooseInvoice,
                totalAmount: validateFields === null || validateFields === void 0 ? void 0 : validateFields.amountToBePaid,
                purchaseStatus: "COMPLETED",
            },
        });
        return updatePurchase;
    }));
    if (transaction === null || transaction === void 0 ? void 0 : transaction.id) {
        // Step 4: Refresh Redis cache
        yield Promise.all([
            redis_1.redis.del(`${outletId}-stocks`),
            redis_1.redis.del(`${outletId}-purchases`),
            redis_1.redis.del(`${outletId}-raw-materials`),
        ]);
        return res.json({
            success: true,
            message: "Purchase Settlement Pending & Stock Restocked,Recipes Updated",
        });
    }
});
exports.settlePayForRaisedPurchase = settlePayForRaisedPurchase;
const updateStockRawMaterial = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _20;
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = (_20 = req.user) === null || _20 === void 0 ? void 0 : _20.id;
    const { stock } = req === null || req === void 0 ? void 0 : req.body;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findRawMaterial = yield __1.prismaDB.rawMaterial.findFirst({
        where: {
            id: id,
        },
    });
    if (!(findRawMaterial === null || findRawMaterial === void 0 ? void 0 : findRawMaterial.id)) {
        throw new not_found_1.NotFoundException("Raw Material / Stock not found", root_1.ErrorCode.NOT_FOUND);
    }
    if ((findRawMaterial === null || findRawMaterial === void 0 ? void 0 : findRawMaterial.purchasedStock) &&
        stock > (findRawMaterial === null || findRawMaterial === void 0 ? void 0 : findRawMaterial.purchasedStock)) {
        throw new bad_request_1.BadRequestsException("You cannot update the stock to a value greater than the last purchased stock", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.rawMaterial.update({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            id: findRawMaterial === null || findRawMaterial === void 0 ? void 0 : findRawMaterial.id,
        },
        data: {
            currentStock: stock !== null && stock !== void 0 ? stock : findRawMaterial === null || findRawMaterial === void 0 ? void 0 : findRawMaterial.currentStock,
        },
    });
    // Update related alerts to resolved
    yield __1.prismaDB.alert.deleteMany({
        where: {
            restaurantId: outlet.id,
            itemId: findRawMaterial === null || findRawMaterial === void 0 ? void 0 : findRawMaterial.id,
            status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
        },
    });
    ws_1.websocketManager.notifyClients(outletId, "NEW_ALERT");
    yield redis_1.redis.del(`alerts-${outletId}`);
    yield (0, get_inventory_1.getfetchOutletStocksToRedis)(outletId);
    return res.json({
        success: true,
        message: "Stock Updated",
    });
});
exports.updateStockRawMaterial = updateStockRawMaterial;
const getAllTableRawMaterials = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.rawMaterial.count({
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const rawMaterials = yield __1.prismaDB.rawMaterial.findMany({
        skip,
        take,
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        include: {
            rawMaterialCategory: true,
            consumptionUnit: true,
            minimumStockUnit: true,
        },
        orderBy,
    });
    const formattedRawMaterias = rawMaterials === null || rawMaterials === void 0 ? void 0 : rawMaterials.map((raw) => {
        var _a, _b, _c;
        return ({
            id: raw === null || raw === void 0 ? void 0 : raw.id,
            name: raw === null || raw === void 0 ? void 0 : raw.name,
            barcode: raw === null || raw === void 0 ? void 0 : raw.shortcode,
            categoryId: raw === null || raw === void 0 ? void 0 : raw.categoryId,
            consumptionUnitId: raw === null || raw === void 0 ? void 0 : raw.consumptionUnitId,
            consumptionUnitName: (_a = raw === null || raw === void 0 ? void 0 : raw.consumptionUnit) === null || _a === void 0 ? void 0 : _a.name,
            minimumStockLevelUnitName: (_b = raw === null || raw === void 0 ? void 0 : raw.minimumStockUnit) === null || _b === void 0 ? void 0 : _b.name,
            minimumStockLevelUnitId: raw === null || raw === void 0 ? void 0 : raw.minimumStockLevelUnit,
            conversionFactor: raw === null || raw === void 0 ? void 0 : raw.conversionFactor,
            minimumStockLevel: raw === null || raw === void 0 ? void 0 : raw.minimumStockLevel,
            category: (_c = raw === null || raw === void 0 ? void 0 : raw.rawMaterialCategory) === null || _c === void 0 ? void 0 : _c.name,
            createdAt: raw === null || raw === void 0 ? void 0 : raw.createdAt,
        });
    });
    return res.json({
        success: true,
        data: { totalCount: totalCount, rawMaterials: formattedRawMaterias },
    });
});
exports.getAllTableRawMaterials = getAllTableRawMaterials;
const getAllVendorsForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.vendor.count({
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const vendors = yield __1.prismaDB.vendor.findMany({
        skip,
        take,
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        include: {
            purchases: true,
            category: true,
            contractRates: {
                include: {
                    unit: true,
                    rawMaterial: true,
                },
            },
        },
        orderBy,
    });
    const formattedVendors = vendors === null || vendors === void 0 ? void 0 : vendors.map((vendor) => {
        var _a, _b, _c, _d, _e, _f;
        return ({
            id: vendor.id,
            name: vendor.name,
            categoryId: vendor === null || vendor === void 0 ? void 0 : vendor.categoryId,
            category: ((_a = vendor === null || vendor === void 0 ? void 0 : vendor.category) === null || _a === void 0 ? void 0 : _a.name) || "Missing", // You might want to add category to your vendor schema
            contactName: (vendor === null || vendor === void 0 ? void 0 : vendor.contactName) || "Missing", // Add to schema if needed
            phone: (vendor === null || vendor === void 0 ? void 0 : vendor.phone) || "Missing", // Add to schema if needed
            email: (vendor === null || vendor === void 0 ? void 0 : vendor.email) || "Missing", // Add to schema if needed
            totalOrders: ((_b = vendor === null || vendor === void 0 ? void 0 : vendor.purchases) === null || _b === void 0 ? void 0 : _b.length) || 0,
            lastOrder: ((_c = vendor.purchases[0]) === null || _c === void 0 ? void 0 : _c.createdAt.toISOString().split("T")[0]) || null,
            status: "ACTIVE", // Add status field to schema if needed
            isContract: (vendor === null || vendor === void 0 ? void 0 : vendor.isContract) || false,
            rawMaterials: (_d = vendor === null || vendor === void 0 ? void 0 : vendor.contractRates) === null || _d === void 0 ? void 0 : _d.map((rate) => {
                var _a, _b;
                return ({
                    id: rate === null || rate === void 0 ? void 0 : rate.id,
                    rawMaterialId: rate === null || rate === void 0 ? void 0 : rate.rawMaterialId,
                    rawMaterialName: (_a = rate === null || rate === void 0 ? void 0 : rate.rawMaterial) === null || _a === void 0 ? void 0 : _a.name,
                    unitId: rate === null || rate === void 0 ? void 0 : rate.unitId,
                    unitName: (_b = rate === null || rate === void 0 ? void 0 : rate.unit) === null || _b === void 0 ? void 0 : _b.name,
                    netRate: rate === null || rate === void 0 ? void 0 : rate.netRate,
                    gstType: rate === null || rate === void 0 ? void 0 : rate.gstType,
                    taxAmount: rate === null || rate === void 0 ? void 0 : rate.taxAmount,
                    totalRate: rate === null || rate === void 0 ? void 0 : rate.totalRate,
                    validFrom: rate === null || rate === void 0 ? void 0 : rate.validFrom,
                    validTo: rate === null || rate === void 0 ? void 0 : rate.validTo,
                });
            }),
            avgContractRate: ((_e = vendor === null || vendor === void 0 ? void 0 : vendor.contractRates) === null || _e === void 0 ? void 0 : _e.reduce((acc, rate) => acc + rate.totalRate, 0)) /
                ((_f = vendor === null || vendor === void 0 ? void 0 : vendor.contractRates) === null || _f === void 0 ? void 0 : _f.length),
            createdAt: vendor.createdAt,
            updatedAt: vendor.updatedAt,
        });
    });
    return res.json({
        success: true,
        data: { totalCount: totalCount, vendors: formattedVendors },
    });
});
exports.getAllVendorsForTable = getAllVendorsForTable;
const getAllTableRawMaterialCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.rawMaterialCategory.count({
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const rawMaterialsCategory = yield __1.prismaDB.rawMaterialCategory.findMany({
        take,
        skip,
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        orderBy,
    });
    const formattedRawMaterialCategories = rawMaterialsCategory === null || rawMaterialsCategory === void 0 ? void 0 : rawMaterialsCategory.map((raw) => ({
        id: raw === null || raw === void 0 ? void 0 : raw.id,
        name: raw === null || raw === void 0 ? void 0 : raw.name,
        createdAt: raw === null || raw === void 0 ? void 0 : raw.createdAt,
        updatedAt: raw === null || raw === void 0 ? void 0 : raw.updatedAt,
    }));
    return res.json({
        success: true,
        data: {
            totalCount: totalCount,
            categories: formattedRawMaterialCategories,
        },
    });
});
exports.getAllTableRawMaterialCategory = getAllTableRawMaterialCategory;
const allTableStocks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.rawMaterial.count({
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const rawMaterials = yield __1.prismaDB.rawMaterial.findMany({
        skip,
        take,
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        include: {
            rawMaterialCategory: true,
            consumptionUnit: true,
            minimumStockUnit: true,
        },
        orderBy,
    });
    const formattedStocks = rawMaterials === null || rawMaterials === void 0 ? void 0 : rawMaterials.map((rawItem) => {
        var _a, _b, _c, _d, _e;
        return ({
            id: rawItem === null || rawItem === void 0 ? void 0 : rawItem.id,
            name: rawItem === null || rawItem === void 0 ? void 0 : rawItem.name,
            consumptionUnit: (_a = rawItem === null || rawItem === void 0 ? void 0 : rawItem.consumptionUnit) === null || _a === void 0 ? void 0 : _a.name,
            stock: `${(_b = rawItem === null || rawItem === void 0 ? void 0 : rawItem.currentStock) === null || _b === void 0 ? void 0 : _b.toFixed(2)} - ${rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedUnit}`,
            minStockLevel: `${(_c = rawItem === null || rawItem === void 0 ? void 0 : rawItem.minimumStockLevel) === null || _c === void 0 ? void 0 : _c.toFixed(2)} - ${(_d = rawItem === null || rawItem === void 0 ? void 0 : rawItem.minimumStockUnit) === null || _d === void 0 ? void 0 : _d.name}`,
            purchasedPrice: rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedPrice,
            lastPurchasedPrice: rawItem === null || rawItem === void 0 ? void 0 : rawItem.lastPurchasedPrice,
            purchasedPricePerItem: rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedPricePerItem,
            purchasedStock: `${(_e = rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedStock) === null || _e === void 0 ? void 0 : _e.toFixed(2)} - ${rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedUnit}`,
            createdAt: rawItem === null || rawItem === void 0 ? void 0 : rawItem.createdAt,
        });
    });
    return res.json({
        success: true,
        data: {
            totalCount: totalCount,
            stocks: formattedStocks,
        },
        message: "Fetched Items by database ✅",
    });
});
exports.allTableStocks = allTableStocks;
const getAllTableItemRecipe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.itemRecipe.count({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const getRecipes = yield __1.prismaDB.itemRecipe.findMany({
        skip,
        take,
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        include: {
            addOnItemVariant: true,
            ingredients: {
                include: {
                    rawMaterial: true,
                    unit: true,
                },
            },
            menuItem: true,
            menuItemVariant: {
                include: {
                    menuItem: true,
                    variant: true,
                },
            },
        },
        orderBy,
    });
    const formattedRecipes = getRecipes === null || getRecipes === void 0 ? void 0 : getRecipes.map((item) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return ({
            id: item === null || item === void 0 ? void 0 : item.id,
            recipeType: item === null || item === void 0 ? void 0 : item.recipeType,
            recipeFor: item === null || item === void 0 ? void 0 : item.recipeFor,
            itemId: (item === null || item === void 0 ? void 0 : item.recipeFor) === "MENU_ITEMS"
                ? item === null || item === void 0 ? void 0 : item.menuId
                : (item === null || item === void 0 ? void 0 : item.recipeFor) === "MENU_VARIANTS"
                    ? item === null || item === void 0 ? void 0 : item.menuVariantId
                    : item === null || item === void 0 ? void 0 : item.addonItemVariantId,
            name: ((_a = item === null || item === void 0 ? void 0 : item.name) !== null && _a !== void 0 ? _a : (item === null || item === void 0 ? void 0 : item.recipeFor) === "MENU_ITEMS")
                ? (_c = (_b = item === null || item === void 0 ? void 0 : item.menuItem) === null || _b === void 0 ? void 0 : _b.find((me) => (me === null || me === void 0 ? void 0 : me.id) === (item === null || item === void 0 ? void 0 : item.menuId))) === null || _c === void 0 ? void 0 : _c.name
                : (item === null || item === void 0 ? void 0 : item.recipeFor) === "MENU_VARIANTS"
                    ? `${(_f = (_e = (_d = item === null || item === void 0 ? void 0 : item.menuItemVariant) === null || _d === void 0 ? void 0 : _d.find((v) => v.id === (item === null || item === void 0 ? void 0 : item.menuVariantId))) === null || _e === void 0 ? void 0 : _e.menuItem) === null || _f === void 0 ? void 0 : _f.name} - ${(_j = (_h = (_g = item === null || item === void 0 ? void 0 : item.menuItemVariant) === null || _g === void 0 ? void 0 : _g.find((v) => v.id === (item === null || item === void 0 ? void 0 : item.menuVariantId))) === null || _h === void 0 ? void 0 : _h.variant) === null || _j === void 0 ? void 0 : _j.name}`
                    : (_l = (_k = item === null || item === void 0 ? void 0 : item.addOnItemVariant) === null || _k === void 0 ? void 0 : _k.find((a) => a.id === (item === null || item === void 0 ? void 0 : item.addonItemVariantId))) === null || _l === void 0 ? void 0 : _l.name,
            grossMargin: item === null || item === void 0 ? void 0 : item.grossMargin,
            itemPrice: item === null || item === void 0 ? void 0 : item.itemPrice,
            itemCost: item === null || item === void 0 ? void 0 : item.itemCost,
            ingredients: item === null || item === void 0 ? void 0 : item.ingredients.map((ing) => {
                var _a, _b;
                return ({
                    id: ing === null || ing === void 0 ? void 0 : ing.id,
                    rawMaterialId: ing === null || ing === void 0 ? void 0 : ing.rawMaterialId,
                    rawMaterialName: (_a = ing === null || ing === void 0 ? void 0 : ing.rawMaterial) === null || _a === void 0 ? void 0 : _a.name,
                    unitId: ing === null || ing === void 0 ? void 0 : ing.unitId,
                    unitName: (_b = ing === null || ing === void 0 ? void 0 : ing.unit) === null || _b === void 0 ? void 0 : _b.name,
                    cost: ing === null || ing === void 0 ? void 0 : ing.cost,
                    quanity: ing === null || ing === void 0 ? void 0 : ing.quantity,
                });
            }),
            createdBy: item.createdBy,
            createdAt: item === null || item === void 0 ? void 0 : item.createdAt,
        });
    });
    return res.json({
        success: true,
        data: {
            totalCount: totalCount,
            recipes: formattedRecipes,
        },
    });
});
exports.getAllTableItemRecipe = getAllTableItemRecipe;
const getTableAllRawMaterialUnit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const rawMaterialsUnitFromRedis = yield redis_1.redis.get(`${outletId}-raw-materials-unit`);
    if (rawMaterialsUnitFromRedis) {
        return res.json({
            success: true,
            units: JSON.parse(rawMaterialsUnitFromRedis),
        });
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const rawMaterialsUnit = yield __1.prismaDB.unit.findMany({
        where: {
            restaurantId: outletId,
        },
    });
    yield redis_1.redis.set(`${outletId}-raw-materials-unit`, JSON.stringify(rawMaterialsUnit));
    return res.json({
        success: true,
        units: rawMaterialsUnit,
    });
});
exports.getTableAllRawMaterialUnit = getTableAllRawMaterialUnit;
const getAllCompletedTablePurcahses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.purchase.count({
        where: {
            restaurantId: outletId,
            purchaseStatus: {
                in: [client_1.PurchaseStatus.COMPLETED, client_1.PurchaseStatus.CANCELLED],
            },
            OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const allPurchases = yield __1.prismaDB.purchase.findMany({
        skip,
        take,
        where: {
            restaurantId: outletId,
            purchaseStatus: {
                in: [client_1.PurchaseStatus.COMPLETED, client_1.PurchaseStatus.CANCELLED],
            },
            OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        include: {
            purchaseItems: {
                include: {
                    purchaseUnit: true,
                    rawMaterial: true,
                },
            },
        },
        orderBy,
    });
    const formattedPurchase = allPurchases === null || allPurchases === void 0 ? void 0 : allPurchases.map((purchase) => {
        var _a;
        return ({
            id: purchase === null || purchase === void 0 ? void 0 : purchase.id,
            invoiceNo: purchase === null || purchase === void 0 ? void 0 : purchase.invoiceNo,
            vendorId: purchase === null || purchase === void 0 ? void 0 : purchase.vendorId,
            isPaid: purchase === null || purchase === void 0 ? void 0 : purchase.isPaid,
            subTotal: purchase === null || purchase === void 0 ? void 0 : purchase.subTotal,
            taxes: purchase === null || purchase === void 0 ? void 0 : purchase.taxes,
            paymentMethod: purchase === null || purchase === void 0 ? void 0 : purchase.paymentMethod,
            generatedAmount: purchase === null || purchase === void 0 ? void 0 : purchase.generatedAmount,
            totalAmount: purchase === null || purchase === void 0 ? void 0 : purchase.totalAmount,
            purchaseStatus: purchase === null || purchase === void 0 ? void 0 : purchase.purchaseStatus,
            createdBy: purchase === null || purchase === void 0 ? void 0 : purchase.createdBy,
            createdAt: purchase === null || purchase === void 0 ? void 0 : purchase.createdAt,
            purchaseItems: (_a = purchase === null || purchase === void 0 ? void 0 : purchase.purchaseItems) === null || _a === void 0 ? void 0 : _a.map((item) => ({
                id: item === null || item === void 0 ? void 0 : item.id,
                rawMaterialId: item === null || item === void 0 ? void 0 : item.rawMaterialId,
                rawMaterialName: item === null || item === void 0 ? void 0 : item.rawMaterialName,
                purchaseUnitId: item === null || item === void 0 ? void 0 : item.purchaseUnitId,
                purchaseUnitName: item === null || item === void 0 ? void 0 : item.purchaseUnitName,
                purchaseQuantity: item === null || item === void 0 ? void 0 : item.purchaseQuantity,
                gstType: item === null || item === void 0 ? void 0 : item.gstType,
                netRate: item === null || item === void 0 ? void 0 : item.netRate,
                taxAmount: item === null || item === void 0 ? void 0 : item.taxAmount,
                purchasePrice: item === null || item === void 0 ? void 0 : item.purchasePrice,
            })),
        });
    });
    return res.json({
        success: true,
        data: {
            totalCount,
            purchases: formattedPurchase,
        },
    });
});
exports.getAllCompletedTablePurcahses = getAllCompletedTablePurcahses;
const getAllRequestedTablePurcahses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.purchase.count({
        where: {
            purchaseStatus: {
                in: [
                    client_1.PurchaseStatus.PROCESSED,
                    client_1.PurchaseStatus.ACCEPTED,
                    client_1.PurchaseStatus.REQUESTED,
                ],
            },
            restaurantId: outletId,
            OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const allPurchases = yield __1.prismaDB.purchase.findMany({
        where: {
            restaurantId: outletId,
            purchaseStatus: {
                in: ["PROCESSED", "ACCEPTED", "REQUESTED"],
            },
            OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        include: {
            purchaseItems: {
                include: {
                    purchaseUnit: true,
                    rawMaterial: true,
                },
            },
        },
        orderBy,
        skip,
        take,
    });
    const formattedPurchase = allPurchases === null || allPurchases === void 0 ? void 0 : allPurchases.map((purchase) => {
        var _a;
        return ({
            id: purchase === null || purchase === void 0 ? void 0 : purchase.id,
            invoiceNo: purchase === null || purchase === void 0 ? void 0 : purchase.invoiceNo,
            vendorId: purchase === null || purchase === void 0 ? void 0 : purchase.vendorId,
            isPaid: purchase === null || purchase === void 0 ? void 0 : purchase.isPaid,
            subTotal: purchase === null || purchase === void 0 ? void 0 : purchase.subTotal,
            taxes: purchase === null || purchase === void 0 ? void 0 : purchase.taxes,
            paymentMethod: purchase === null || purchase === void 0 ? void 0 : purchase.paymentMethod,
            generatedAmount: purchase === null || purchase === void 0 ? void 0 : purchase.generatedAmount,
            totalAmount: purchase === null || purchase === void 0 ? void 0 : purchase.totalAmount,
            purchaseStatus: purchase === null || purchase === void 0 ? void 0 : purchase.purchaseStatus,
            createdBy: purchase === null || purchase === void 0 ? void 0 : purchase.createdBy,
            createdAt: purchase === null || purchase === void 0 ? void 0 : purchase.createdAt,
            purchaseItems: (_a = purchase === null || purchase === void 0 ? void 0 : purchase.purchaseItems) === null || _a === void 0 ? void 0 : _a.map((item) => ({
                id: item === null || item === void 0 ? void 0 : item.id,
                rawMaterialId: item === null || item === void 0 ? void 0 : item.rawMaterialId,
                rawMaterialName: item === null || item === void 0 ? void 0 : item.rawMaterialName,
                purchaseUnitId: item === null || item === void 0 ? void 0 : item.purchaseUnitId,
                purchaseUnitName: item === null || item === void 0 ? void 0 : item.purchaseUnitName,
                purchaseQuantity: item === null || item === void 0 ? void 0 : item.purchaseQuantity,
                gstType: item === null || item === void 0 ? void 0 : item.gstType,
                netRate: item === null || item === void 0 ? void 0 : item.netRate,
                taxAmount: item === null || item === void 0 ? void 0 : item.taxAmount,
                purchasePrice: item === null || item === void 0 ? void 0 : item.purchasePrice,
            })),
        });
    });
    return res.json({
        success: true,
        data: {
            totalCount,
            purchases: formattedPurchase,
        },
    });
});
exports.getAllRequestedTablePurcahses = getAllRequestedTablePurcahses;
const getAllSettledTablePurcahses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.purchase.count({
        where: {
            purchaseStatus: client_1.PurchaseStatus.SETTLEMENT,
            restaurantId: outletId,
            OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const allPurchases = yield __1.prismaDB.purchase.findMany({
        skip,
        take,
        where: {
            restaurantId: outletId,
            purchaseStatus: client_1.PurchaseStatus.SETTLEMENT,
            OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        include: {
            purchaseItems: {
                include: {
                    purchaseUnit: true,
                    rawMaterial: true,
                },
            },
        },
        orderBy,
    });
    const formattedPurchase = allPurchases === null || allPurchases === void 0 ? void 0 : allPurchases.map((purchase) => {
        var _a;
        return ({
            id: purchase === null || purchase === void 0 ? void 0 : purchase.id,
            invoiceNo: purchase === null || purchase === void 0 ? void 0 : purchase.invoiceNo,
            vendorId: purchase === null || purchase === void 0 ? void 0 : purchase.vendorId,
            isPaid: purchase === null || purchase === void 0 ? void 0 : purchase.isPaid,
            subTotal: purchase === null || purchase === void 0 ? void 0 : purchase.subTotal,
            taxes: purchase === null || purchase === void 0 ? void 0 : purchase.taxes,
            paymentMethod: purchase === null || purchase === void 0 ? void 0 : purchase.paymentMethod,
            generatedAmount: purchase === null || purchase === void 0 ? void 0 : purchase.generatedAmount,
            totalAmount: purchase === null || purchase === void 0 ? void 0 : purchase.totalAmount,
            purchaseStatus: purchase === null || purchase === void 0 ? void 0 : purchase.purchaseStatus,
            createdBy: purchase === null || purchase === void 0 ? void 0 : purchase.createdBy,
            createdAt: purchase === null || purchase === void 0 ? void 0 : purchase.createdAt,
            purchaseItems: (_a = purchase === null || purchase === void 0 ? void 0 : purchase.purchaseItems) === null || _a === void 0 ? void 0 : _a.map((item) => ({
                id: item === null || item === void 0 ? void 0 : item.id,
                rawMaterialId: item === null || item === void 0 ? void 0 : item.rawMaterialId,
                rawMaterialName: item === null || item === void 0 ? void 0 : item.rawMaterialName,
                purchaseUnitId: item === null || item === void 0 ? void 0 : item.purchaseUnitId,
                purchaseUnitName: item === null || item === void 0 ? void 0 : item.purchaseUnitName,
                purchaseQuantity: item === null || item === void 0 ? void 0 : item.purchaseQuantity,
                gstType: item === null || item === void 0 ? void 0 : item.gstType,
                netRate: item === null || item === void 0 ? void 0 : item.netRate,
                taxAmount: item === null || item === void 0 ? void 0 : item.taxAmount,
                purchasePrice: item === null || item === void 0 ? void 0 : item.purchasePrice,
            })),
        });
    });
    return res.json({
        success: true,
        data: {
            totalCount,
            purchases: formattedPurchase,
        },
    });
});
exports.getAllSettledTablePurcahses = getAllSettledTablePurcahses;
const getAllTableRawMaterialUnit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.unit.count({
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const rawMaterialsUnit = yield __1.prismaDB.unit.findMany({
        take,
        skip,
        where: {
            restaurantId: outletId,
            OR: [{ name: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        orderBy,
    });
    const formanttedUnits = rawMaterialsUnit === null || rawMaterialsUnit === void 0 ? void 0 : rawMaterialsUnit.map((unit) => ({
        id: unit === null || unit === void 0 ? void 0 : unit.id,
        name: unit === null || unit === void 0 ? void 0 : unit.name,
        createdAt: unit === null || unit === void 0 ? void 0 : unit.createdAt,
        updatedAt: unit === null || unit === void 0 ? void 0 : unit.updatedAt,
    }));
    return res.json({
        success: true,
        data: { totalCount, units: formanttedUnits },
    });
});
exports.getAllTableRawMaterialUnit = getAllTableRawMaterialUnit;
const deleteItemRecipe = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, id: recipeId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Use transaction to handle both deletion and menu updates
    yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _21, _22, _23;
        // First, find all related items that use this recipe
        const recipe = yield prisma.itemRecipe.findUnique({
            where: { id: recipeId },
            include: {
                menuItem: true, // Get linked menu items
                menuItemVariant: true, // Get linked menu variants
                addOnItemVariant: true, // Get linked addon variants
            },
        });
        if (!recipe) {
            throw new not_found_1.NotFoundException("Recipe Not Found", root_1.ErrorCode.NOT_FOUND);
        }
        // Update menu items that use this recipe
        if (((_21 = recipe.menuItem) === null || _21 === void 0 ? void 0 : _21.length) > 0) {
            yield prisma.menuItem.updateMany({
                where: {
                    itemRecipeId: recipeId,
                },
                data: {
                    chooseProfit: "manualProfit",
                    grossProfitType: "INR",
                    itemRecipeId: null, // Remove the recipe reference
                },
            });
        }
        // Update menu variants that use this recipe
        if (((_22 = recipe.menuItemVariant) === null || _22 === void 0 ? void 0 : _22.length) > 0) {
            yield prisma.menuItemVariant.updateMany({
                where: {
                    itemRecipeId: recipeId,
                },
                data: {
                    chooseProfit: "manualProfit",
                    grossProfitType: "INR",
                    itemRecipeId: null, // Remove the recipe reference
                },
            });
        }
        // Update addon variants that use this recipe
        if (((_23 = recipe.addOnItemVariant) === null || _23 === void 0 ? void 0 : _23.length) > 0) {
            yield prisma.addOnVariants.updateMany({
                where: {
                    itemRecipeId: recipeId,
                },
                data: {
                    chooseProfit: "manualProfit",
                    grossProfitType: "INR",
                    itemRecipeId: null, // Remove the recipe reference
                },
            });
        }
        // Finally, delete the recipe
        yield prisma.itemRecipe.delete({
            where: {
                id: recipeId,
            },
        });
    }));
    // Clear relevant cache
    yield Promise.all([
        redis_1.redis.del(`${outletId}-all-items`),
        redis_1.redis.del(`${outletId}-all-items-for-online-and-delivery`),
        redis_1.redis.del(`o-${outletId}-categories`),
    ]);
    return res.json({
        success: true,
        message: "Recipe deleted and linked items updated successfully",
    });
});
exports.deleteItemRecipe = deleteItemRecipe;
const calculateItemServes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, recipeId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const serves = yield (0, get_inventory_1.calculateFoodServerForItemRecipe)(recipeId, outletId);
    return res.json({
        success: true,
        message: `This Item Serves ${serves}`,
    });
});
exports.calculateItemServes = calculateItemServes;
