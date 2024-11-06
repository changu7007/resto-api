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
exports.getFetchAllAreastoRedis = exports.getFetchAllTablesToRedis = void 0;
const __1 = require("../..");
const redis_1 = require("../../services/redis");
const getFetchAllTablesToRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const tables = yield __1.prismaDB.table.findMany({
        where: {
            restaurantId: outletId,
        },
        include: {
            orderSession: {
                include: {
                    orders: {
                        include: { orderItems: true },
                    },
                },
            },
            areas: true,
        },
        orderBy: {
            createdAt: "asc",
        },
    });
    yield redis_1.redis.set(`tables-${outletId}`, JSON.stringify(tables));
    return tables;
});
exports.getFetchAllTablesToRedis = getFetchAllTablesToRedis;
const getFetchAllAreastoRedis = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const allAreas = yield __1.prismaDB.areas.findMany({
        where: {
            restaurantId: outletId,
        },
        include: {
            table: {
                include: {
                    orderSession: {
                        include: {
                            orders: {
                                include: {
                                    orderItems: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    yield redis_1.redis.set(`a-${outletId}`, JSON.stringify(allAreas));
    return allAreas;
});
exports.getFetchAllAreastoRedis = getFetchAllAreastoRedis;
