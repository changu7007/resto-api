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
exports.removeStaffFavoriteMenu = exports.addStaffFavoriteMenu = exports.getStaffFavoriteMenu = void 0;
const redis_1 = require("../../../services/redis");
const __1 = require("../../..");
const root_1 = require("../../../exceptions/root");
const not_found_1 = require("../../../exceptions/not-found");
const bad_request_1 = require("../../../exceptions/bad-request");
const getStaffFavoriteMenu = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { outletId } = req.params;
    // @ts-ignore
    const staffId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const redisItems = yield redis_1.redis.get(`${outletId}-all-items`);
    const staff = yield __1.prismaDB.staff.findFirst({
        where: {
            id: staffId,
        },
    });
    if (!staff) {
        throw new not_found_1.NotFoundException("Staff Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const favoriteMenu = (staff === null || staff === void 0 ? void 0 : staff.favoriteMenu) || [];
    const items = JSON.parse(redisItems || "[]");
    const favoriteItems = items.filter((item) => favoriteMenu.includes(item.id));
    res.json({ success: true, data: favoriteItems });
});
exports.getStaffFavoriteMenu = getStaffFavoriteMenu;
const addStaffFavoriteMenu = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    // @ts-ignore
    const staffId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
    const staff = yield __1.prismaDB.staff.findFirst({
        where: {
            id: staffId,
        },
    });
    if (!staff) {
        throw new not_found_1.NotFoundException("Staff Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const { itemId } = req.body;
    if (!itemId) {
        throw new bad_request_1.BadRequestsException("Item ID is required", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    // Ensure favItems is an array
    const favItems = Array.isArray(staff === null || staff === void 0 ? void 0 : staff.favoriteMenu)
        ? staff === null || staff === void 0 ? void 0 : staff.favoriteMenu
        : [];
    // Check if the menu ID exists in favItems
    const updatedFavItems = favItems.includes(itemId)
        ? favItems.filter((favId) => favId !== itemId) // Remove the ID if present
        : [...favItems, itemId]; // Add the ID if not present
    yield __1.prismaDB.staff.update({
        where: { id: staffId },
        data: { favoriteMenu: updatedFavItems },
    });
    res.json({ success: true, message: "Item added to favorite menu" });
});
exports.addStaffFavoriteMenu = addStaffFavoriteMenu;
const removeStaffFavoriteMenu = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    // @ts-ignore
    const staffId = (_c = req.user) === null || _c === void 0 ? void 0 : _c.id;
    const { itemId } = req.params;
    const staff = yield __1.prismaDB.staff.findFirst({
        where: {
            id: staffId,
        },
    });
    if (!staff) {
        throw new not_found_1.NotFoundException("Staff Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const favoriteMenu = (staff === null || staff === void 0 ? void 0 : staff.favoriteMenu) || [];
    const updatedFavoriteMenu = favoriteMenu.filter((id) => id !== itemId);
    yield __1.prismaDB.staff.update({
        where: { id: staffId },
        data: { favoriteMenu: updatedFavoriteMenu },
    });
    res.json({ success: true, message: "Item removed from favorite menu" });
});
exports.removeStaffFavoriteMenu = removeStaffFavoriteMenu;
