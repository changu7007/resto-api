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
exports.getCategoryExpensesStats = exports.getAllExpensesForTable = exports.deleteExpenses = exports.updateExpenses = exports.createExpenses = void 0;
const zod_1 = require("zod");
const bad_request_1 = require("../../../exceptions/bad-request");
const root_1 = require("../../../exceptions/root");
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const unauthorized_1 = require("../../../exceptions/unauthorized");
const __1 = require("../../..");
const redis_1 = require("../../../services/redis");
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
    purchaseId: zod_1.z.string().optional(),
    vendorId: zod_1.z.string().min(1, { message: "Vendor Is Required" }).optional(),
    rawMaterials: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().optional(),
        rawMaterialId: zod_1.z.string().min(1, { message: "Raw Material Is Required" }),
        rawMaterialName: zod_1.z.string().min(1, { message: "Raw Material Name" }),
        unitName: zod_1.z.string().min(1, { message: "Unit Name is required" }),
        requestUnitId: zod_1.z.string().min(1, { message: "Request Unit is Required" }),
        requestQuantity: zod_1.z.coerce
            .number()
            .min(1, { message: "Request Quantity is Required" }),
        gst: zod_1.z.coerce.number(),
        total: zod_1.z.coerce
            .number()
            .min(0, { message: "Purchase price is required" }),
    })),
    amount: zod_1.z.coerce
        .number()
        .min(1, { message: "Amount should be greater than 0" }),
    description: zod_1.z.string().min(3, {
        message: "Description must be at least 3 characters.",
    }),
    attachments: zod_1.z.string().optional(),
    paymentMethod: zod_1.z.enum(["CASH", "UPI", "DEBIT", "CREDIT"], {
        required_error: " Payment Method Required.",
    }),
});
const createExpenses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { outletId } = req.params;
    const { data: validateFields, error } = expenseSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.category) === "Ingredients" &&
        (!(validateFields === null || validateFields === void 0 ? void 0 : validateFields.vendorId) ||
            !(validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) ||
            (validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials.length) === 0 ||
            ((_a = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _a === void 0 ? void 0 : _a.some((r) => !r.rawMaterialId)))) {
        throw new bad_request_1.BadRequestsException("Vendor & Raw Materials Required for Expenses", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
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
    const result = yield __1.prismaDB.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _c, _d, _e, _f;
        let purchaseId;
        if (validateFields.category === "Ingredients" &&
            (validateFields === null || validateFields === void 0 ? void 0 : validateFields.vendorId)) {
            const invoiceNo = yield (0, outlet_1.generatePurchaseNo)(outlet.id);
            const create = yield tx.purchase.create({
                data: {
                    restaurantId: outletId,
                    // @ts-ignore
                    createdBy: `${(_c = req === null || req === void 0 ? void 0 : req.user) === null || _c === void 0 ? void 0 : _c.name}-${(_d = req === null || req === void 0 ? void 0 : req.user) === null || _d === void 0 ? void 0 : _d.role}`,
                    vendorId: validateFields === null || validateFields === void 0 ? void 0 : validateFields.vendorId,
                    invoiceNo: invoiceNo,
                    purchaseStatus: "COMPLETED",
                    purchaseItems: {
                        create: validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials.map((item) => ({
                            rawMaterialId: item === null || item === void 0 ? void 0 : item.rawMaterialId,
                            rawMaterialName: item === null || item === void 0 ? void 0 : item.rawMaterialName,
                            purchaseUnitId: item === null || item === void 0 ? void 0 : item.requestUnitId,
                            purchaseUnitName: item === null || item === void 0 ? void 0 : item.unitName,
                            purchaseQuantity: item === null || item === void 0 ? void 0 : item.requestQuantity,
                            cgst: (item === null || item === void 0 ? void 0 : item.gst) / 2,
                            sgst: (item === null || item === void 0 ? void 0 : item.gst) / 2,
                            purchasePrice: item === null || item === void 0 ? void 0 : item.total,
                        })),
                    },
                    generatedAmount: validateFields === null || validateFields === void 0 ? void 0 : validateFields.amount,
                    isPaid: true,
                    paymentMethod: validateFields === null || validateFields === void 0 ? void 0 : validateFields.paymentMethod,
                    totalAmount: validateFields === null || validateFields === void 0 ? void 0 : validateFields.amount,
                },
            });
            purchaseId = create === null || create === void 0 ? void 0 : create.id;
        }
        const createExpense = yield tx.expenses.create({
            data: {
                restaurantId: outlet.id,
                date: new Date(validateFields === null || validateFields === void 0 ? void 0 : validateFields.date),
                // @ts-ignore
                createdBy: `${(_e = req === null || req === void 0 ? void 0 : req.user) === null || _e === void 0 ? void 0 : _e.name} (${(_f = req === null || req === void 0 ? void 0 : req.user) === null || _f === void 0 ? void 0 : _f.role})`,
                attachments: validateFields === null || validateFields === void 0 ? void 0 : validateFields.attachments,
                category: validateFields === null || validateFields === void 0 ? void 0 : validateFields.category,
                amount: validateFields === null || validateFields === void 0 ? void 0 : validateFields.amount,
                description: validateFields === null || validateFields === void 0 ? void 0 : validateFields.description,
                purchaseId: purchaseId,
                paymentMethod: validateFields === null || validateFields === void 0 ? void 0 : validateFields.paymentMethod,
            },
        });
        return createExpense;
    }), {
        maxWait: 10000, // 10s maximum wait time
        timeout: 30000, // 30s timeout
    });
    if (result === null || result === void 0 ? void 0 : result.id) {
        yield redis_1.redis.publish("orderUpdated", JSON.stringify({ outletId }));
        return res.json({
            success: true,
            message: "Expense Created ✅",
        });
    }
});
exports.createExpenses = createExpenses;
const updateExpenses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _g, _h;
    const { outletId, id } = req.params;
    const { data: validateFields, error } = expenseSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.category) === "Ingredients" &&
        (!(validateFields === null || validateFields === void 0 ? void 0 : validateFields.vendorId) ||
            !(validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) ||
            (validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials.length) === 0 ||
            ((_g = validateFields === null || validateFields === void 0 ? void 0 : validateFields.rawMaterials) === null || _g === void 0 ? void 0 : _g.some((r) => !r.rawMaterialId)))) {
        throw new bad_request_1.BadRequestsException("Vendor & Raw Materials Required for Expenses", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = (_h = req.user) === null || _h === void 0 ? void 0 : _h.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    const result = yield __1.prismaDB.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.category) === "Ingredients") {
            const findPurchase = yield tx.purchase.findFirst({
                where: {
                    id: validateFields === null || validateFields === void 0 ? void 0 : validateFields.purchaseId,
                    restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                },
                include: {
                    purchaseItems: true,
                },
            });
            if (!(findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id)) {
                throw new not_found_1.NotFoundException("Purchase Expense Not Found for RawMaterials", root_1.ErrorCode.NOT_FOUND);
            }
            // Get existing and new raw material IDs
            const existingRawMaterialIds = findPurchase.purchaseItems.map((item) => item.rawMaterialId);
            const newRawMaterialIds = validateFields.rawMaterials.map((item) => item.rawMaterialId);
            // Find items to delete, update, and create
            const itemsToDelete = findPurchase.purchaseItems.filter((item) => !newRawMaterialIds.includes(item.rawMaterialId));
            const itemsToUpdate = validateFields.rawMaterials.filter((item) => existingRawMaterialIds.includes(item.rawMaterialId));
            const itemsToCreate = validateFields.rawMaterials.filter((item) => !existingRawMaterialIds.includes(item.rawMaterialId));
            // Update purchase with all changes
            yield tx.purchase.update({
                where: {
                    id: findPurchase === null || findPurchase === void 0 ? void 0 : findPurchase.id,
                    restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                },
                data: {
                    purchaseItems: {
                        // Delete removed items
                        deleteMany: itemsToDelete.map((item) => ({
                            id: item.id,
                        })),
                        // Update existing items
                        updateMany: itemsToUpdate.map((item) => ({
                            where: {
                                rawMaterialId: item.rawMaterialId,
                                purchaseId: findPurchase.id,
                            },
                            data: {
                                rawMaterialName: item.rawMaterialName,
                                purchaseUnitId: item.requestUnitId,
                                purchaseUnitName: item.unitName,
                                purchaseQuantity: item.requestQuantity,
                                cgst: item.gst / 2,
                                sgst: item.gst / 2,
                                purchasePrice: item.total,
                            },
                        })),
                        // Create new items
                        create: itemsToCreate.map((item) => ({
                            rawMaterialId: item.rawMaterialId,
                            rawMaterialName: item.rawMaterialName,
                            purchaseUnitId: item.requestUnitId,
                            purchaseUnitName: item.unitName,
                            purchaseQuantity: item.requestQuantity,
                            cgst: item.gst / 2,
                            sgst: item.gst / 2,
                            purchasePrice: item.total,
                        })),
                    },
                    generatedAmount: validateFields === null || validateFields === void 0 ? void 0 : validateFields.amount,
                    totalAmount: validateFields === null || validateFields === void 0 ? void 0 : validateFields.amount,
                    paymentMethod: validateFields === null || validateFields === void 0 ? void 0 : validateFields.paymentMethod,
                },
            });
        }
        const findExpenses = yield tx.expenses.findFirst({
            where: {
                id: id,
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
        });
        if (!(findExpenses === null || findExpenses === void 0 ? void 0 : findExpenses.id)) {
            throw new not_found_1.NotFoundException("Expense Not Found", root_1.ErrorCode.NOT_FOUND);
        }
        const updateExpense = yield tx.expenses.update({
            where: {
                id: findExpenses.id,
                restaurantId: outlet.id,
            },
            data: {
                date: new Date(validateFields === null || validateFields === void 0 ? void 0 : validateFields.date),
                category: validateFields === null || validateFields === void 0 ? void 0 : validateFields.category,
                amount: validateFields === null || validateFields === void 0 ? void 0 : validateFields.amount,
                description: validateFields === null || validateFields === void 0 ? void 0 : validateFields.description,
                attachments: validateFields === null || validateFields === void 0 ? void 0 : validateFields.attachments,
                paymentMethod: validateFields === null || validateFields === void 0 ? void 0 : validateFields.paymentMethod,
            },
        });
        return updateExpense;
    }), {
        maxWait: 10000, // 10s maximum wait time
        timeout: 30000, // 30s timeout
    });
    yield redis_1.redis.publish("orderUpdated", JSON.stringify({ outletId }));
    return res.json({
        success: true,
        message: "Expense Updated ✅",
        data: result,
    });
});
exports.updateExpenses = updateExpenses;
const deleteExpenses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _j;
    const { outletId, id } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = (_j = req.user) === null || _j === void 0 ? void 0 : _j.id;
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
        yield redis_1.redis.publish("orderUpdated", JSON.stringify({ outletId }));
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
            createdBy: true,
            attachments: true,
            description: true,
            amount: true,
            paymentMethod: true,
            purchase: {
                include: {
                    vendor: true,
                    purchaseItems: {
                        include: {
                            rawMaterial: true,
                            purchaseUnit: true,
                        },
                    },
                },
            },
            createdAt: true,
            updatedAt: true,
        },
        orderBy,
    }));
    const formattedExpenses = getExpenses === null || getExpenses === void 0 ? void 0 : getExpenses.map((expense) => {
        var _a, _b, _c, _d, _e;
        return ({
            id: expense === null || expense === void 0 ? void 0 : expense.id,
            date: expense === null || expense === void 0 ? void 0 : expense.date,
            category: expense === null || expense === void 0 ? void 0 : expense.category,
            createdBy: expense === null || expense === void 0 ? void 0 : expense.createdBy,
            attachments: expense === null || expense === void 0 ? void 0 : expense.attachments,
            description: expense === null || expense === void 0 ? void 0 : expense.description,
            amount: expense === null || expense === void 0 ? void 0 : expense.amount,
            vendorId: (_b = (_a = expense === null || expense === void 0 ? void 0 : expense.purchase) === null || _a === void 0 ? void 0 : _a.vendor) === null || _b === void 0 ? void 0 : _b.id,
            purchaseId: (_c = expense === null || expense === void 0 ? void 0 : expense.purchase) === null || _c === void 0 ? void 0 : _c.id,
            rawMaterials: (_e = (_d = expense === null || expense === void 0 ? void 0 : expense.purchase) === null || _d === void 0 ? void 0 : _d.purchaseItems) === null || _e === void 0 ? void 0 : _e.map((item) => {
                var _a, _b, _c, _d, _e;
                return ({
                    id: (_a = item === null || item === void 0 ? void 0 : item.rawMaterial) === null || _a === void 0 ? void 0 : _a.id,
                    rawMaterialId: (_b = item === null || item === void 0 ? void 0 : item.rawMaterial) === null || _b === void 0 ? void 0 : _b.id,
                    rawMaterialName: (_c = item === null || item === void 0 ? void 0 : item.rawMaterial) === null || _c === void 0 ? void 0 : _c.name,
                    unitName: (_d = item === null || item === void 0 ? void 0 : item.purchaseUnit) === null || _d === void 0 ? void 0 : _d.name,
                    requestUnitId: (_e = item === null || item === void 0 ? void 0 : item.purchaseUnit) === null || _e === void 0 ? void 0 : _e.id,
                    requestQuantity: item === null || item === void 0 ? void 0 : item.purchaseQuantity,
                    gst: Number((item === null || item === void 0 ? void 0 : item.cgst) || 0) + Number((item === null || item === void 0 ? void 0 : item.sgst) || 0),
                    total: item === null || item === void 0 ? void 0 : item.purchasePrice,
                });
            }),
            paymentMethod: expense === null || expense === void 0 ? void 0 : expense.paymentMethod,
            createdAt: expense === null || expense === void 0 ? void 0 : expense.createdAt,
            updatedAt: expense === null || expense === void 0 ? void 0 : expense.updatedAt,
        });
    });
    return res.json({
        success: true,
        data: {
            totalCount,
            expenses: formattedExpenses,
        },
    });
});
exports.getAllExpensesForTable = getAllExpensesForTable;
const expenseCategoryColors = {
    Ingredients: "#3b82f6", // Blue
    Utilities: "#eab308", // Yellow
    Salaries: "#22c55e", // Green
    Equipment: "#ef4444", // Red
    Marketing: "#8b5cf6", // Purple
    Rent: "#f97316", // Orange
    Miscellaneous: "#64748b", // Gray
};
const getCategoryExpensesStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _k;
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    let userId = (_k = req.user) === null || _k === void 0 ? void 0 : _k.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if (userId !== outlet.adminId) {
        throw new unauthorized_1.UnauthorizedException("Unauthorized Access", root_1.ErrorCode.UNAUTHORIZED);
    }
    // Fetch all expenses for the given outlet
    const expenses = yield __1.prismaDB.expenses.findMany({
        where: { restaurantId: outletId },
        select: {
            category: true,
            amount: true,
        },
    });
    // Aggregate amounts by category
    const categoryTotals = expenses.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
    }, {});
    // Calculate total expenses
    const totalExpenses = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
    // Map categories to stats
    const stats = Object.entries(categoryTotals).map(([category, amount]) => ({
        name: category,
        amount: parseFloat(amount.toFixed(2)),
        percentage: parseFloat(((amount / totalExpenses) * 100).toFixed(2)),
        color: expenseCategoryColors[category] || "#000000", // Default to black if no color assigned
    }));
    return res.json({
        success: true,
        expensesCategoryStats: stats,
    });
});
exports.getCategoryExpensesStats = getCategoryExpensesStats;
