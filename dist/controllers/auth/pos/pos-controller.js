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
exports.POSUpdateAccessToken = exports.GetPOSUser = exports.StaffPOSLogout = exports.StaffPOSLogin = void 0;
const __1 = require("../../..");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const get_users_1 = require("../../../lib/get-users");
const jwt_1 = require("../../../services/jwt");
const redis_1 = require("../../../services/redis");
const jwt = __importStar(require("jsonwebtoken"));
const secrets_1 = require("../../../secrets");
const unauthorized_1 = require("../../../exceptions/unauthorized");
const StaffPOSLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // staffSchema.parse(req.body);
    // const { email, password } = req.body;
    const { email, password } = req.body;
    console.log(req.body);
    const checkStaff = yield __1.prismaDB.staff.findFirst({
        where: {
            email: email,
            password: password,
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
    const formattedStaff = yield (0, get_users_1.getFormatStaffPOSAndSendToRedis)(checkStaff.id);
    (0, jwt_1.sendToken)(formattedStaff, 200, res);
});
exports.StaffPOSLogin = StaffPOSLogin;
const StaffPOSLogout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // @ts-ignore
    const id = (_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.id;
    yield redis_1.redis.del(`pos-${id}`);
    return res.json({
        success: true,
        message: "Logged out successfully",
    });
});
exports.StaffPOSLogout = StaffPOSLogout;
const GetPOSUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    // @ts-ignore
    const id = (_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.id;
    const user = yield redis_1.redis.get(`pos-${id}`);
    if (user) {
        return res.json({ success: true, user: JSON.parse(user) });
    }
    const GetPOSUser = yield (0, get_users_1.getFormatStaffPOSAndSendToRedis)(id);
    return res.json({ success: true, user: GetPOSUser });
});
exports.GetPOSUser = GetPOSUser;
const POSUpdateAccessToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers.authorization;
    const refresh_token = authHeader && authHeader.split(" ")[1];
    const payload = jwt.verify(refresh_token, secrets_1.REFRESH_TOKEN);
    if (!payload) {
        throw new not_found_1.NotFoundException("Could Not refresh token", root_1.ErrorCode.TOKENS_NOT_VALID);
    }
    const session = yield redis_1.redis.get(`pos-${payload.id}`);
    if (!session) {
        const user = yield __1.prismaDB.staff.findUnique({
            where: {
                id: payload.id,
            },
        });
        if (!user) {
            throw new unauthorized_1.UnauthorizedException("Session expired, please login again", root_1.ErrorCode.UNAUTHORIZED);
        }
        yield (0, get_users_1.getFormatStaffPOSAndSendToRedis)(user === null || user === void 0 ? void 0 : user.id);
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
exports.POSUpdateAccessToken = POSUpdateAccessToken;
