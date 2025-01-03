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
exports.getfetchOutletStocksToRedis = exports.fetchOutletRawMaterialUnitToRedis = exports.fetchOutletRawMaterialCAtegoryToRedis = exports.fetchOutletRawMaterialsToRedis = void 0;
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
    });
    yield redis_1.redis.set(`${outletId}-raw-materials`, JSON.stringify(rawMaterials));
    return rawMaterials;
});
exports.fetchOutletRawMaterialsToRedis = fetchOutletRawMaterialsToRedis;
const fetchOutletRawMaterialCAtegoryToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const rawMaterialsCategory = yield __1.prismaDB.rawMaterialCategory.findMany({
        where: {
            restaurantId: outletId,
        },
    });
    yield redis_1.redis.set(`${outletId}-raw-materials-category`, JSON.stringify(rawMaterialsCategory));
    return rawMaterialsCategory;
});
exports.fetchOutletRawMaterialCAtegoryToRedis = fetchOutletRawMaterialCAtegoryToRedis;
const fetchOutletRawMaterialUnitToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const rawMaterialsUnit = yield __1.prismaDB.unit.findMany({
        where: {
            restaurantId: outletId,
        },
    });
    yield redis_1.redis.set(`${outletId}-raw-materials-unit`, JSON.stringify(rawMaterialsUnit));
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
    yield redis_1.redis.set(`${outletId}-stocks`, JSON.stringify(formattedStocks));
    return formattedStocks;
});
exports.getfetchOutletStocksToRedis = getfetchOutletStocksToRedis;
