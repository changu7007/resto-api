"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.getLatestRecordByStaffId = exports.staffCheckOut = exports.staffCheckIn = exports.StaffUpdateAccessToken = exports.StaffLogout = exports.GetStaff = exports.StaffLogin = void 0;
const __1 = require("../../..");
const jwt = __importStar(require("jsonwebtoken"));
const secrets_1 = require("../../../secrets");
const bad_request_1 = require("../../../exceptions/bad-request");
const root_1 = require("../../../exceptions/root");
const not_found_1 = require("../../../exceptions/not-found");
const jwt_1 = require("../../../services/jwt");
const redis_1 = require("../../../services/redis");
const get_users_1 = require("../../../lib/get-users");
const unauthorized_1 = require("../../../exceptions/unauthorized");
const date_fns_1 = require("date-fns");
const StaffLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // staffSchema.parse(req.body);
    // const { email, password } = req.body;
    const { role, phone } = req.body;
    console.log(req.body);
    const checkStaff = yield __1.prismaDB.staff.findFirst({
        where: {
            // email: email,
            role: role,
            phoneNo: phone,
        },
    });
    if (!(checkStaff === null || checkStaff === void 0 ? void 0 : checkStaff.id)) {
        throw new not_found_1.NotFoundException("Staff Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    // if (checkStaff.password !== password) {
    //   throw new BadRequestsException(
    //     "Incorrect Password",
    //     ErrorCode.INCORRECT_PASSWORD
    //   );
    // }
    const formattedStaff = yield (0, get_users_1.getFormatStaffAndSendToRedis)(checkStaff.id);
    (0, jwt_1.sendToken)(formattedStaff, 200, res);
});
exports.StaffLogin = StaffLogin;
const GetStaff = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // @ts-ignore
    const staffId = (_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.id;
    const redisStaff = yield redis_1.redis.get(staffId);
    if (redisStaff) {
        return res.json({
            success: true,
            message: "Staff Fetched Successfully",
            staff: JSON.parse(redisStaff),
        });
    }
    else {
        const formattedStaff = yield (0, get_users_1.getFormatStaffAndSendToRedis)(staffId);
        return res.json({
            success: true,
            message: "Staff Fetched Successfully",
            staff: formattedStaff,
        });
    }
});
exports.GetStaff = GetStaff;
const StaffLogout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const deletedRedisStaff = yield redis_1.redis.del(req.staff.id);
    res.status(200).json({
        success: true,
        deletedRedisStaff,
        message: "Logged out successfuly",
    });
});
exports.StaffLogout = StaffLogout;
const StaffUpdateAccessToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers.authorization;
    const refresh_token = authHeader && authHeader.split(" ")[1];
    const payload = jwt.verify(refresh_token, secrets_1.REFRESH_TOKEN);
    if (!payload) {
        throw new not_found_1.NotFoundException("Could Not refresh token", root_1.ErrorCode.TOKENS_NOT_VALID);
    }
    const session = yield redis_1.redis.get(payload.id);
    if (!session) {
        const user = yield __1.prismaDB.staff.findUnique({
            where: {
                id: payload.id,
            },
        });
        if (!user) {
            throw new unauthorized_1.UnauthorizedException("Session expired, please login again", root_1.ErrorCode.UNAUTHORIZED);
        }
        yield (0, get_users_1.getFormatStaffAndSendToRedis)(user === null || user === void 0 ? void 0 : user.id);
        const accessToken = jwt.sign({ id: user.id }, secrets_1.ACCESS_TOKEN, {
            expiresIn: "5m",
        });
        const refreshToken = jwt.sign({ id: user === null || user === void 0 ? void 0 : user.id }, secrets_1.REFRESH_TOKEN, {
            expiresIn: "7d",
        });
        res.status(200).json({
            success: true,
            tokens: {
                accessToken,
                refreshToken,
            },
        });
    }
    else {
        const user = JSON.parse(session);
        const accessToken = jwt.sign({ id: user.id }, secrets_1.ACCESS_TOKEN, {
            expiresIn: "5m",
        });
        const refreshToken = jwt.sign({ id: user === null || user === void 0 ? void 0 : user.id }, secrets_1.REFRESH_TOKEN, {
            expiresIn: "7d",
        });
        res.status(200).json({
            success: true,
            tokens: {
                accessToken,
                refreshToken,
            },
        });
    }
});
exports.StaffUpdateAccessToken = StaffUpdateAccessToken;
const staffCheckIn = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    // @ts-ignore
    const id = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
    const { staffId } = req.body;
    if (id !== staffId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findStaff = yield __1.prismaDB.staff.findFirst({
        where: {
            id: staffId,
        },
    });
    if (!findStaff) {
        throw new not_found_1.NotFoundException("Staff Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const staffCheckIn = yield __1.prismaDB.checkInRecord.create({
        data: {
            staffId: id,
            checkInTime: new Date(),
        },
    });
    const formattedStaff = yield (0, get_users_1.getFormatStaffAndSendToRedis)(findStaff.id);
    return res.json({
        success: true,
        message: "Check In Successfully",
        staffCheckIn,
        staff: formattedStaff,
    });
});
exports.staffCheckIn = staffCheckIn;
const staffCheckOut = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    // @ts-ignore
    const id = (_c = req.user) === null || _c === void 0 ? void 0 : _c.id;
    const { staffId } = req.body;
    if (id !== staffId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findStaff = yield __1.prismaDB.staff.findFirst({
        where: {
            id: staffId,
        },
        include: {
            checkIns: {
                orderBy: {
                    checkInTime: "desc",
                },
            },
        },
    });
    if (!findStaff) {
        throw new not_found_1.NotFoundException("Staff Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const staffCheckOut = yield __1.prismaDB.checkInRecord.update({
        where: {
            id: findStaff.checkIns[0].id,
        },
        data: {
            checkOutTime: new Date(),
        },
    });
    const formattedStaff = yield (0, get_users_1.getFormatStaffAndSendToRedis)(findStaff.id);
    return res.json({
        success: true,
        message: "Check Out Successfully",
        staffCheckOut,
        staff: formattedStaff,
    });
});
exports.staffCheckOut = staffCheckOut;
const getLatestRecordByStaffId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    // @ts-ignore
    const staffId = (_d = req.user) === null || _d === void 0 ? void 0 : _d.id;
    const { id } = req.params;
    if (id !== staffId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    if (!id) {
        throw new bad_request_1.BadRequestsException("Staff Id is required", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    const findCheckIns = yield __1.prismaDB.checkInRecord.findFirst({
        where: {
            staffId: id,
        },
        orderBy: {
            checkInTime: "desc",
        },
    });
    if (!findCheckIns) {
        throw new not_found_1.NotFoundException("Check In Record Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const formattedCheckInTime = (findCheckIns === null || findCheckIns === void 0 ? void 0 : findCheckIns.checkInTime)
        ? (0, date_fns_1.format)(findCheckIns === null || findCheckIns === void 0 ? void 0 : findCheckIns.checkInTime, "hh:mm a")
        : undefined;
    yield (0, get_users_1.getFormatStaffAndSendToRedis)(id);
    return res.json(Object.assign(Object.assign({ success: true, message: "Latest Check In" }, findCheckIns), { checkInTime: formattedCheckInTime }));
});
exports.getLatestRecordByStaffId = getLatestRecordByStaffId;
