import { Request, Response } from "express";
import { z } from "zod";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { ErrorCode } from "../../../exceptions/root";
import { getOutletById } from "../../../lib/outlet";
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
  amount: z.coerce
    .number()
    .min(1, { message: "Amount should be greater than 0" }),
  description: z.string().min(3, {
    message: "Description must be at least 3 characters.",
  }),
});

export const createExpenses = async (req: Request, res: Response) => {
  const { outletId } = req.params;

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

  const createExpense = await prismaDB.expenses.create({
    data: {
      restaurantId: outlet.id,
      date: new Date(validateFields?.date),
      category: validateFields?.category,
      amount: validateFields?.amount,
      description: validateFields?.description,
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
      description: true,
      amount: true,
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
