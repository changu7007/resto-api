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
exports.getVendorsForPOS = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const getVendorsForPOS = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!getOutlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const vendors = yield __1.prismaDB.vendor.findMany({
        where: {
            restaurantId: outletId,
        },
        select: {
            id: true,
            name: true,
            isContract: true,
            contractRates: true,
        },
    });
    res.json({
        success: true,
        vendors,
    });
});
exports.getVendorsForPOS = getVendorsForPOS;
