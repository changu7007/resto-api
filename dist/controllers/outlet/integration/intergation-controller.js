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
exports.phonePeDetails = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const utils_1 = require("../../../lib/utils");
const zod_1 = require("zod");
const bad_request_1 = require("../../../exceptions/bad-request");
const phonePeSchema = zod_1.z.object({
    apiKey: zod_1.z.string().min(1, { message: "Api Key field is reuired" }),
    apiSecret: zod_1.z.string().min(1, { message: "Api Key field is required" }),
});
const phonePeDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { data, error } = phonePeSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error === null || error === void 0 ? void 0 : error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getPhonePe = yield __1.prismaDB.integration.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            name: "PHONEPE",
        },
    });
    if (!getPhonePe) {
        throw new not_found_1.NotFoundException("App Not Configured. Contact Support", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    yield __1.prismaDB.integration.update({
        where: {
            id: getPhonePe === null || getPhonePe === void 0 ? void 0 : getPhonePe.id,
            name: "PHONEPE",
            restaurantId: outletId,
        },
        data: {
            phonePeAPIId: (0, utils_1.encryptData)(data === null || data === void 0 ? void 0 : data.apiKey),
            phonePeAPISecretKey: (0, utils_1.encryptData)(data === null || data === void 0 ? void 0 : data.apiSecret),
            connected: true,
        },
    });
    return res.json({
        success: true,
        message: "PhonePe Credentials Saved Successfully ✅",
    });
});
exports.phonePeDetails = phonePeDetails;
