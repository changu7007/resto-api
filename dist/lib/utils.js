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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptData = exports.encryptData = exports.calculateInOut = exports.getDaysRemaining = exports.getVerificationTokenByToken = exports.getVerificationTokenByEmail = exports.generateVerificationToken = exports.getPeriodDates = exports.generateSlug = void 0;
const __1 = require("..");
const uuid_1 = require("uuid");
const secrets_1 = require("../secrets");
const crypto_js_1 = __importDefault(require("crypto-js"));
function generateSlug(name) {
    return name.toLowerCase().replace(/\s+/g, "-");
}
exports.generateSlug = generateSlug;
function getPeriodDates(period) {
    const now = new Date();
    let startDate;
    let endDate = now; // Default to now as the end date
    switch (period) {
        case "today":
            startDate = new Date(now.setHours(0, 0, 0, 0)); // Start of today
            endDate = new Date(now.setHours(23, 59, 59, 999)); // End of today
            break;
        case "yesterday":
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = new Date(yesterday.setHours(0, 0, 0, 0)); // Start of yesterday
            endDate = new Date(yesterday.setHours(23, 59, 59, 999)); // End of yesterday
            break;
        case "week":
            const lastWeek = new Date(now);
            lastWeek.setDate(now.getDate() - 7);
            startDate = new Date(lastWeek.setHours(0, 0, 0, 0)); // Start of last week
            endDate = now; // Now is the end date
            break;
        case "month":
            const lastMonth = new Date(now);
            lastMonth.setMonth(now.getMonth() - 1);
            startDate = new Date(lastMonth.setHours(0, 0, 0, 0)); // Start of last month
            endDate = now; // Now is the end date
            break;
        case "year":
            const lastYear = new Date(now);
            lastYear.setFullYear(now.getFullYear() - 1);
            startDate = new Date(lastYear.setHours(0, 0, 0, 0)); // Start of last year
            endDate = now; // Now is the end date
            break;
        default:
            startDate = new Date(0); // Beginning of time for "all"
            endDate = now;
            break;
    }
    return { startDate, endDate };
}
exports.getPeriodDates = getPeriodDates;
const generateVerificationToken = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const token = (0, uuid_1.v4)();
    const expires = new Date(new Date().getTime() + 3600 * 1000);
    const existingToken = yield (0, exports.getVerificationTokenByEmail)(email);
    if (existingToken) {
        yield __1.prismaDB.verificationToken.delete({
            where: {
                id: existingToken.id,
            },
        });
    }
    const verificationToken = yield __1.prismaDB.verificationToken.create({
        data: {
            email,
            token,
            expires,
        },
    });
    return verificationToken;
});
exports.generateVerificationToken = generateVerificationToken;
const getVerificationTokenByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = yield __1.prismaDB.verificationToken.findFirst({
            where: { email },
        });
        return token;
    }
    catch (error) {
        return null;
    }
});
exports.getVerificationTokenByEmail = getVerificationTokenByEmail;
const getVerificationTokenByToken = (token) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const verificationToken = yield __1.prismaDB.verificationToken.findFirst({
            where: { token },
        });
        return verificationToken;
    }
    catch (error) {
        return null;
    }
});
exports.getVerificationTokenByToken = getVerificationTokenByToken;
function getDaysRemaining(subscribedDate) {
    // Parse the subscribed date
    const subscribed = new Date(subscribedDate);
    // Get today's date
    const today = new Date();
    // Calculate the difference in time (in milliseconds)
    const timeDiff = subscribed.getTime() - today.getTime();
    // Calculate the difference in days
    const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    return daysRemaining;
}
exports.getDaysRemaining = getDaysRemaining;
const calculateInOut = (transactions) => {
    return transactions.reduce((balance, tx) => {
        return balance + tx.amount;
    }, 0);
};
exports.calculateInOut = calculateInOut;
const encryptData = (data) => {
    if (!secrets_1.ENCRYPT_KEY) {
        throw new Error("Encryption key is not configured. Please set ENCRYPT_KEY environment variable.");
    }
    return crypto_js_1.default.AES.encrypt(data, secrets_1.ENCRYPT_KEY).toString();
};
exports.encryptData = encryptData;
const decryptData = (ciphertext) => {
    if (!secrets_1.ENCRYPT_KEY) {
        throw new Error("Encryption key is not configured. Please set ENCRYPT_KEY environment variable.");
    }
    const bytes = crypto_js_1.default.AES.decrypt(ciphertext, secrets_1.ENCRYPT_KEY);
    return bytes.toString(crypto_js_1.default.enc.Utf8);
};
exports.decryptData = decryptData;
