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
exports.GetPOSUser = exports.StaffPOSLogout = exports.StaffPOSLogin = void 0;
const __1 = require("../../..");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const get_users_1 = require("../../../lib/get-users");
const jwt_1 = require("../../../services/jwt");
const redis_1 = require("../../../services/redis");
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
