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
exports.deleteVerificationToken = exports.updateUserEmailVerification = exports.getVerificationTokenByToken = exports.getVerificationTokenByEmail = void 0;
const __1 = require("../..");
const not_found_1 = require("../../exceptions/not-found");
const root_1 = require("../../exceptions/root");
const getVerificationTokenByEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.params;
    const token = yield __1.prismaDB.verificationToken.findFirst({
        where: { email },
    });
    return res.json({ success: true, token });
});
exports.getVerificationTokenByEmail = getVerificationTokenByEmail;
const getVerificationTokenByToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token } = req.params;
    const verificationToken = yield __1.prismaDB.verificationToken.findFirst({
        where: { token },
    });
    return res.json({ success: true, verificationToken });
});
exports.getVerificationTokenByToken = getVerificationTokenByToken;
const updateUserEmailVerification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId, email } = req.body;
    const findUser = yield __1.prismaDB.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!findUser) {
        throw new not_found_1.NotFoundException("User Not FOund", root_1.ErrorCode.NOT_FOUND);
    }
    yield __1.prismaDB.user.update({
        where: {
            id: findUser.id,
        },
        data: {
            emailVerified: new Date(),
            email: email,
        },
    });
    return res.json({
        success: true,
        message: "User email has Verified",
    });
});
exports.updateUserEmailVerification = updateUserEmailVerification;
const deleteVerificationToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const findVerificationToken = yield __1.prismaDB.verificationToken.findFirst({
        where: {
            id,
        },
    });
    if (findVerificationToken === null || findVerificationToken === void 0 ? void 0 : findVerificationToken.id) {
        yield __1.prismaDB.verificationToken.delete({
            where: { id: findVerificationToken === null || findVerificationToken === void 0 ? void 0 : findVerificationToken.id },
        });
        return res.json({
            success: true,
            message: "Verifcation Token Deleted",
        });
    }
});
exports.deleteVerificationToken = deleteVerificationToken;
