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
const node_cron_1 = __importDefault(require("node-cron"));
const __1 = require("../..");
const payroll_1 = require("../../lib/payroll");
// Schedule payroll processing at the end of each month for monthly payrolls
node_cron_1.default.schedule("0 0 28-31 * *", () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const monthlyStaff = yield __1.prismaDB.staff.findMany({
            where: {
                payFrequency: "MONTHLY",
            },
        });
        for (const staff of monthlyStaff) {
            const response = yield (0, payroll_1.createPayrollForStaff)(staff.id);
            console.log(`Payroll for ${staff.name}:`, response === null || response === void 0 ? void 0 : response.amountPaid);
        }
    }
    catch (error) {
        console.error("Error running payroll cron job:", error);
    }
}));
// Schedule weekly payroll processing for weekly payrolls
node_cron_1.default.schedule("0 0 * * 0", () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const weeklyStaff = yield __1.prismaDB.staff.findMany({
            where: {
                payFrequency: "WEEKLY",
            },
        });
        for (const staff of weeklyStaff) {
            const response = yield (0, payroll_1.createPayrollForStaff)(staff.id);
            console.log(`Payroll for ${staff.name}:`, response === null || response === void 0 ? void 0 : response.amountPaid);
        }
    }
    catch (error) {
        console.error("Error running payroll cron job:", error);
    }
}));
// Schedule biweekly payroll processing for biweekly payrolls
node_cron_1.default.schedule("0 0 14,28 * *", () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const biweeklyStaff = yield __1.prismaDB.staff.findMany({
            where: {
                payFrequency: "BIWEEKLY",
            },
        });
        for (const staff of biweeklyStaff) {
            const response = yield (0, payroll_1.createPayrollForStaff)(staff.id);
            console.log(`Payroll for ${staff.name}:`, response === null || response === void 0 ? void 0 : response.amountPaid);
        }
    }
    catch (error) {
        console.error("Error running payroll cron job:", error);
    }
}));
