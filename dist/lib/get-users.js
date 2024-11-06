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
exports.getOwnerById = exports.getStaffById = exports.getOwnerUserByEmail = void 0;
const __1 = require("..");
const getOwnerUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield __1.prismaDB.user.findFirst({
        where: {
            email: email,
        },
        include: { restaurant: true, billings: true },
    });
    return user;
});
exports.getOwnerUserByEmail = getOwnerUserByEmail;
const getStaffById = (outletId, id) => __awaiter(void 0, void 0, void 0, function* () {
    const staff = yield __1.prismaDB.staff.findFirst({
        where: {
            id: id,
            restaurantId: outletId,
        },
    });
    return staff;
});
exports.getStaffById = getStaffById;
const getOwnerById = (adminId) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield __1.prismaDB.user.findFirst({
        where: {
            id: adminId,
        },
    });
    return user;
});
exports.getOwnerById = getOwnerById;
