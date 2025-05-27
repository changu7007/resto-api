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
exports.calculateFoodServerForItemRecipe = exports.getRawMaterialById = exports.getfetchOutletStocksToRedis = exports.fetchOutletRawMaterialUnitToRedis = exports.fetchOutletRawMaterialCAtegoryToRedis = exports.fetchOutletRawMaterialsToRedis = void 0;
const __1 = require("../..");
const redis_1 = require("../../services/redis");
const fetchOutletRawMaterialsToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const rawMaterials = yield __1.prismaDB.rawMaterial.findMany({
        where: {
            restaurantId: outletId,
        },
        include: {
            rawMaterialCategory: true,
            consumptionUnit: true,
            minimumStockUnit: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    yield redis_1.redis.set(`${outletId}-raw-materials`, JSON.stringify(rawMaterials), "EX", 60 * 60 * 12 // 12 hours
    );
    return rawMaterials;
});
exports.fetchOutletRawMaterialsToRedis = fetchOutletRawMaterialsToRedis;
const fetchOutletRawMaterialCAtegoryToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const rawMaterialsCategory = yield __1.prismaDB.rawMaterialCategory.findMany({
        where: {
            restaurantId: outletId,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    yield redis_1.redis.set(`${outletId}-raw-materials-category`, JSON.stringify(rawMaterialsCategory), "EX", 60 * 60 * 12 // 12 hours
    );
    return rawMaterialsCategory;
});
exports.fetchOutletRawMaterialCAtegoryToRedis = fetchOutletRawMaterialCAtegoryToRedis;
const fetchOutletRawMaterialUnitToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const rawMaterialsUnit = yield __1.prismaDB.unit.findMany({
        where: {
            restaurantId: outletId,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    yield redis_1.redis.set(`${outletId}-raw-materials-unit`, JSON.stringify(rawMaterialsUnit), "EX", 60 * 60 * 12 // 12 hours
    );
    return rawMaterialsUnit;
});
exports.fetchOutletRawMaterialUnitToRedis = fetchOutletRawMaterialUnitToRedis;
const getfetchOutletStocksToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const rawMaterials = yield __1.prismaDB.rawMaterial.findMany({
        where: {
            restaurantId: outletId,
        },
        include: {
            rawMaterialCategory: true,
            consumptionUnit: true,
            minimumStockUnit: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    const formattedStocks = rawMaterials === null || rawMaterials === void 0 ? void 0 : rawMaterials.map((rawItem) => {
        var _a, _b;
        return ({
            id: rawItem === null || rawItem === void 0 ? void 0 : rawItem.id,
            name: rawItem === null || rawItem === void 0 ? void 0 : rawItem.name,
            consumptionUnit: rawItem.consumptionUnit.name,
            lastPurchasedStock: `${(_a = rawItem.purchasedStock) === null || _a === void 0 ? void 0 : _a.toFixed(2)} - ${rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedUnit}`,
            stock: `${(_b = rawItem.currentStock) === null || _b === void 0 ? void 0 : _b.toFixed(2)} - ${rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedUnit}`,
            purchasedPrice: rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedPrice,
            lastPurchasedPrice: rawItem === null || rawItem === void 0 ? void 0 : rawItem.lastPurchasedPrice,
            purchasedPricePerItem: rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedPricePerItem,
            purchasedStock: `${rawItem.currentStock} - ${rawItem === null || rawItem === void 0 ? void 0 : rawItem.purchasedUnit}`,
            createdAt: rawItem.createdAt,
        });
    });
    yield redis_1.redis.set(`${outletId}-stocks`, JSON.stringify(formattedStocks), "EX", 60 * 60 * 12 // 12 hours
    );
    return formattedStocks;
});
exports.getfetchOutletStocksToRedis = getfetchOutletStocksToRedis;
const getRawMaterialById = (outletId, id) => __awaiter(void 0, void 0, void 0, function* () {
    const rawMaterial = yield __1.prismaDB.rawMaterial.findFirst({
        where: {
            id,
            restaurantId: outletId,
        },
        select: {
            id: true,
            name: true,
            currentStock: true,
            consumptionUnitId: true,
            conversionFactor: true,
        },
    });
    return rawMaterial;
});
exports.getRawMaterialById = getRawMaterialById;
const calculateFoodServerForItemRecipe = (recipeId, outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const findrecipe = yield __1.prismaDB.itemRecipe.findFirst({
        where: {
            id: recipeId,
            restaurantId: outletId,
        },
        include: {
            ingredients: true,
        },
    });
    const servingsList = [];
    if (!(findrecipe === null || findrecipe === void 0 ? void 0 : findrecipe.id))
        return 0;
    for (const recipe of findrecipe === null || findrecipe === void 0 ? void 0 : findrecipe.ingredients) {
        const ingredient = yield (0, exports.getRawMaterialById)(outletId, recipe === null || recipe === void 0 ? void 0 : recipe.rawMaterialId);
        //3.4L
        const availableStock = ingredient === null || ingredient === void 0 ? void 0 : ingredient.currentStock;
        console.log(`Ingredient ${ingredient === null || ingredient === void 0 ? void 0 : ingredient.name} = ${availableStock}`);
        //gm UnitId
        const unitId = ingredient === null || ingredient === void 0 ? void 0 : ingredient.consumptionUnitId;
        console.log(`Consumption UnitId:${unitId} & Recipe MOU Unit ${recipe === null || recipe === void 0 ? void 0 : recipe.unitId}`);
        //if gm consumptionyunitId is not equal to  recipe unit id i,e gm
        if (unitId !== (recipe === null || recipe === void 0 ? void 0 : recipe.unitId)) {
            //2.3 in Litre available stock and
            const servings = Math.floor(Number(availableStock) / Number(recipe === null || recipe === void 0 ? void 0 : recipe.quantity));
            console.log(`Not Equals Unit ${servings}`);
            servingsList.push(servings);
        }
        else {
            //2,3*1000
            const conversion = Number(availableStock || 0) * Number(ingredient === null || ingredient === void 0 ? void 0 : ingredient.conversionFactor);
            const servings = Math.floor(Number(conversion) / Number(recipe === null || recipe === void 0 ? void 0 : recipe.quantity));
            console.log(` Equals Unit ${servings}`);
            servingsList.push(servings);
        }
    }
    console.log(servingsList);
    return Math.min(...servingsList);
});
exports.calculateFoodServerForItemRecipe = calculateFoodServerForItemRecipe;
