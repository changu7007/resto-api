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
exports.updateUserProfileDetails = exports.generatePasswordResetToken = exports.deletePasswordResetToken = exports.updatePassword = exports.getPasswordResetTokenByEmail = exports.getPasswordResetTokenByToken = exports.getUserInfo = exports.generateTwoFactorToken = exports.createTwoFactorConfirmation = exports.twoFactorTokenDelete = exports.getTwoFactorTokenByToken = exports.get2FATokenByEmail = exports.delete2FAConfirmation = exports.get2FAConfirmationUser = exports.getUserByIdAndVerifyEmail = exports.getVerificationToken = exports.getUserByEmail = exports.getUserById = exports.registerOwner = exports.AppUpdateAccessToken = exports.AppLogout = exports.OwnerUser = exports.OwnerLogin = exports.socialAuthLogin = void 0;
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
const date_fns_1 = require("date-fns");
const unauthorized_1 = require("../../../exceptions/unauthorized");
const socialAuthLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { providerAccountId, name, email, image } = req.body;
    const findOwner = yield __1.prismaDB.user.findFirst({
        where: {
            providerAccountId: providerAccountId,
            email: email,
        },
        include: {
            restaurant: true,
            billings: {
                orderBy: {
                    createdAt: "desc",
                },
            },
        },
    });
    const findSubscription = findOwner === null || findOwner === void 0 ? void 0 : findOwner.billings.find((billing) => (billing === null || billing === void 0 ? void 0 : billing.userId) === findOwner.id);
    const renewalDay = (findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.userId) === (findOwner === null || findOwner === void 0 ? void 0 : findOwner.id)
        ? (0, utils_1.getDaysRemaining)(findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.validDate)
        : 0;
    const formatToSend = {
        id: findOwner === null || findOwner === void 0 ? void 0 : findOwner.id,
        name: findOwner === null || findOwner === void 0 ? void 0 : findOwner.name,
        email: findOwner === null || findOwner === void 0 ? void 0 : findOwner.email,
        emailVerified: findOwner === null || findOwner === void 0 ? void 0 : findOwner.emailVerified,
        phoneNo: findOwner === null || findOwner === void 0 ? void 0 : findOwner.phoneNo,
        image: findOwner === null || findOwner === void 0 ? void 0 : findOwner.image,
        role: findOwner === null || findOwner === void 0 ? void 0 : findOwner.role,
        isTwoFA: findOwner === null || findOwner === void 0 ? void 0 : findOwner.isTwoFactorEnabled,
        onboardingStatus: findOwner === null || findOwner === void 0 ? void 0 : findOwner.onboardingStatus,
        isSubscribed: renewalDay > 0 ? true : false,
        subscriptions: findOwner === null || findOwner === void 0 ? void 0 : findOwner.billings.map((billing) => ({
            id: billing.id,
            planName: billing.subscriptionPlan,
            paymentId: billing.paymentId,
            startDate: billing.subscribedDate,
            validDate: billing.validDate,
            amount: billing.paidAmount,
            validityDays: (0, date_fns_1.differenceInDays)(new Date(billing.validDate), new Date(billing.subscribedDate)),
            purchased: billing.paymentId ? "PURCHASED" : "NOT PURCHASED",
            status: renewalDay === 0 ? "EXPIRED" : "VALID",
        })),
        toRenewal: renewalDay,
        plan: findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.subscriptionPlan,
        outlets: findOwner === null || findOwner === void 0 ? void 0 : findOwner.restaurant.map((outlet) => ({
            id: outlet.id,
            name: outlet.name,
            image: outlet.imageUrl,
        })),
    };
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
        const findSubscription = user === null || user === void 0 ? void 0 : user.billings.find((billing) => (billing === null || billing === void 0 ? void 0 : billing.userId) === user.id);
        const renewalDay = (findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.userId) === user.id
            ? (0, utils_1.getDaysRemaining)(findSubscription.validDate)
            : 0;
        const formatToSend = {
            id: user === null || user === void 0 ? void 0 : user.id,
            name: user === null || user === void 0 ? void 0 : user.name,
            email: user === null || user === void 0 ? void 0 : user.email,
            emailVerified: user === null || user === void 0 ? void 0 : user.emailVerified,
            phoneNo: user === null || user === void 0 ? void 0 : user.phoneNo,
            image: user === null || user === void 0 ? void 0 : user.image,
            role: user === null || user === void 0 ? void 0 : user.role,
            onboardingStatus: user === null || user === void 0 ? void 0 : user.onboardingStatus,
            isTwoFA: findOwner === null || findOwner === void 0 ? void 0 : findOwner.isTwoFactorEnabled,
            isSubscribed: renewalDay > 0 ? true : false,
            subscriptions: user === null || user === void 0 ? void 0 : user.billings.map((billing) => ({
                id: billing.id,
                planName: billing.subscriptionPlan,
                paymentId: billing.paymentId,
                startDate: billing.subscribedDate,
                validDate: billing.validDate,
                amount: billing.paidAmount,
                validityDays: (0, date_fns_1.differenceInDays)(new Date(billing.validDate), new Date(billing.subscribedDate)),
                purchased: billing.paymentId ? "PURCHASED" : "NOT PURCHASED",
                status: renewalDay === 0 ? "EXPIRED" : "VALID",
            })),
            toRenewal: renewalDay,
            plan: findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.subscriptionPlan,
            outlets: user === null || user === void 0 ? void 0 : user.restaurant.map((outlet) => ({
                id: outlet.id,
                name: outlet.name,
                image: outlet.imageUrl,
            })),
        };
        (0, jwt_1.sendToken)(formatToSend, 200, res);
    }
    else
        (0, jwt_1.sendToken)(formatToSend, 200, res);
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
    const findSubscription = findOwner === null || findOwner === void 0 ? void 0 : findOwner.billings.find((billing) => (billing === null || billing === void 0 ? void 0 : billing.userId) === findOwner.id);
    const renewalDay = (findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.userId) === findOwner.id
        ? (0, utils_1.getDaysRemaining)(findSubscription.validDate)
        : 0;
    const formatToSend = {
        id: findOwner === null || findOwner === void 0 ? void 0 : findOwner.id,
        name: findOwner === null || findOwner === void 0 ? void 0 : findOwner.name,
        email: findOwner === null || findOwner === void 0 ? void 0 : findOwner.email,
        emailVerified: findOwner === null || findOwner === void 0 ? void 0 : findOwner.emailVerified,
        phoneNo: findOwner === null || findOwner === void 0 ? void 0 : findOwner.phoneNo,
        image: findOwner === null || findOwner === void 0 ? void 0 : findOwner.image,
        role: findOwner === null || findOwner === void 0 ? void 0 : findOwner.role,
        onboardingStatus: findOwner === null || findOwner === void 0 ? void 0 : findOwner.onboardingStatus,
        isTwoFA: findOwner === null || findOwner === void 0 ? void 0 : findOwner.isTwoFactorEnabled,
        isSubscribed: renewalDay > 0 ? true : false,
        subscriptions: findOwner === null || findOwner === void 0 ? void 0 : findOwner.billings.map((billing) => ({
            id: billing.id,
            planName: billing.subscriptionPlan,
            paymentId: billing.paymentId,
            startDate: billing.subscribedDate,
            validDate: billing.validDate,
            amount: billing.paidAmount,
            validityDays: (0, date_fns_1.differenceInDays)(new Date(billing.validDate), new Date(billing.subscribedDate)),
            purchased: billing.paymentId ? "PURCHASED" : "NOT PURCHASED",
            status: renewalDay === 0 ? "EXPIRED" : "VALID",
        })),
        toRenewal: renewalDay,
        plan: findSubscription === null || findSubscription === void 0 ? void 0 : findSubscription.subscriptionPlan,
        outlets: findOwner === null || findOwner === void 0 ? void 0 : findOwner.restaurant.map((outlet) => ({
            id: outlet.id,
            name: outlet.name,
            image: outlet.imageUrl,
        })),
    };
    (0, jwt_1.sendToken)(formatToSend, 200, res);
});
exports.OwnerLogin = OwnerLogin;
const OwnerUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // @ts-ignore
    return res.json(req.user);
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
        throw new not_found_1.NotFoundException("User Not Found", root_1.ErrorCode.NOT_FOUND);
    }
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
});
exports.AppUpdateAccessToken = AppUpdateAccessToken;
const registerOwner = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, name, password, phoneNo } = req.body;
    const user = yield __1.prismaDB.user.findUnique({
        where: {
            email,
        },
    });
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
    console.log("UserId", userId);
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
        include: {
            restaurant: true,
            billings: true,
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
