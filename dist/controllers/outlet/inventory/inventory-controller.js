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
exports.getRecipeById = exports.getAllItemRecipe = exports.updateItemRecipe = exports.createItemRecipe = exports.allStocks = exports.getAllVendors = exports.deleteVendor = exports.updateVendor = exports.createVendor = exports.getPurchaseId = exports.validatePurchasenRestock = exports.deleteRequestPurchase = exports.updateRequestPurchase = exports.createRequestPurchase = exports.getAllPurcahses = exports.getAllRawMaterialUnit = exports.deleteCategoryById = exports.updateCategoryById = exports.getCategoryById = exports.createRawMaterialCategory = exports.deleteUnitById = exports.updateUnitById = exports.getUnitById = exports.createUnit = exports.getAllRawMaterialCategory = exports.deleteRawMaterialById = exports.getRawMaterialById = exports.updateRawMaterialById = exports.createRawMaterial = exports.getAllRawMaterials = void 0;
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
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.rawMaterial.create({
        data: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            name: validateFields.name,
            shortcode: validateFields.barcode,
            categoryId: validateFields.categoryId,
            consumptionUnitId: validateFields.consumptionUnitId,
            conversionFactor: validateFields.conversionFactor,
            minimumStockLevelUnit: validateFields.minimumStockLevelUnitId,
            minimumStockLevel: validateFields.minimumStockLevel,
        },
    });
    yield (0, get_inventory_1.fetchOutletRawMaterialsToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
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
    yield (0, get_inventory_1.fetchOutletRawMaterialsToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
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
    yield (0, get_inventory_1.fetchOutletRawMaterialsToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id);
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
    yield redis_1.redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases));
    return res.json({
        success: true,
        allPurchases,
    });
});
exports.getAllPurcahses = getAllPurcahses;
const purchaseRequestFormSchema = zod_1.z.object({
    vendorId: zod_1.z.string().min(1, { message: "Vendor Is Required" }),
    rawMaterials: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        rawMaterialId: zod_1.z.string().min(1, { message: "Raw Material Is Required" }),
        rawMaterialName: zod_1.z.string().min(1, { message: "Raw Material Name" }),
        unitName: zod_1.z.string().min(1, { message: "Unit Name is required" }),
        requestUnitId: zod_1.z.string().min(1, { message: "Request Unit is Required" }),
        requestQuantity: zod_1.z.coerce
            .number()
            .min(1, { message: "Request Quantity is Required" }),
        sgst: zod_1.z.coerce.number().optional(),
        cgst: zod_1.z.coerce.number().optional(),
        total: zod_1.z.coerce.number().optional(),
    })),
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
        const purchase = yield __1.prismaDB.purchase.create({
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
                        sgst: item === null || item === void 0 ? void 0 : item.sgst,
                        cgst: item === null || item === void 0 ? void 0 : item.cgst,
                        purchasePrice: item === null || item === void 0 ? void 0 : item.total,
                    })),
                },
            },
        });
        if (purchase === null || purchase === void 0 ? void 0 : purchase.id) {
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
            yield redis_1.redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases));
        }
    }));
    return res.json({
        success: true,
        message: "Request Purchase Created",
    });
});
exports.createRequestPurchase = createRequestPurchase;
const updateRequestPurchase = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d;
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
    const existingPurchaseItems = (_c = findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.purchaseItems) === null || _c === void 0 ? void 0 : _c.map((pi) => pi.id);
    const incommingItems = (_d = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _d === void 0 ? void 0 : _d.map((i) => i === null || i === void 0 ? void 0 : i.id).filter(Boolean);
    // Determine purchaseItem to delete (those in existing but not in incoming)
    const purchaseItemsToDelete = existingPurchaseItems.filter((id) => !incommingItems.includes(id));
    // Prepare transaction for atomic update
    yield __1.prismaDB.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
        var _e;
        //update purchase details
        yield __1.prismaDB.purchase.update({
            where: {
                id: findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id,
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
            data: {
                vendorId: findVendor.id,
                isPaid: false,
            },
        });
        // Handle purchaseItems updates in a single operation
        if (((_e = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _e === void 0 ? void 0 : _e.length) > 0) {
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
    });
    yield redis_1.redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases));
    return res.json({
        success: true,
        message: "Request Purchase Created",
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
    });
    yield redis_1.redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases));
    return res.json({
        success: true,
        message: "Request Purchase Deleted ✅",
    });
});
exports.deleteRequestPurchase = deleteRequestPurchase;
const validatePurchaseSchema = zod_1.z.object({
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
            .min(0, { message: "Request Quantity is Required" }),
        gst: zod_1.z.coerce.number(),
        total: zod_1.z.coerce
            .number()
            .min(0, { message: "Purchase price is required" }),
    }))
        .min(1, { message: "Atleast 1 Raw Material you need to request" }),
    isPaid: zod_1.z.boolean({ required_error: "You need to choose" }),
    billImage: zod_1.z.string().optional(),
    chooseInvoice: zod_1.z.enum(["generateInvoice", "uploadInvoice"], {
        required_error: "You need to select a invoice type.",
    }),
    totalTaxes: zod_1.z.coerce.number().min(0, { message: "taxes invalid" }),
    subTotal: zod_1.z.coerce.number().min(0, { message: "taxes invalid" }),
    total: zod_1.z.coerce.number().min(0, { message: "total required" }),
    paymentMethod: zod_1.z.enum(["CASH", "UPI", "DEBIT", "CREDIT"], {
        required_error: "Settlement Payment Method Required.",
    }),
});
const validatePurchasenRestock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _f;
    const { outletId, id } = req.params;
    const { data: validateFields, error } = validatePurchaseSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = (_f = req.user) === null || _f === void 0 ? void 0 : _f.id;
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
        var _g, _h;
        // Step 1: Restock raw materials and update `RecipeIngredient` costs
        yield Promise.all((_g = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _g === void 0 ? void 0 : _g.map((item) => __awaiter(void 0, void 0, void 0, function* () {
            var _j, _k;
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
                const newStock = Number((_j = rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.currentStock) !== null && _j !== void 0 ? _j : 0) + (item === null || item === void 0 ? void 0 : item.requestQuantity);
                const newPricePerItem = Number(item.total) / Number(item.requestQuantity);
                yield prisma.rawMaterial.update({
                    where: {
                        id: rawMaterial.id,
                    },
                    data: {
                        currentStock: newStock,
                        purchasedPrice: item.total,
                        purchasedPricePerItem: newPricePerItem,
                        purchasedUnit: item.unitName,
                        lastPurchasedPrice: (_k = rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.purchasedPrice) !== null && _k !== void 0 ? _k : 0,
                        purchasedStock: newStock,
                    },
                });
                const findRecipeIngredients = yield prisma.recipeIngredient.findFirst({
                    where: {
                        rawMaterialId: rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.id,
                    },
                });
                if (findRecipeIngredients) {
                    const recipeCostWithQuantity = Number(findRecipeIngredients === null || findRecipeIngredients === void 0 ? void 0 : findRecipeIngredients.quantity) /
                        Number(rawMaterial === null || rawMaterial === void 0 ? void 0 : rawMaterial.conversionFactor);
                    const ingredientCost = recipeCostWithQuantity * newPricePerItem;
                    // Update linked `RecipeIngredient` cost
                    yield prisma.recipeIngredient.updateMany({
                        where: {
                            rawMaterialId: rawMaterial.id,
                        },
                        data: {
                            cost: ingredientCost,
                        },
                    });
                }
            }
        })));
        // Step 2: Recalculate `ItemRecipe` gross margin and related fields
        const recipesToUpdate = yield prisma.itemRecipe.findMany({
            where: {
                restaurantId: outlet.id,
            },
            include: {
                ingredients: {
                    include: {
                        rawMaterial: true,
                    },
                },
            },
        });
        yield Promise.all(recipesToUpdate.map((recipe) => __awaiter(void 0, void 0, void 0, function* () {
            const totalCost = recipe.ingredients.reduce((sum, ingredient) => {
                var _a, _b;
                return sum +
                    (Number(ingredient.quantity) /
                        Number((_a = ingredient === null || ingredient === void 0 ? void 0 : ingredient.rawMaterial) === null || _a === void 0 ? void 0 : _a.conversionFactor)) *
                        Number((_b = ingredient === null || ingredient === void 0 ? void 0 : ingredient.rawMaterial) === null || _b === void 0 ? void 0 : _b.purchasedPricePerItem);
            }, 0);
            const grossMargin = Number(recipe.itemPrice) - totalCost;
            yield prisma.itemRecipe.update({
                where: {
                    id: recipe.id,
                },
                data: {
                    itemCost: totalCost,
                    grossMargin,
                },
            });
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
                subTotal: validateFields === null || validateFields === void 0 ? void 0 : validateFields.subTotal,
                taxes: validateFields === null || validateFields === void 0 ? void 0 : validateFields.totalTaxes,
                totalAmount: validateFields === null || validateFields === void 0 ? void 0 : validateFields.total,
                purchaseStatus: "COMPLETED",
                purchaseItems: {
                    update: (_h = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _h === void 0 ? void 0 : _h.map((item) => ({
                        where: {
                            id: item === null || item === void 0 ? void 0 : item.id,
                            purchaseId: validateFields === null || validateFields === void 0 ? void 0 : validateFields.id,
                        },
                        data: {
                            cgst: item.gst / 2,
                            sgst: item.gst / 2,
                            purchasePrice: item === null || item === void 0 ? void 0 : item.total,
                        },
                    })),
                },
            },
        });
        return updatePurchase;
    }));
    if (transaction === null || transaction === void 0 ? void 0 : transaction.id) {
        // Step 4: Refresh Redis cache
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
        const formattedStocks = rawMaterials === null || rawMaterials === void 0 ? void 0 : rawMaterials.map((rawItem) => ({
            id: rawItem === null || rawItem === void 0 ? void 0 : rawItem.id,
            name: rawItem === null || rawItem === void 0 ? void 0 : rawItem.name,
            consumptionUnit: rawItem.consumptionUnit.name,
            stock: `${rawItem.currentStock} - ${rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedUnit}`,
            purchasedPrice: rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedPrice,
            lastPurchasedPrice: rawItem === null || rawItem === void 0 ? void 0 : rawItem.lastPurchasedPrice,
            purchasedPricePerItem: rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedPricePerItem,
            purchasedStock: `${rawItem.currentStock} - ${rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedUnit}`,
            createdAt: rawItem.createdAt,
        }));
        yield Promise.all([
            redis_1.redis.set(`${outletId}-stocks`, JSON.stringify(formattedStocks)),
            redis_1.redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases)),
            (0, get_inventory_1.fetchOutletRawMaterialsToRedis)(outlet === null || outlet === void 0 ? void 0 : outlet.id),
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
    name: zod_1.z.string().min(1),
});
const createVendor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const validateFields = vendorFormSchema.parse(req.body);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.vendor.create({
        data: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            name: validateFields.name,
        },
    });
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
        },
    });
    yield redis_1.redis.set(`${outlet.id}-vendors`, JSON.stringify(vendors));
    return res.json({
        success: true,
        message: "Vendor Created Success ✅",
    });
});
exports.createVendor = createVendor;
const updateVendor = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    });
    if (!(vendor === null || vendor === void 0 ? void 0 : vendor.id)) {
        throw new not_found_1.NotFoundException("Vendor Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.vendor.update({
        where: {
            id: vendor.id,
            restaurantId: outlet.id,
        },
        data: {
            name: validateFields.name,
        },
    });
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
        },
    });
    yield redis_1.redis.set(`${outlet.id}-vendors`, JSON.stringify(vendors));
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
        },
    });
    yield redis_1.redis.set(`${outlet.id}-vendors`, JSON.stringify(vendors));
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
        },
    });
    yield redis_1.redis.set(`${outlet.id}-vendors`, JSON.stringify(vendors));
    return res.json({
        success: true,
        vednors: vendors,
        message: "Vendors Fetched ✅",
    });
});
exports.getAllVendors = getAllVendors;
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
    const formattedStocks = rawMaterials === null || rawMaterials === void 0 ? void 0 : rawMaterials.map((rawItem) => ({
        id: rawItem === null || rawItem === void 0 ? void 0 : rawItem.id,
        name: rawItem === null || rawItem === void 0 ? void 0 : rawItem.name,
        consumptionUnit: rawItem.consumptionUnit.name,
        stock: `${rawItem.currentStock} - ${rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedUnit}`,
        purchasedPrice: rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedPrice,
        lastPurchasedPrice: rawItem === null || rawItem === void 0 ? void 0 : rawItem.lastPurchasedPrice,
        purchasedPricePerItem: rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedPricePerItem,
        purchasedStock: `${rawItem.currentStock} - ${rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedUnit}`,
        createdAt: rawItem.createdAt,
    }));
    yield redis_1.redis.set(`${outletId}-stocks`, JSON.stringify(formattedStocks));
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
            invalid_type_error: "Quantity should be a string",
            required_error: "quantity is required",
        }),
        cost: zod_1.z.coerce.number({
            invalid_type_error: "Cost should be a string",
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
    var _l, _m;
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    const userId = (_l = req === null || req === void 0 ? void 0 : req.user) === null || _l === void 0 ? void 0 : _l.id;
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
    const itemRecipe = yield __1.prismaDB.itemRecipe.create({
        data: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            recipeFor: validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeFor,
            recipeType: validateFields === null || validateFields === void 0 ? void 0 : validateFields.recipeType,
            createdBy: `${findUser === null || findUser === void 0 ? void 0 : findUser.name} (${findUser === null || findUser === void 0 ? void 0 : findUser.role})`,
            lastModifiedBy: `${findUser === null || findUser === void 0 ? void 0 : findUser.name} (${findUser === null || findUser === void 0 ? void 0 : findUser.role})`,
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
                create: (_m = validateFields === null || validateFields === void 0 ? void 0 : validateFields.ingredients) === null || _m === void 0 ? void 0 : _m.map((ingredient) => ({
                    rawMaterialId: ingredient === null || ingredient === void 0 ? void 0 : ingredient.rawMaterialId,
                    quantity: ingredient === null || ingredient === void 0 ? void 0 : ingredient.quantity,
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
    var _o;
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    const userId = (_o = req === null || req === void 0 ? void 0 : req.user) === null || _o === void 0 ? void 0 : _o.id;
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
        var _p;
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
        if (((_p = validateFields === null || validateFields === void 0 ? void 0 : validateFields.ingredients) === null || _p === void 0 ? void 0 : _p.length) > 0) {
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
                            cost: ingredient.cost,
                            unitId: ingredient.mou,
                        },
                    })
                    : prisma.recipeIngredient.create({
                        data: {
                            recipeId: findRecipe.id,
                            rawMaterialId: ingredient.rawMaterialId,
                            quantity: ingredient.quantity,
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
