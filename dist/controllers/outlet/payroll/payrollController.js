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
const ws_1 = require("../../../services/ws");
const redis_1 = require("../../../services/redis");
const getThisMonthPayroll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { month } = req.query;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ date: "desc" }];
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
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
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.payroll.count({
        where: {
            staff: {
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
            payDate: {
                gte: startDate,
                lte: endDate,
            },
            OR: [{ staff: { name: { contains: search, mode: "insensitive" } } }],
            AND: filterConditions,
        },
    });
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
    // Fetch all payrolls for the specified restaurant within the current month
    const tablepayrolls = yield __1.prismaDB.payroll.findMany({
        skip,
        take,
        where: {
            staff: {
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
            payDate: {
                gte: startDate,
                lte: endDate,
            },
            OR: [{ staff: { name: { contains: search, mode: "insensitive" } } }],
            AND: filterConditions,
        },
        include: {
            staff: true, // Include staff information for display
        },
    });
    const formattedPayRoll = tablepayrolls === null || tablepayrolls === void 0 ? void 0 : tablepayrolls.map((table, i) => {
        var _a, _b, _c, _d;
        return ({
            id: table === null || table === void 0 ? void 0 : table.id,
            slNo: i + 1,
            name: (_a = table === null || table === void 0 ? void 0 : table.staff) === null || _a === void 0 ? void 0 : _a.name,
            email: (_b = table === null || table === void 0 ? void 0 : table.staff) === null || _b === void 0 ? void 0 : _b.email,
            role: (_c = table === null || table === void 0 ? void 0 : table.staff) === null || _c === void 0 ? void 0 : _c.role,
            salary: (_d = table === null || table === void 0 ? void 0 : table.staff) === null || _d === void 0 ? void 0 : _d.salary,
            status: table === null || table === void 0 ? void 0 : table.status,
            date: (0, date_fns_1.format)(table === null || table === void 0 ? void 0 : table.payDate, "PP"),
        });
    });
    if (payrolls.length > 0) {
        const totalPayout = payrolls.reduce((total, payroll) => total + parseFloat(payroll.staff.salary), 0);
        const totalSuccessPayouts = payrolls.filter((payroll) => payroll.status === "COMPLETED").length;
        const totalPendingPayouts = payrolls.filter((payroll) => payroll.status === "PENDING").length;
        return res.json({
            success: true,
            totalCount,
            payrolls: formattedPayRoll,
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
        const allowances = staff.allowances ? Number(staff.allowances) : 0;
        const deductions = staff.deductions ? Number(staff.deductions) : 0;
        const netPay = baseSalary + allowances - deductions;
        const newPayroll = yield __1.prismaDB.payroll.create({
            data: {
                staffId: staff.id,
                amountPaid: netPay,
                payDate: new Date(startDate.getFullYear(), startDate.getMonth(), 27),
                payFrequency: staff.payFrequency,
            },
            include: {
                staff: true,
            },
        });
        newPayrolls.push(newPayroll);
    }
    const formattedNewPayRoll = newPayrolls === null || newPayrolls === void 0 ? void 0 : newPayrolls.map((table, i) => {
        var _a, _b, _c, _d;
        return ({
            id: table === null || table === void 0 ? void 0 : table.id,
            slNo: i + 1,
            name: (_a = table === null || table === void 0 ? void 0 : table.staff) === null || _a === void 0 ? void 0 : _a.name,
            email: (_b = table === null || table === void 0 ? void 0 : table.staff) === null || _b === void 0 ? void 0 : _b.email,
            role: (_c = table === null || table === void 0 ? void 0 : table.staff) === null || _c === void 0 ? void 0 : _c.role,
            salary: (_d = table === null || table === void 0 ? void 0 : table.staff) === null || _d === void 0 ? void 0 : _d.salary,
            status: table === null || table === void 0 ? void 0 : table.status,
            date: (0, date_fns_1.format)(table === null || table === void 0 ? void 0 : table.payDate, "PP"),
        });
    });
    // Return the newly created payrolls
    return res.json({
        success: true,
        payrolls: formattedNewPayRoll,
        totalPayout: newPayrolls.reduce((total, payroll) => total + parseFloat(payroll.staff.salary), 0),
        totalPayouts: newPayrolls.length,
        totalSuccessPayouts: 0, // No successful payouts initially
        totalPendingPayouts: newPayrolls.length,
    });
});
exports.getThisMonthPayroll = getThisMonthPayroll;
const updatePayrollStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
        include: {
            staff: true,
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
            amountPaid: parseFloat((_a = findPayroll === null || findPayroll === void 0 ? void 0 : findPayroll.staff) === null || _a === void 0 ? void 0 : _a.salary),
            status: status,
        },
    });
    // Update related alerts to resolved
    yield __1.prismaDB.alert.deleteMany({
        where: {
            restaurantId: outlet.id,
            payrollId: id,
            status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
        },
    });
    const alerts = yield __1.prismaDB.alert.findMany({
        where: {
            restaurantId: outletId,
            status: {
                in: ["PENDING"],
            },
        },
        select: {
            id: true,
            type: true,
            status: true,
            priority: true,
            href: true,
            message: true,
            createdAt: true,
        },
    });
    ws_1.websocketManager.notifyClients(outletId, "NEW_ALERT");
    yield redis_1.redis.set(`alerts-${outletId}`, JSON.stringify(alerts));
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
    // Update related alerts to resolved
    yield __1.prismaDB.alert.deleteMany({
        where: {
            restaurantId: outlet.id,
            payrollId: {
                in: selectedId,
            },
            status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
        },
    });
    const alerts = yield __1.prismaDB.alert.findMany({
        where: {
            restaurantId: outletId,
            status: {
                in: ["PENDING"],
            },
        },
        select: {
            id: true,
            type: true,
            status: true,
            priority: true,
            href: true,
            message: true,
            createdAt: true,
        },
    });
    ws_1.websocketManager.notifyClients(outletId, "NEW_ALERT");
    yield redis_1.redis.set(`alerts-${outletId}`, JSON.stringify(alerts));
    return res.json({
        success: true,
        message: "Updated Payroll Status",
    });
});
exports.bulkUpdatePayrollStatus = bulkUpdatePayrollStatus;
