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
exports.posGetRegisterStatus = exports.posStaffCheckOut = exports.posStaffCheckInAndRegister = void 0;
const root_1 = require("../../exceptions/root");
const unauthorized_1 = require("../../exceptions/unauthorized");
const __1 = require("../..");
const not_found_1 = require("../../exceptions/not-found");
const bad_request_1 = require("../../exceptions/bad-request");
const outlet_1 = require("../../lib/outlet");
const redis_1 = require("../../services/redis");
const zod_1 = require("zod");
const staffCheckInServices_1 = require("../../services/staffCheckInServices");
const staffCheckInService = new staffCheckInServices_1.StaffCheckInServices();
const openRegisterSchema = zod_1.z.object({
    staffId: zod_1.z.string(),
    openingBalance: zod_1.z.coerce.number().min(0, "Opening balance must be positive"),
    openingNotes: zod_1.z.string().optional(),
    denominations: zod_1.z.object({
        coins: zod_1.z.number().min(0, "Coins must be positive"),
        note500: zod_1.z.number().min(0, "₹500 Notes must be positive"),
        note200: zod_1.z.number().min(0, "₹200 Notes must be positive"),
        note100: zod_1.z.number().min(0, "₹100 Notes must be positive"),
        note50: zod_1.z.number().min(0, "₹50 Notes must be positive"),
        note20: zod_1.z.number().min(0, "₹20 Notes must be positive"),
        note10: zod_1.z.number().min(0, "₹10 Notes must be positive"),
        coins2: zod_1.z.number().min(0, "Coins 2 must be positive"),
        coins5: zod_1.z.number().min(0, "Coins 5 must be positive"),
    }),
});
const posStaffCheckInAndRegister = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    // @ts-ignore
    const { id } = req.user;
    const validatedBody = openRegisterSchema.safeParse(req.body);
    if (!validatedBody.success) {
        throw new bad_request_1.BadRequestsException("Invalid Request Body", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (id !== validatedBody.data.staffId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const { checkIn, register } = yield staffCheckInService.handleStaffChecIn(validatedBody.data.staffId, outletId, validatedBody.data.openingBalance, validatedBody.data.openingNotes, validatedBody.data.denominations);
    yield redis_1.redis.del(`pos-${validatedBody.data.staffId}`);
    return res.json({
        success: true,
        message: "Cash Register Opened Successfully",
        data: {
            checkIn,
            register,
        },
    });
});
exports.posStaffCheckInAndRegister = posStaffCheckInAndRegister;
const closeRegisterSchema = zod_1.z.object({
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
const posStaffCheckOut = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { outletId } = req.params;
    // @ts-ignore
    const id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    const validatedBody = closeRegisterSchema.safeParse(req.body);
    if (!validatedBody.success) {
        throw new bad_request_1.BadRequestsException((_c = (_b = validatedBody.error) === null || _b === void 0 ? void 0 : _b.errors[0]) === null || _c === void 0 ? void 0 : _c.message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const { checkIn, register, summary } = yield staffCheckInService.handleStaffCheckOut(id, validatedBody.data.actualBalance, validatedBody.data.closingNotes, validatedBody.data.denominations);
    // Clear any cached POS data for this staff
    yield redis_1.redis.del(`pos-${id}`);
    return res.json({
        success: true,
        message: "Cash Register Closed Successfully",
        data: {
            checkIn,
            register,
            summary,
        },
    });
});
exports.posStaffCheckOut = posStaffCheckOut;
const posGetRegisterStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    const { outletId } = req.params;
    // @ts-ignore
    const id = (_d = req.user) === null || _d === void 0 ? void 0 : _d.id;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const register = yield __1.prismaDB.cashRegister.findFirst({
        where: {
            restaurantId: outletId,
            status: "OPEN",
            openedBy: id,
        },
        include: {
            transactions: {
                include: {
                    order: true,
                    expense: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            },
            staff: {
                select: {
                    name: true,
                    role: true,
                },
            },
            user: {
                select: {
                    name: true,
                    role: true,
                },
            },
        },
    });
    return res.status(200).json({
        success: true,
        data: register,
    });
});
exports.posGetRegisterStatus = posGetRegisterStatus;
