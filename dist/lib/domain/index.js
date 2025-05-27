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
exports.getDomainDataAndFetchToRedis = void 0;
const __1 = require("../..");
const redis_1 = require("../../services/redis");
const getDomainDataAndFetchToRedis = (domain) => __awaiter(void 0, void 0, void 0, function* () {
    const getSite = yield __1.prismaDB.site.findUnique({
        where: {
            subdomain: domain,
        },
        include: { user: true, restaurants: true },
    });
    if (getSite === null || getSite === void 0 ? void 0 : getSite.id) {
        yield redis_1.redis.set(`app-domain-${getSite === null || getSite === void 0 ? void 0 : getSite.subdomain}`, JSON.stringify(getSite));
    }
    return getSite;
});
exports.getDomainDataAndFetchToRedis = getDomainDataAndFetchToRedis;
