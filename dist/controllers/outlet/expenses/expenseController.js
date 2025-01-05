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
exports.getAllExpensesForTable = exports.deleteExpenses = exports.updateExpenses = exports.createExpenses = void 0;
const zod_1 = require("zod");
const bad_request_1 = require("../../../exceptions/bad-request");
const root_1 = require("../../../exceptions/root");
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const unauthorized_1 = require("../../../exceptions/unauthorized");
const __1 = require("../../..");
const expenseSchema = zod_1.z.object({
    date: zod_1.z.string({
        required_error: "A date is required.",
    }),
    category: zod_1.z.enum([
        "Ingredients",
        "Utilities",
        "Salaries",
        "Equipment",
        "Marketing",
        "Rent",
        "Miscellaneous",
    ], { required_error: "Please select a category." }),
    amount: zod_1.z.coerce
        .number()
        .min(1, { message: "Amount should be greater than 0" }),
    description: zod_1.z.string().min(3, {
        message: "Description must be at least 3 characters.",
    }),
});
const createExpenses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { outletId } = req.params;
    const { data: validateFields, error } = expenseSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const createExpense = yield __1.prismaDB.expenses.create({
        data: {
            restaurantId: outlet.id,
            date: new Date(validateFields === null || validateFields === void 0 ? void 0 : validateFields.date),
            category: validateFields === null || validateFields === void 0 ? void 0 : validateFields.category,
            amount: validateFields === null || validateFields === void 0 ? void 0 : validateFields.amount,
            description: validateFields === null || validateFields === void 0 ? void 0 : validateFields.description,
        },
    });
    if (createExpense === null || createExpense === void 0 ? void 0 : createExpense.id) {
        return res.json({
            success: true,
            message: "Expense Created ✅",
        });
    }
});
exports.createExpenses = createExpenses;
const updateExpenses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { outletId, id } = req.params;
    const { data: validateFields, error } = expenseSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findExpenses = yield (__1.prismaDB === null || __1.prismaDB === void 0 ? void 0 : __1.prismaDB.expenses.findFirst({
        where: {
            id: id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    }));
    if (!(findExpenses === null || findExpenses === void 0 ? void 0 : findExpenses.id)) {
        throw new not_found_1.NotFoundException("Expense Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const updateExpense = yield __1.prismaDB.expenses.update({
        where: {
            id: findExpenses.id,
            restaurantId: outlet.id,
        },
        data: {
            date: new Date(validateFields === null || validateFields === void 0 ? void 0 : validateFields.date),
            category: validateFields === null || validateFields === void 0 ? void 0 : validateFields.category,
            amount: validateFields === null || validateFields === void 0 ? void 0 : validateFields.amount,
            description: validateFields === null || validateFields === void 0 ? void 0 : validateFields.description,
        },
    });
    if (updateExpense === null || updateExpense === void 0 ? void 0 : updateExpense.id) {
        return res.json({
            success: true,
            message: "Expense Updated ✅",
        });
    }
});
exports.updateExpenses = updateExpenses;
const deleteExpenses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = (_c = req.user) === null || _c === void 0 ? void 0 : _c.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const findExpenses = yield (__1.prismaDB === null || __1.prismaDB === void 0 ? void 0 : __1.prismaDB.expenses.findFirst({
        where: {
            id: id,
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    }));
    if (!(findExpenses === null || findExpenses === void 0 ? void 0 : findExpenses.id)) {
        throw new not_found_1.NotFoundException("Expense Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const deleteExpense = yield __1.prismaDB.expenses.delete({
        where: {
            id: findExpenses.id,
            restaurantId: outlet.id,
        },
    });
    if (deleteExpense === null || deleteExpense === void 0 ? void 0 : deleteExpense.id) {
        return res.json({
            success: true,
            message: "Expense Deleted ✅",
        });
    }
});
exports.deleteExpenses = deleteExpenses;
const getAllExpensesForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
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
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.expenses.count({
        where: {
            restaurantId: outletId,
            OR: [{ description: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
    });
    const getExpenses = yield (__1.prismaDB === null || __1.prismaDB === void 0 ? void 0 : __1.prismaDB.expenses.findMany({
        take,
        skip,
        where: {
            restaurantId: outletId,
            OR: [{ description: { contains: search, mode: "insensitive" } }],
            AND: filterConditions,
        },
        select: {
            id: true,
            date: true,
            category: true,
            description: true,
            amount: true,
        },
        orderBy,
    }));
    return res.json({
        success: true,
        data: {
            totalCount,
            expenses: getExpenses,
        },
    });
});
exports.getAllExpensesForTable = getAllExpensesForTable;
