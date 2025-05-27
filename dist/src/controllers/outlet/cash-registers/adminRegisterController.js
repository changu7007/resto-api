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
exports.getAdminRegisterStatus = exports.closeAdminRegister = exports.openAdminRegister = void 0;
const adminCashRegisterService_1 = require("../../../services/adminCashRegisterService");
const redis_1 = require("../../../services/redis");
const __1 = require("../../..");
const zod_1 = require("zod");
const root_1 = require("../../../exceptions/root");
const bad_request_1 = require("../../../exceptions/bad-request");
const adminRegisterService = new adminCashRegisterService_1.AdminCashRegisterService();
const openRegisterSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    openingBalance: zod_1.z.coerce.number().min(0, "Opening balance must be positive"),
    openingNotes: zod_1.z.string().optional(),
    denominations: zod_1.z.object({
        coins: zod_1.z.number().min(0, "Coins must be positive"),
        coins2: zod_1.z.number().min(0, "Coins 2 must be positive"),
        coins5: zod_1.z.number().min(0, "Coins 5 must be positive"),
        note500: zod_1.z.number().min(0, "₹500 Notes must be positive"),
        note200: zod_1.z.number().min(0, "₹200 Notes must be positive"),
        note100: zod_1.z.number().min(0, "₹100 Notes must be positive"),
        note50: zod_1.z.number().min(0, "₹50 Notes must be positive"),
        note20: zod_1.z.number().min(0, "₹20 Notes must be positive"),
        note10: zod_1.z.number().min(0, "₹10 Notes must be positive"),
    }),
});
const openAdminRegister = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const validateFields = openRegisterSchema.safeParse(req.body);
    if (!validateFields.success) {
        throw new bad_request_1.BadRequestsException(validateFields.error.message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // @ts-ignore
    const adminId = req.user.id;
    if (validateFields.data.userId !== adminId) {
        throw new bad_request_1.BadRequestsException("You are not authorized to open this register", root_1.ErrorCode.UNAUTHORIZED);
    }
    const register = yield adminRegisterService.openRegister(adminId, outletId, validateFields.data.openingBalance, validateFields.data.openingNotes, validateFields.data.denominations);
    // Clear cache
    yield redis_1.redis.del(`admin-register-${adminId}-${outletId}`);
    return res.json({
        success: true,
        message: "Cash Register Opened Successfully",
        data: register,
    });
});
exports.openAdminRegister = openAdminRegister;
const closeRegisterSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    actualBalance: zod_1.z.coerce
        .number()
        .min(0, "Actual balance must be positive")
        .refine((val) => val >= 0, "Balance cannot be negative"),
    closingNotes: zod_1.z.string().optional(),
    denominations: zod_1.z
        .object({
        note500: zod_1.z.coerce.number().min(0).optional(),
        note200: zod_1.z.coerce.number().min(0).optional(),
        note100: zod_1.z.coerce.number().min(0).optional(),
        note50: zod_1.z.coerce.number().min(0).optional(),
        note20: zod_1.z.coerce.number().min(0).optional(),
        note10: zod_1.z.coerce.number().min(0).optional(),
        coins: zod_1.z.coerce.number().min(0).optional(),
        coins2: zod_1.z.coerce.number().min(0).optional(),
        coins5: zod_1.z.coerce.number().min(0).optional(),
    })
        .refine((data) => {
        const total = Object.entries(data).reduce((sum, [key, count]) => {
            const value = parseInt(key.replace("note", "")) || 1; // Use 1 for coins
            return sum + value * (count || 0);
        }, 0);
        return total >= 0;
    }, "At least one denomination must be entered"),
});
const closeAdminRegister = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, registerId } = req.params;
    const { data: validateFields, error } = closeRegisterSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // @ts-ignore
    const adminId = req.user.id;
    if (validateFields.userId !== adminId) {
        throw new bad_request_1.BadRequestsException("You are not authorized to close this register", root_1.ErrorCode.UNAUTHORIZED);
    }
    const result = yield adminRegisterService.closeRegister(adminId, registerId, validateFields.actualBalance, validateFields.closingNotes, validateFields.denominations);
    // Clear cache
    const register = yield __1.prismaDB.cashRegister.findUnique({
        where: { id: registerId },
        select: { restaurantId: true },
    });
    if (register) {
        yield redis_1.redis.del(`admin-register-${adminId}-${outletId}`);
    }
    return res.json({
        success: true,
        message: "Cash Register Closed Successfully",
        data: result,
    });
});
exports.closeAdminRegister = closeAdminRegister;
const getAdminRegisterStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    // @ts-ignore
    const adminId = req.user.id;
    const status = yield adminRegisterService.getRegisterStatus(adminId, outletId);
    return res.json({
        success: true,
        message: "Cash Register Status Fetched Successfully",
        data: status,
    });
});
exports.getAdminRegisterStatus = getAdminRegisterStatus;
