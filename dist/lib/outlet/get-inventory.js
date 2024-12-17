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
exports.fetchOutletRawMaterialUnitToRedis = exports.fetchOutletRawMaterialCAtegoryToRedis = exports.fetchOutletRawMaterialsToRedis = void 0;
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
