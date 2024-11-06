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
exports.getAllStaff = void 0;
const __1 = require("../..");
const redis_1 = require("../../services/redis");
const getAllStaff = (outletId) => __awaiter(void 0, void 0, void 0, function* () {
    const staffs = yield __1.prismaDB.staff.findMany({
        where: {
            restaurantId: outletId,
        },
    });
    return yield redis_1.redis.set(`staffs-${outletId}`, JSON.stringify(staffs));
});
exports.getAllStaff = getAllStaff;
