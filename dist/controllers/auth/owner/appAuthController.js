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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendInvite = exports.verifyInvite = exports.getDashboardInvite = exports.InviteUserToDashboard = exports.updateUserProfileDetails = exports.generatePasswordResetToken = exports.deletePasswordResetToken = exports.updatePassword = exports.getPasswordResetTokenByEmail = exports.getPasswordResetTokenByToken = exports.getUserInfo = exports.generateTwoFactorToken = exports.createTwoFactorConfirmation = exports.twoFactorTokenDelete = exports.getTwoFactorTokenByToken = exports.get2FATokenByEmail = exports.delete2FAConfirmation = exports.get2FAConfirmationUser = exports.getUserByIdAndVerifyEmail = exports.getVerificationToken = exports.getUserByEmail = exports.getUserById = exports.registerOwner = exports.AppUpdateAccessToken = exports.AppLogout = exports.OwnerUser = exports.OwnerLogin = exports.socialAuthLogin = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jwt = __importStar(require("jsonwebtoken"));
const secrets_1 = require("../../../secrets");
const bad_request_1 = require("../../../exceptions/bad-request");
const root_1 = require("../../../exceptions/root");
const staff_1 = require("../../../schema/staff");
const not_found_1 = require("../../../exceptions/not-found");
const jwt_1 = require("../../../services/jwt");
const redis_1 = require("../../../services/redis");
const get_users_1 = require("../../../lib/get-users");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const __1 = require("../../..");
const utils_1 = require("../../../lib/utils");
const uuid_1 = require("uuid");
const unauthorized_1 = require("../../../exceptions/unauthorized");
const outlet_1 = require("../../../lib/outlet");
const zod_1 = require("zod");
const socialAuthLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { providerAccountId, name, email, image } = req.body;
    const findOwner = yield __1.prismaDB.user.findFirst({
        where: {
            providerAccountId: providerAccountId,
            email: email,
        },
    });
    if (!(findOwner === null || findOwner === void 0 ? void 0 : findOwner.id)) {
        const user = yield __1.prismaDB.user.create({
            data: {
                name,
                email,
                image,
                providerAccountId: providerAccountId,
                emailVerified: new Date(),
            },
            include: {
                restaurant: true,
                billings: true,
            },
        });
        const formatToSend = yield (0, get_users_1.getFormatUserAndSendToRedis)(user === null || user === void 0 ? void 0 : user.id);
        (0, jwt_1.sendToken)(formatToSend, 200, res);
    }
    else {
        const formatToSend = yield (0, get_users_1.getFormatUserAndSendToRedis)(findOwner === null || findOwner === void 0 ? void 0 : findOwner.id);
        (0, jwt_1.sendToken)(formatToSend, 200, res);
    }
});
exports.socialAuthLogin = socialAuthLogin;
const OwnerLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    staff_1.userSchema.parse(req.body);
    const { email, password } = req.body;
    const findOwner = yield (0, get_users_1.getOwnerUserByEmail)(email);
    if (!findOwner) {
        throw new not_found_1.NotFoundException("User has not been registered", root_1.ErrorCode.NOT_FOUND);
    }
    const isPassword = yield bcryptjs_1.default.compare(password, findOwner.hashedPassword);
    if (!isPassword) {
        throw new bad_request_1.BadRequestsException("Incorrect Password", root_1.ErrorCode.INCORRECT_PASSWORD);
    }
    const formatToSend = yield (0, get_users_1.getFormatUserAndSendToRedis)(findOwner === null || findOwner === void 0 ? void 0 : findOwner.id);
    (0, jwt_1.sendToken)(formatToSend, 200, res);
});
exports.OwnerLogin = OwnerLogin;
const OwnerUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    return res.json({ success: true, users: req === null || req === void 0 ? void 0 : req.user });
});
exports.OwnerUser = OwnerUser;
const AppLogout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    const deletedRedisUser = yield redis_1.redis.del(req.user.id);
    res.status(200).json({
        success: true,
        deletedRedisUser,
        message: "Logged out successfuly",
    });
});
exports.AppLogout = AppLogout;
const AppUpdateAccessToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const authHeader = req.headers.authorization;
    const refresh_token = authHeader && authHeader.split(" ")[1];
    const payload = jwt.verify(refresh_token, secrets_1.REFRESH_TOKEN);
    if (!payload) {
        throw new not_found_1.NotFoundException("Could Not refresh token", root_1.ErrorCode.TOKENS_NOT_VALID);
    }
    const session = yield redis_1.redis.get(payload.id);
    if (!session) {
        const user = yield __1.prismaDB.user.findUnique({
            where: {
                id: payload.id,
            },
        });
        if (!user) {
            throw new unauthorized_1.UnauthorizedException("Session expired, please login again", root_1.ErrorCode.UNAUTHORIZED);
        }
        yield (0, get_users_1.getFormatUserAndSendToRedis)(user === null || user === void 0 ? void 0 : user.id);
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
exports.AppUpdateAccessToken = AppUpdateAccessToken;
const registerOwner = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, name, password, phoneNo } = req.body;
    const user = yield __1.prismaDB.user.findUnique({
        where: {
            email,
        },
    });
    const userPhoneNo = yield __1.prismaDB.user.findFirst({
        where: {
            phoneNo,
        },
    });
    if (userPhoneNo === null || userPhoneNo === void 0 ? void 0 : userPhoneNo.id) {
        throw new bad_request_1.BadRequestsException("This Phone No. is already Registered", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if (!(user === null || user === void 0 ? void 0 : user.id)) {
        const hashedPassword = yield bcryptjs_1.default.hash(password, 12);
        yield __1.prismaDB.user.create({
            data: {
                email,
                name,
                phoneNo,
                role: client_1.UserRole.ADMIN,
                hashedPassword,
            },
        });
        const verificationToken = yield (0, utils_1.generateVerificationToken)(email);
        return res.json({
            success: true,
            token: verificationToken.token,
            email: verificationToken.email,
            message: "User Create Successfully",
        });
    }
    else {
        throw new bad_request_1.BadRequestsException("This Email already Exist & registered", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
});
exports.registerOwner = registerOwner;
const getUserById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const ruser = yield redis_1.redis.get(id);
    if (ruser) {
        return res.json({
            success: true,
            user: JSON.parse(ruser),
        });
    }
    const user = yield __1.prismaDB.user.findFirst({
        where: {
            id,
        },
    });
    if (!(user === null || user === void 0 ? void 0 : user.id)) {
        throw new not_found_1.NotFoundException("User Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const formatToSend = yield (0, get_users_1.getFormatUserAndSendToRedis)(user === null || user === void 0 ? void 0 : user.id);
    return res.json({
        success: true,
        user: formatToSend,
        message: "Fetched User",
    });
});
exports.getUserById = getUserById;
const getUserByEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.params;
    const user = yield __1.prismaDB.user.findFirst({
        where: {
            email,
        },
    });
    return res.json({
        success: true,
        user,
        message: "Fetched User",
    });
});
exports.getUserByEmail = getUserByEmail;
const getVerificationToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.params;
    const verificationToken = yield (0, utils_1.generateVerificationToken)(email);
    return res.json({
        success: true,
        verificationToken,
        message: "Verification Generated Token Success ✅",
    });
});
exports.getVerificationToken = getVerificationToken;
const getUserByIdAndVerifyEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.body;
    const user = yield __1.prismaDB.user.findFirst({
        where: {
            id,
        },
    });
    if (user === null || user === void 0 ? void 0 : user.id) {
        yield __1.prismaDB.user.update({
            where: {
                id: user.id,
            },
            data: { emailVerified: new Date() },
        });
    }
    return res.json({
        success: true,
        user,
        message: "Verified User",
    });
});
exports.getUserByIdAndVerifyEmail = getUserByIdAndVerifyEmail;
const get2FAConfirmationUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const twoFactorConfirmation = yield __1.prismaDB.twoFactorConfirmation.findUnique({
        where: { userId: userId },
    });
    console.log("twoFactorConfirmation", twoFactorConfirmation);
    return res.json({
        success: true,
        twoFactorConfirmation,
    });
});
exports.get2FAConfirmationUser = get2FAConfirmationUser;
const delete2FAConfirmation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const twoFAConfirmation = yield __1.prismaDB.twoFactorConfirmation.delete({
        where: {
            id: id,
        },
    });
    return res.json({
        success: true,
        twoFAConfirmation,
    });
});
exports.delete2FAConfirmation = delete2FAConfirmation;
const get2FATokenByEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.params;
    const token = yield __1.prismaDB.twoFactorToken.findFirst({
        where: { email },
    });
    return res.json({ success: true, token });
});
exports.get2FATokenByEmail = get2FATokenByEmail;
const getTwoFactorTokenByToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token } = req.params;
    const twoFactorToken = yield __1.prismaDB.twoFactorToken.findFirst({
        where: { token },
    });
    return res.json({ success: true, twoFactorToken });
});
exports.getTwoFactorTokenByToken = getTwoFactorTokenByToken;
const twoFactorTokenDelete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const deleteTwoFactorToken = yield __1.prismaDB.twoFactorToken.delete({
        where: { id: id },
    });
    return res.json({ success: true, deleteTwoFactorToken });
});
exports.twoFactorTokenDelete = twoFactorTokenDelete;
const createTwoFactorConfirmation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.body;
    yield __1.prismaDB.twoFactorConfirmation.create({
        data: {
            userId: userId,
        },
    });
    return res.json({
        success: true,
        message: "2FA Confirmation Created",
    });
});
exports.createTwoFactorConfirmation = createTwoFactorConfirmation;
const generateTwoFactorToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    const token = crypto_1.default.randomInt(100000, 1000000).toString();
    const expires = new Date(new Date().getTime() + 5 + 60 * 1000);
    const twoFactorToken = yield __1.prismaDB.twoFactorToken.create({
        data: {
            email,
            token,
            expires,
        },
    });
    return res.json({
        success: true,
        message: "Token Generated",
        twoFactorToken,
    });
});
exports.generateTwoFactorToken = generateTwoFactorToken;
const getUserInfo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // @ts-ignore
    const userId = (_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a.id;
    const redisUser = yield redis_1.redis.get(userId);
    if (redisUser) {
        return res.json({
            success: true,
            users: JSON.parse(redisUser),
        });
    }
    const findOwner = yield __1.prismaDB.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!(findOwner === null || findOwner === void 0 ? void 0 : findOwner.id)) {
        throw new not_found_1.NotFoundException("User not found", root_1.ErrorCode.UNAUTHORIZED);
    }
    const formatToSend = yield (0, get_users_1.getFormatUserAndSendToRedis)(findOwner === null || findOwner === void 0 ? void 0 : findOwner.id);
    return res.json({
        success: true,
        users: formatToSend,
    });
});
exports.getUserInfo = getUserInfo;
const getPasswordResetTokenByToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token } = req.body;
    const passwordResetToken = yield __1.prismaDB.passwordResetToken.findFirst({
        where: { token },
    });
    return res.json({
        success: true,
        passwordResetToken,
    });
});
exports.getPasswordResetTokenByToken = getPasswordResetTokenByToken;
const getPasswordResetTokenByEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    const passwordResetToken = yield __1.prismaDB.passwordResetToken.findFirst({
        where: { email },
    });
    return res.json({
        success: true,
        passwordResetToken,
    });
});
exports.getPasswordResetTokenByEmail = getPasswordResetTokenByEmail;
const updatePassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { hashedPassword } = req.body;
    yield __1.prismaDB.user.update({
        where: {
            id: id,
        },
        data: {
            hashedPassword: hashedPassword,
        },
    });
    return res.json({
        success: true,
    });
});
exports.updatePassword = updatePassword;
const deletePasswordResetToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    yield __1.prismaDB.passwordResetToken.delete({
        where: { id: id },
    });
    return res.json({
        success: true,
        mesage: "Password Reset Token Deleted",
    });
});
exports.deletePasswordResetToken = deletePasswordResetToken;
const generatePasswordResetToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    const token = (0, uuid_1.v4)();
    const expires = new Date(new Date().getTime() + 3600 * 1000);
    const passwordResetToken = yield __1.prismaDB.passwordResetToken.create({
        data: {
            email,
            token,
            expires,
        },
    });
    return res.json({ success: true, passwordResetToken });
});
exports.generatePasswordResetToken = generatePasswordResetToken;
const updateUserProfileDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { userId } = req.params;
    // @ts-ignore
    const reqUserId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
    const { name, phoneNo, isTwoFA, imageUrl } = req.body;
    if (userId !== reqUserId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findUser = yield __1.prismaDB.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!(findUser === null || findUser === void 0 ? void 0 : findUser.id)) {
        throw new not_found_1.NotFoundException("User Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    if (findUser.phoneNo !== phoneNo) {
        const uniqueNo = yield __1.prismaDB.user.findFirst({
            where: {
                phoneNo: phoneNo,
            },
        });
        if (uniqueNo === null || uniqueNo === void 0 ? void 0 : uniqueNo.id) {
            throw new bad_request_1.BadRequestsException("This Phone No. is already assigned to different USer", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    const updateUSer = yield __1.prismaDB.user.update({
        where: {
            id: findUser === null || findUser === void 0 ? void 0 : findUser.id,
        },
        data: {
            name: name,
            image: imageUrl,
            phoneNo: phoneNo,
            isTwoFactorEnabled: isTwoFA,
        },
    });
    yield (0, get_users_1.getFormatUserAndSendToRedis)(updateUSer === null || updateUSer === void 0 ? void 0 : updateUSer.id);
    return res.json({
        success: true,
        message: "Update Profile Success ✅",
    });
});
exports.updateUserProfileDetails = updateUserProfileDetails;
const formInviteSchema = zod_1.z.object({
    email: zod_1.z.string({ required_error: "Valid Email Required" }),
    role: zod_1.z.enum(["MANAGER", "ACCOUNTANT", "PARTNER", "FRONTDESK"]),
    accessType: zod_1.z.enum(["FULL_ACCESS", "CUSTOM_ACCESS"]),
    permissions: zod_1.z.array(zod_1.z.string()).optional(),
});
const InviteUserToDashboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d, _e;
    const { outletId } = req.params;
    const validateFields = formInviteSchema.safeParse(req.body);
    if (!validateFields.success) {
        throw new bad_request_1.BadRequestsException("Invalid Request", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // @ts-ignore
    if ((getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.adminId) !== ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id)) {
        throw new unauthorized_1.UnauthorizedException("Your not Authorized for this access, Only Owner can Invite Users", root_1.ErrorCode.UNAUTHORIZED);
    }
    //@ts-ignore
    if (((_d = req === null || req === void 0 ? void 0 : req.user) === null || _d === void 0 ? void 0 : _d.email) === ((_e = validateFields === null || validateFields === void 0 ? void 0 : validateFields.data) === null || _e === void 0 ? void 0 : _e.email)) {
        throw new bad_request_1.BadRequestsException("You can't invite yourself", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const token = (0, uuid_1.v4)();
    const expires = new Date(new Date().getTime() + 3600 * 24 * 1000);
    const findInvite = yield __1.prismaDB.invite.findFirst({
        where: {
            email: validateFields.data.email,
        },
    });
    if (findInvite) {
        throw new bad_request_1.BadRequestsException("User has been Invited", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    console.log(`Permissions ${validateFields.data.permissions}`);
    // Determine permissions based on access type
    const permissions = validateFields.data.accessType === "FULL_ACCESS"
        ? [
            "dashboard",
            "pos",
            "orders",
            "order_transactions",
            "inventory",
            "expenses",
            "manage_tables",
            "manage_food",
            "staffs",
            "staff_attendance",
            "customers",
            "payroll",
            "integration",
            "settings",
        ]
        : validateFields.data.permissions || [];
    yield __1.prismaDB.invite.create({
        data: {
            email: validateFields.data.email,
            expires: expires,
            role: validateFields.data.role,
            restaurantId: getOutlet.id,
            invitedBy: getOutlet.adminId,
            accessType: validateFields.data.accessType,
            permissions: permissions,
            token: token,
        },
    });
    return res.json({
        success: true,
        token: token,
    });
});
exports.InviteUserToDashboard = InviteUserToDashboard;
const getDashboardInvite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const invites = yield __1.prismaDB.invite.findMany({
        where: {
            restaurantId: getOutlet.id,
        },
        select: {
            id: true,
            email: true,
            status: true,
            expires: true,
            token: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            accessType: true,
            permissions: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
    return res.json({
        success: true,
        invites: invites,
    });
});
exports.getDashboardInvite = getDashboardInvite;
const verifyInvite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, token } = req.params;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("No Outlet found for this Invite", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const getToken = yield __1.prismaDB.invite.findFirst({
        where: {
            token: token,
            restaurantId: outletId,
        },
    });
    if (!getToken) {
        throw new not_found_1.NotFoundException("No Invitation found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    console.log("Now Date", new Date());
    console.log("Expiry Date", new Date(getToken.expires));
    const hasExpired = new Date() > new Date(getToken.expires);
    if (hasExpired) {
        throw new bad_request_1.BadRequestsException("Token Expired", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Check if user already has access to this restaurant
    const existingAccess = yield __1.prismaDB.userRestaurantAccess.findFirst({
        where: {
            AND: [
                { restaurant: { id: outletId } },
                { user: { email: getToken.email } },
            ],
        },
    });
    if (existingAccess) {
        throw new bad_request_1.BadRequestsException("This user already has access to this outlet", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Find or create user
    let user = yield __1.prismaDB.user.findUnique({
        where: { email: getToken.email },
    });
    if (!user) {
        // Create new user if they don't exist
        user = yield __1.prismaDB.user.create({
            data: {
                email: getToken.email,
                role: getToken.role, // Default role for invited users
                name: getToken.email.split("@")[0], // Default name from email
            },
        });
    }
    // Create UserRestaurantAccess entry
    yield __1.prismaDB.userRestaurantAccess.create({
        data: {
            userId: user.id,
            restaurantId: outletId,
            role: getToken.role,
            permissions: getToken.permissions, // Make sure to add this field to UserRestaurantAccess model
            accessType: getToken.accessType, // Make sure to add this field to UserRestaurantAccess model
        },
    });
    yield __1.prismaDB.invite.update({
        where: {
            id: getToken === null || getToken === void 0 ? void 0 : getToken.id,
        },
        data: {
            status: "ACCEPTED",
        },
    });
    return res.json({
        success: true,
        message: "User Joining Success",
    });
});
exports.verifyInvite = verifyInvite;
const resendInvite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { email } = req.body;
    const getOutlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(getOutlet === null || getOutlet === void 0 ? void 0 : getOutlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const invite = yield __1.prismaDB.invite.findFirst({
        where: {
            email: email,
        },
    });
    if (!invite) {
        throw new bad_request_1.BadRequestsException("No Invite found", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    const expires = new Date(new Date().getTime() + 3600 * 24 * 1000);
    yield __1.prismaDB.invite.update({
        where: {
            id: invite === null || invite === void 0 ? void 0 : invite.id,
        },
        data: {
            expires: expires,
        },
    });
    return res.json({
        success: true,
        message: "Invitation Resent",
    });
});
exports.resendInvite = resendInvite;
