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
exports.bulkUpdatePayrollStatus = exports.updatePayrollStatus = exports.getThisMonthPayroll = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const date_fns_1 = require("date-fns");
const __1 = require("../../..");
const getThisMonthPayroll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { month } = req.query;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const currentDate = new Date();
    let startDate;
    let endDate;
    if (month === "last") {
        startDate = (0, date_fns_1.startOfMonth)((0, date_fns_1.subMonths)(new Date(), 1));
        endDate = (0, date_fns_1.endOfMonth)((0, date_fns_1.subMonths)(new Date(), 1));
    }
    else if (month === "previous") {
        startDate = (0, date_fns_1.startOfMonth)((0, date_fns_1.subMonths)(new Date(), 2));
        endDate = (0, date_fns_1.endOfMonth)((0, date_fns_1.subMonths)(new Date(), 2));
    }
    else {
        startDate = (0, date_fns_1.startOfMonth)(new Date());
        endDate = (0, date_fns_1.endOfMonth)(new Date());
    }
    // Fetch all payrolls for the specified restaurant within the current month
    const payrolls = yield __1.prismaDB.payroll.findMany({
        where: {
            staff: {
                restaurantId: outlet.id,
            },
            payDate: {
                gte: startDate,
                lte: endDate,
            },
        },
        include: {
            staff: true, // Include staff information for display
        },
    });
    if (payrolls.length > 0) {
        const totalPayout = payrolls.reduce((total, payroll) => total + parseFloat(payroll.staff.salary), 0);
        const totalSuccessPayouts = payrolls.filter((payroll) => payroll.status === "COMPLETED").length;
        const totalPendingPayouts = payrolls.filter((payroll) => payroll.status === "PENDING").length;
        return res.json({
            success: true,
            payrolls,
            totalPayout,
            totalPayouts: payrolls.length,
            totalSuccessPayouts,
            totalPendingPayouts,
        });
    }
    // Fetch all staff for the outlet
    const staffList = yield __1.prismaDB.staff.findMany({
        where: {
            restaurantId: outlet.id,
        },
    });
    if (staffList.length === 0) {
        return res.json({
            success: true,
            payrolls: [],
            totalPayout: 0,
            totalPayouts: 0,
            totalSuccessPayouts: 0,
            totalPendingPayouts: 0,
        });
    }
    // Create payroll for each staff member for the selected month
    const newPayrolls = [];
    for (const staff of staffList) {
        const baseSalary = parseFloat(staff.salary);
        const allowances = staff.allowances ? parseFloat(staff.allowances) : 0;
        const deductions = staff.deductions ? parseFloat(staff.deductions) : 0;
        const netPay = baseSalary + allowances - deductions;
        const newPayroll = yield __1.prismaDB.payroll.create({
            data: {
                staffId: staff.id,
                amountPaid: "0",
                payDate: new Date(startDate.getFullYear(), startDate.getMonth(), 27),
                payFrequency: staff.payFrequency,
            },
            include: {
                staff: true,
            },
        });
        newPayrolls.push(newPayroll);
    }
    // Return the newly created payrolls
    return res.json({
        success: true,
        payrolls: newPayrolls,
        totalPayout: newPayrolls.reduce((total, payroll) => total + parseFloat(payroll.staff.salary), 0),
        totalPayouts: newPayrolls.length,
        totalSuccessPayouts: 0, // No successful payouts initially
        totalPendingPayouts: newPayrolls.length,
    });
});
exports.getThisMonthPayroll = getThisMonthPayroll;
const updatePayrollStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, id } = req.params;
    const { status } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (outlet === undefined || !outlet.id) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const findPayroll = yield __1.prismaDB.payroll.findFirst({
        where: {
            id: id,
        },
    });
    if (findPayroll == null || !findPayroll.id) {
        throw new not_found_1.NotFoundException("Payroll Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    yield __1.prismaDB.payroll.update({
        where: {
            id: findPayroll.id,
        },
        data: {
            status: status,
        },
    });
    return res.json({
        success: true,
        message: "Updated Payroll Status",
    });
});
exports.updatePayrollStatus = updatePayrollStatus;
const bulkUpdatePayrollStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { selectedId } = req.body;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (outlet === undefined || !outlet.id) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Validate input
    if (!Array.isArray(selectedId) || (selectedId === null || selectedId === void 0 ? void 0 : selectedId.length) === 0) {
        return res.status(400).json({
            success: false,
            message: "No payroll IDs provided for update.",
        });
    }
    yield __1.prismaDB.payroll.updateMany({
        where: {
            id: {
                in: selectedId,
            },
        },
        data: {
            status: "COMPLETED",
        },
    });
    return res.json({
        success: true,
        message: "Updated Payroll Status",
    });
});
exports.bulkUpdatePayrollStatus = bulkUpdatePayrollStatus;
