import { Request, Response } from "express";
import { prismaDB } from "../../..";
import { getOutletById } from "../../../lib/outlet";
import {
  endOfToday,
  startOfMonth,
  startOfToday,
  startOfWeek,
  startOfYesterday,
} from "date-fns";
import {
  CashTransactionType,
  PaymentMethod,
  TransactionSource,
} from "@prisma/client";
import { redis } from "../../../services/redis";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { z } from "zod";
import { BadRequestsException } from "../../../exceptions/bad-request";

export const getAllCashRegisters = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet) {
    return res.status(404).json({ message: "Outlet not found" });
  }

  const cashRegisters = await prismaDB.cashRegister.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      staff: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      transactions: {
        select: {
          type: true,
          amount: true,
          paymentMethod: true,
          source: true,
          createdAt: true,
        },
      },
      denominations: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Calculate balances and format response
  const formattedRegisters = cashRegisters.map((register) => {
    // Calculate current balance and payment method totals
    const paymentTotals = register.transactions.reduce((acc, t) => {
      if (!acc[t.paymentMethod]) {
        acc[t.paymentMethod] = { in: 0, out: 0 };
      }

      if (t.type === "CASH_IN") {
        acc[t.paymentMethod].in += t.amount;
      } else {
        acc[t.paymentMethod].out += t.amount;
      }

      return acc;
    }, {} as Record<string, { in: number; out: number }>);

    const currentBalance = register.transactions.reduce((sum, t) => {
      return t.type === "CASH_IN" ? sum + t.amount : sum - t.amount;
    }, 0);

    // Get today's transactions
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTransactions = register.transactions.filter(
      (t) => new Date(t.createdAt) >= today
    );

    return {
      id: register.id,
      openedBy: register.staff || register.user,
      openingBalance: register.openingBalance,
      openingCashBalance: register.openingCashBalance,
      openingUPIBalance: register.openingUPIBalance,
      openingCardBalance: register.openingCardBalance,
      currentBalance,
      closingBalance: register.closingBalance,
      actualBalance: register.actualBalance,
      expectedBalance: currentBalance,
      status: register.status,
      openedAt: register.openedAt,
      closedAt: register.closedAt,
      transactions: register.transactions.length,
      todayTransactions: todayTransactions.length,
      paymentTotals,
      denominations: register.denominations,
      discrepancy:
        register.status === "CLOSED"
          ? register.actualBalance! - currentBalance
          : null,
    };
  });

  return res.json({
    success: true,
    data: formattedRegisters,
  });
};

export const getCashRegisterById = async (req: Request, res: Response) => {
  const { registerId } = req.params;

  const register = await prismaDB.cashRegister.findUnique({
    where: { id: registerId },
  });
};

export const getTransactionHistory = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet) {
    return res.status(404).json({ message: "Outlet not found" });
  }

  const {
    page = 1,
    limit = 10,
    period,
    paymentMethod,
    type,
    source,
    search,
  } = req.query;

  const pageNumber = parseInt(page as string);
  const pageSize = parseInt(limit as string);
  const skip = (pageNumber - 1) * pageSize;
  const outletStartDateTime = new Date(getOutlet?.createdAt);

  // Calculate date range based on period
  let startDate = new Date();
  let endDate = endOfToday();

  switch (period) {
    case "today":
      startDate = startOfToday();
      break;
    case "yesterday":
      startDate = startOfYesterday();
      endDate = startOfToday();
      break;
    case "week":
      startDate = startOfWeek(new Date());
      break;
    case "month":
      startDate = startOfMonth(new Date());
      break;
    default:
      startDate = outletStartDateTime;
  }

  // Build filter conditions
  const where = {
    register: {
      restaurantId: outletId,
    },

    createdAt: {
      gte: startDate,
      lte: endDate,
    },

    ...(type ? { type: type as CashTransactionType } : {}),
    ...(paymentMethod ? { paymentMethod: paymentMethod as PaymentMethod } : {}),
    ...(source ? { source: source as TransactionSource } : {}),
    ...(search
      ? {
          OR: [
            {
              description: { contains: search as string },
            },
            {
              referenceId: { contains: search as string },
            },
          ],
        }
      : {}),
  };

  // Get total count for pagination
  const total = await prismaDB.cashTransaction.count({ where });

  // Fetch transactions with pagination
  const transactions = await prismaDB.cashTransaction.findMany({
    where,
    include: {
      register: {
        select: {
          openingBalance: true,
          closingBalance: true,
          status: true,
        },
      },
      order: {
        select: {
          billId: true,
          subTotal: true,
        },
      },
      expense: {
        select: {
          category: true,
          description: true,
        },
      },
      staff: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: pageSize,
  });

  // Calculate summary statistics
  const summary = await prismaDB.cashTransaction.groupBy({
    by: ["type", "paymentMethod"],
    where: {
      register: { restaurantId: outletId },
      ...(startDate && endDate
        ? {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }
        : {}),
    },
    _sum: {
      amount: true,
    },
  });

  // Process summary data
  const summaryData = summary.reduce(
    (acc, curr) => {
      if (curr.type === "CASH_IN") {
        acc.totalIncome += curr._sum.amount || 0;
        acc.paymentMethodIncome[curr.paymentMethod] =
          (acc.paymentMethodIncome[curr.paymentMethod] || 0) +
          (curr._sum.amount || 0);
      } else {
        acc.totalExpense += curr._sum.amount || 0;
        acc.paymentMethodExpense[curr.paymentMethod] =
          (acc.paymentMethodExpense[curr.paymentMethod] || 0) +
          (curr._sum.amount || 0);
      }
      return acc;
    },
    {
      totalIncome: 0,
      totalExpense: 0,
      paymentMethodIncome: {} as Record<PaymentMethod, number>,
      paymentMethodExpense: {} as Record<PaymentMethod, number>,
    }
  );

  // Format transactions for response
  const formattedTransactions = transactions.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    source: transaction.source,
    amount: transaction.amount,
    description: transaction.description,
    paymentMethod: transaction.paymentMethod,
    referenceId: transaction.referenceId,
    performedBy: transaction.staff || transaction.user,
    orderDetails: transaction.orderId,
    expenseDetails: transaction.expenseId,
    registerDetails: transaction.registerId,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  }));

  // Return paginated response
  res.json({
    data: formattedTransactions,
    pagination: {
      total,
      page: pageNumber,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: pageNumber * pageSize < total,
    },
    summary: {
      ...summaryData,
      netAmount: summaryData.totalIncome - summaryData.totalExpense,
    },
  });
};

export const getAdminRegisterStatus = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  // @ts-ignore
  const { id: userId } = req.user;

  const register = await prismaDB.cashRegister.findFirst({
    where: {
      restaurantId: outletId,
      openedBy: userId,
      status: "OPEN",
    },
    include: {
      transactions: {
        orderBy: {
          createdAt: "desc",
        },
      },
      denominations: true,
    },
  });

  // Get restaurant details
  const restaurant = await prismaDB.restaurant.findFirst({
    where: {
      id: outletId,
    },
  });

  if (!restaurant) {
    throw new NotFoundException(
      "Restaurant not found",
      ErrorCode.OUTLET_NOT_FOUND
    );
  }

  // Calculate current balance for each payment method
  const calculateBalanceByMethod = (transactions: any[], method: string) => {
    return transactions
      .filter((t) => t.paymentMethod === method)
      .reduce((balance, tx) => {
        return tx.type === "CASH_IN"
          ? balance + tx.amount
          : balance - tx.amount;
      }, 0);
  };

  // Calculate total balance
  const calculateTotalBalance = (transactions: any[]) => {
    return transactions.reduce((balance, tx) => {
      return tx.type === "CASH_IN" ? balance + tx.amount : balance - tx.amount;
    }, 0);
  };

  // Get all active registers for this restaurant
  const activeRegisters = await prismaDB.cashRegister.findMany({
    where: {
      restaurantId: outletId,
      status: "OPEN",
    },
    include: {
      staff: true,
      user: true,
    },
  });

  const registerStatus = {
    registerId: register?.id || null,
    hasActiveRegister: !!register,
    isRestaurantRegisterOpen: activeRegisters.length > 0,
    activeOperators: activeRegisters.map((reg) => ({
      name: reg.staff?.name || reg.user?.name || "Unknown",
      type: reg.staff ? "Staff" : "Admin",
      registerId: reg.id,
      openedAt: reg.openedAt,
    })),
    lastTransactions: register?.transactions || [],
    sessionStarted: register?.openedAt || null,
    balances: {
      opening: {
        total: register?.openingBalance || 0,
        cash: register?.openingCashBalance || 0,
        upi: register?.openingUPIBalance || 0,
        card: register?.openingCardBalance || 0,
      },
      current: {
        total: register ? calculateTotalBalance(register.transactions) : 0,
        cash: register
          ? calculateBalanceByMethod(register.transactions, "CASH")
          : 0,
        upi: register
          ? calculateBalanceByMethod(register.transactions, "UPI")
          : 0,
        card: register
          ? calculateBalanceByMethod(register.transactions, "DEBIT") +
            calculateBalanceByMethod(register.transactions, "CREDIT")
          : 0,
      },
    },
    denominations: register?.denominations || null,
  };

  const formatToSend = {
    registerId: register?.id,
    registerStatus,
  };

  // Cache the register status
  await redis.set(
    `admin-register-${userId}-${outletId}`,
    JSON.stringify(formatToSend),
    "EX",
    300 // Cache for 5 minutes
  );

  return res.json({
    success: true,
    data: formatToSend,
  });
};

const incomeSchema = z.object({
  registerId: z
    .string({
      required_error: "Register ID is required",
    })
    .min(1),
  amount: z.coerce
    .number({
      required_error: "Amount is required",
    })
    .min(1),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"], {
    required_error: "Payment method is required",
  }),
  source: z.enum(["ORDER", "MANUAL", "SETTLEMENT"], {
    required_error: "Source is required",
  }),
  description: z.string().min(1),
});

export const recordIncome = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  // @ts-ignore
  const { id: userId } = req.user;

  const { data: validateFields, error } = incomeSchema.safeParse(req.body);

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.NOT_FOUND);
  }

  const register = await prismaDB.cashRegister.findFirst({
    where: {
      id: validateFields.registerId,
      restaurantId: outletId,
      status: "OPEN",
    },
  });

  if (!register) {
    throw new NotFoundException("Register not found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.cashTransaction.create({
    data: {
      registerId: register.id,
      amount: validateFields.amount,
      type: "CASH_IN",
      paymentMethod:
        validateFields.paymentMethod as PaymentMethod as PaymentMethod,
      source: validateFields.source,
      description: validateFields.description,
      performedBy: userId,
    },
  });

  return res.json({
    success: true,
    message: "Income recorded successfully",
  });
};

export const getTransactionHistoryForRegister = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet) {
    return res.status(404).json({ message: "Outlet not found" });
  }

  const {
    page = 1,
    limit = 10,
    paymentMethod,
    type,
    source,
    search,
    registerId,
  } = req.query;

  const pageNumber = parseInt(page as string);
  const pageSize = parseInt(limit as string);
  const skip = (pageNumber - 1) * pageSize;

  // Build filter conditions
  const where = {
    register: {
      id: registerId as string,
      restaurantId: outletId,
    },

    ...(type ? { type: type as CashTransactionType } : {}),
    ...(paymentMethod ? { paymentMethod: paymentMethod as PaymentMethod } : {}),
    ...(source ? { source: source as TransactionSource } : {}),
    ...(search
      ? {
          OR: [
            {
              description: { contains: search as string },
            },
            {
              referenceId: { contains: search as string },
            },
          ],
        }
      : {}),
  };

  // Get total count for pagination
  const total = await prismaDB.cashTransaction.count({ where });

  // Fetch transactions with pagination
  const transactions = await prismaDB.cashTransaction.findMany({
    where,
    include: {
      register: {
        select: {
          openingBalance: true,
          closingBalance: true,
          status: true,
        },
      },
      order: {
        select: {
          billId: true,
          subTotal: true,
        },
      },
      expense: {
        select: {
          category: true,
          description: true,
        },
      },
      staff: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: pageSize,
  });

  // Calculate summary statistics
  const summary = await prismaDB.cashTransaction.groupBy({
    by: ["type", "paymentMethod"],
    where: {
      register: { id: registerId as string, restaurantId: outletId },
    },
    _sum: {
      amount: true,
    },
  });

  // Process summary data
  const summaryData = summary.reduce(
    (acc, curr) => {
      if (curr.type === "CASH_IN") {
        acc.totalIncome += curr._sum.amount || 0;
        acc.paymentMethodIncome[curr.paymentMethod] =
          (acc.paymentMethodIncome[curr.paymentMethod] || 0) +
          (curr._sum.amount || 0);
      } else {
        acc.totalExpense += curr._sum.amount || 0;
        acc.paymentMethodExpense[curr.paymentMethod] =
          (acc.paymentMethodExpense[curr.paymentMethod] || 0) +
          (curr._sum.amount || 0);
      }
      return acc;
    },
    {
      totalIncome: 0,
      totalExpense: 0,
      paymentMethodIncome: {} as Record<PaymentMethod, number>,
      paymentMethodExpense: {} as Record<PaymentMethod, number>,
    }
  );

  // Format transactions for response
  const formattedTransactions = transactions.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    source: transaction.source,
    amount: transaction.amount,
    description: transaction.description,
    paymentMethod: transaction.paymentMethod,
    referenceId: transaction.referenceId,
    performedBy: transaction.staff || transaction.user,
    orderDetails: transaction.orderId,
    expenseDetails: transaction.expenseId,
    registerDetails: transaction.registerId,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  }));

  // Return paginated response
  res.json({
    data: formattedTransactions,
    pagination: {
      total,
      page: pageNumber,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: pageNumber * pageSize < total,
    },
    summary: {
      ...summaryData,
      netAmount: summaryData.totalIncome - summaryData.totalExpense,
    },
  });
};
