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
exports.createPayrollForStaff = void 0;
const __1 = require("../..");
const bad_request_1 = require("../../exceptions/bad-request");
const not_found_1 = require("../../exceptions/not-found");
const root_1 = require("../../exceptions/root");
// Calculate payroll for a specific staff and store a record
const createPayrollForStaff = (staffId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!staffId) {
        throw new bad_request_1.BadRequestsException("Staff Id is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    try {
        // Fetch staff details from the database
        const staff = yield __1.prismaDB.staff.findUnique({
            where: {
                id: staffId,
            },
        });
        if (!(staff === null || staff === void 0 ? void 0 : staff.id)) {
            throw new not_found_1.NotFoundException("Staff Not Found", root_1.ErrorCode.NOT_FOUND);
        }
        // Payroll calculation logic
        const baseSalary = parseFloat(staff.salary);
        const allowances = staff.allowances ? Number(staff.allowances) : 0;
        const deductions = staff.deductions ? Number(staff.deductions) : 0;
        const netPay = baseSalary + allowances - deductions;
        // Create a payroll record
        const staffPayrolll = yield __1.prismaDB.payroll.create({
            data: {
                staffId: staff.id,
                amountPaid: netPay,
                payFrequency: staff.payFrequency,
            },
        });
        return staffPayrolll;
    }
    catch (error) {
        console.error("Error calculating payroll:", error);
    }
});
exports.createPayrollForStaff = createPayrollForStaff;
