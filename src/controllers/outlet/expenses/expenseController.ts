import { Request, Response } from "express";
import { z } from "zod";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { ErrorCode } from "../../../exceptions/root";
import { generatePurchaseNo, getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { UnauthorizedException } from "../../../exceptions/unauthorized";
import { prismaDB } from "../../..";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
} from "../../../schema/staff";

const expenseSchema = z.object({
  date: z.string({
    required_error: "A date is required.",
  }),
  category: z.enum(
    [
      "Ingredients",
      "Utilities",
      "Salaries",
      "Equipment",
      "Marketing",
      "Rent",
      "Miscellaneous",
    ],
    { required_error: "Please select a category." }
  ),
  vendorId: z.string().min(1, { message: "Vendor Is Required" }).optional(),
  rawMaterials: z.array(
    z.object({
      id: z.string().optional(),
      rawMaterialId: z.string().min(1, { message: "Raw Material Is Required" }),
      rawMaterialName: z.string().min(1, { message: "Raw Material Name" }),
      unitName: z.string().min(1, { message: "Unit Name is required" }),
      requestUnitId: z.string().min(1, { message: "Request Unit is Required" }),
      requestQuantity: z.coerce
        .number()
        .min(1, { message: "Request Quantity is Required" }),
      gst: z.coerce.number(),
      total: z.coerce
        .number()
        .min(0, { message: "Purchase price is required" }),
    })
  ),
  amount: z.coerce
    .number()
    .min(1, { message: "Amount should be greater than 0" }),
  description: z.string().min(3, {
    message: "Description must be at least 3 characters.",
  }),
  attachments: z.string().optional(),
  paymentMethod: z.enum(["CASH", "UPI", "DEBIT", "CREDIT"], {
    required_error: " Payment Method Required.",
  }),
});

export const createExpenses = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const { data: validateFields, error } = expenseSchema.safeParse(req.body);

  console.log("ValidateFields", validateFields);

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (
    validateFields?.category === "Ingredients" &&
    (!validateFields?.vendorId ||
      !validateFields?.rawMaterials ||
      validateFields?.rawMaterials.length === 0 ||
      validateFields?.rawMaterials?.some((r) => !r.rawMaterialId))
  ) {
    throw new BadRequestsException(
      "Vendor & Raw Materials Required for Expenses",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user?.id;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  let purchaseId;

  if (validateFields.category === "Ingredients" && validateFields?.vendorId) {
    const invoiceNo = await generatePurchaseNo(outlet.id);
    const create = await prismaDB.purchase.create({
      data: {
        restaurantId: outletId,
        // @ts-ignore
        createdBy: `${req?.user?.name}-${req?.user?.role}`,
        vendorId: validateFields?.vendorId,
        invoiceNo: invoiceNo,
        purchaseStatus: "COMPLETED",
        purchaseItems: {
          create: validateFields?.rawMaterials.map((item) => ({
            rawMaterialId: item?.rawMaterialId,
            rawMaterialName: item?.rawMaterialName,
            purchaseUnitId: item?.requestUnitId,
            purchaseUnitName: item?.unitName,
            purchaseQuantity: item?.requestQuantity,
            cgst: item?.gst / 2,
            sgst: item?.gst / 2,
            purchasePrice: item?.total,
          })),
        },
        generatedAmount: validateFields?.amount,
        isPaid: true,
        paymentMethod: validateFields?.paymentMethod,
        totalAmount: validateFields?.amount,
      },
    });
    purchaseId = create?.id;
  }

  const createExpense = await prismaDB.expenses.create({
    data: {
      restaurantId: outlet.id,
      date: new Date(validateFields?.date),
      // @ts-ignore
      createdBy: `${req?.user?.name} (${req?.user?.role})`,
      attachments: validateFields?.attachments,
      category: validateFields?.category,
      amount: validateFields?.amount,
      description: validateFields?.description,
      purchaseId: purchaseId,
      paymentMethod: validateFields?.paymentMethod,
    },
  });

  if (createExpense?.id) {
    return res.json({
      success: true,
      message: "Expense Created ✅",
    });
  }
};

export const updateExpenses = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;

  const { data: validateFields, error } = expenseSchema.safeParse(req.body);

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user?.id;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findExpenses = await prismaDB?.expenses.findFirst({
    where: {
      id: id,
      restaurantId: outlet?.id,
    },
  });
  if (!findExpenses?.id) {
    throw new NotFoundException("Expense Not Found", ErrorCode.NOT_FOUND);
  }

  const updateExpense = await prismaDB.expenses.update({
    where: {
      id: findExpenses.id,
      restaurantId: outlet.id,
    },
    data: {
      date: new Date(validateFields?.date),
      category: validateFields?.category,
      amount: validateFields?.amount,
      description: validateFields?.description,
    },
  });

  if (updateExpense?.id) {
    return res.json({
      success: true,
      message: "Expense Updated ✅",
    });
  }
};

export const deleteExpenses = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user?.id;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findExpenses = await prismaDB?.expenses.findFirst({
    where: {
      id: id,
      restaurantId: outlet?.id,
    },
  });

  if (!findExpenses?.id) {
    throw new NotFoundException("Expense Not Found", ErrorCode.NOT_FOUND);
  }

  const deleteExpense = await prismaDB.expenses.delete({
    where: {
      id: findExpenses.id,
      restaurantId: outlet.id,
    },
  });

  if (deleteExpense?.id) {
    return res.json({
      success: true,
      message: "Expense Deleted ✅",
    });
  }
};

export const getAllExpensesForTable = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);
  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];
  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
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
  const totalCount = await prismaDB.expenses.count({
    where: {
      restaurantId: outletId,
      OR: [{ description: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const getExpenses = await prismaDB?.expenses.findMany({
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
      createdAt: true,
      updatedAt: true,
    },
    orderBy,
  });

  return res.json({
    success: true,
    data: {
      totalCount,
      expenses: getExpenses,
    },
  });
};

const expenseCategoryColors: Record<string, string> = {
  Ingredients: "#3b82f6", // Blue
  Utilities: "#eab308", // Yellow
  Salaries: "#22c55e", // Green
  Equipment: "#ef4444", // Red
  Marketing: "#8b5cf6", // Purple
  Rent: "#f97316", // Orange
  Miscellaneous: "#64748b", // Gray
};

export const getCategoryExpensesStats = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user?.id;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  // Fetch all expenses for the given outlet
  const expenses = await prismaDB.expenses.findMany({
    where: { restaurantId: outletId },
    select: {
      category: true,
      amount: true,
    },
  });

  // Aggregate amounts by category
  const categoryTotals: Record<string, number> = expenses.reduce(
    (acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    },
    {} as Record<string, number>
  );

  // Calculate total expenses
  const totalExpenses = Object.values(categoryTotals).reduce(
    (sum, amount) => sum + amount,
    0
  );

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
};
