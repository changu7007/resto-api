import {
  CashTransactionType,
  PaymentMethod,
  RegisterStatus,
} from "@prisma/client";
import { prismaDB } from "..";
import { NotFoundException } from "../exceptions/not-found";
import { ErrorCode } from "../exceptions/root";

export class AdminCashRegisterService {
  async openRegister(
    adminId: string,
    restaurantId: string,
    openingBalance: number,
    notes?: string,
    denominations?: {
      note500?: number;
      note200?: number;
      note100?: number;
      note50?: number;
      note20?: number;
      note10?: number;
      coins?: number;
      coins2?: number;
      coins5?: number;
    }
  ) {
    return await prismaDB.$transaction(async (tx) => {
      // Check if admin has permission for this restaurant
      const restaurant = await tx.restaurant.findFirst({
        where: {
          id: restaurantId,
          OR: [{ adminId: adminId }],
        },
      });

      if (!restaurant) {
        throw new NotFoundException(
          "Restaurant not found or no access",
          ErrorCode.UNAUTHORIZED
        );
      }

      // Check for existing open register
      const activeRegister = await tx.cashRegister.findFirst({
        where: {
          restaurantId,
          openedBy: adminId,
          status: RegisterStatus.OPEN,
        },
      });

      if (activeRegister) {
        throw new Error("Admin already has an active register");
      }

      // Create new register
      const newRegister = await tx.cashRegister.create({
        data: {
          restaurantId,
          openedBy: adminId,
          openingBalance: openingBalance,
          openingCashBalance: openingBalance,
          openingUPIBalance: 0,
          openingCardBalance: 0,
          status: RegisterStatus.OPEN,
          openingNotes: notes,
          denominations: denominations
            ? {
                create: {
                  total: openingBalance, // Only cash denominations
                  ...denominations,
                },
              }
            : undefined,
          transactions: {
            create: {
              type: CashTransactionType.CASH_IN,
              amount: openingBalance,
              description: "Opening cash balance by Admin",
              performedBy: adminId,
              source: "MANUAL",
              paymentMethod: "CASH",
            },
          },
        },
        include: {
          denominations: true,
          transactions: true,
        },
      });

      return newRegister;
    });
  }

  async closeRegister(
    adminId: string,
    registerId: string,
    closingBalance: number,
    notes?: string,
    denominations?: {
      note500?: number;
      note200?: number;
      note100?: number;
      note50?: number;
      note20?: number;
      note10?: number;
      coins?: number;
      coins2?: number;
      coins5?: number;
    }
  ) {
    return await prismaDB.$transaction(async (tx) => {
      // Find active register
      const register = await tx.cashRegister.findFirst({
        where: {
          id: registerId,
          openedBy: adminId,
          status: RegisterStatus.OPEN,
        },
        include: {
          transactions: true,
        },
      });

      if (!register) {
        throw new Error("No active register found");
      }

      // Calculate expected balances for each payment method
      const calculateExpectedBalance = (transactions: any[]) => {
        return transactions.reduce((balance, tx) => {
          return tx.type === "CASH_IN"
            ? balance + tx.amount
            : balance - tx.amount;
        }, 0);
      };

      const expectedBalances = {
        totalExpectedBalance: calculateExpectedBalance(register.transactions),
        cash: calculateExpectedBalance(
          register.transactions.filter((t) => t.paymentMethod === "CASH")
        ),
        upi: calculateExpectedBalance(
          register.transactions.filter((t) => t.paymentMethod === "UPI")
        ),
        card: calculateExpectedBalance(
          register.transactions.filter(
            (t) => t.paymentMethod === "DEBIT" || t.paymentMethod === "CREDIT"
          )
        ),
      };

      // Calculate discrepancies
      const discrepancies =
        closingBalance +
        expectedBalances.upi +
        expectedBalances.card -
        expectedBalances.totalExpectedBalance;

      // Close the register
      const closedRegister = await tx.cashRegister.update({
        where: { id: registerId },
        data: {
          status: RegisterStatus.CLOSED,
          closingBalance:
            closingBalance + expectedBalances.upi + expectedBalances.card,
          closingCashBalance: closingBalance,
          closingUPIBalance: expectedBalances.upi,
          closingCardBalance: expectedBalances.card,
          actualBalance:
            closingBalance + expectedBalances.upi + expectedBalances.card,
          closedAt: new Date(),
          closingNotes: notes,
          denominations: denominations
            ? {
                update: {
                  ...denominations,
                  total: closingBalance,
                },
              }
            : undefined,
        },
      });

      // Record discrepancies if they exist
      for (const [method, amount] of Object.entries(discrepancies)) {
        if (amount !== 0) {
          await tx.cashTransaction.create({
            data: {
              registerId,
              type:
                amount > 0
                  ? CashTransactionType.CASH_IN
                  : CashTransactionType.CASH_OUT,
              amount: Math.abs(amount),
              description: `Register ${method.toUpperCase()} balance discrepancy at closing`,
              performedBy: adminId,
              source: "MANUAL",
              paymentMethod: method.toUpperCase() as PaymentMethod,
            },
          });
        }
      }

      return {
        register: closedRegister,
        summary: {
          opening: {
            cash: register.openingCashBalance,
            upi: register.openingUPIBalance,
            card: register.openingCardBalance,
          },
          expected: expectedBalances,
          actual: closingBalance,
          discrepancies,
        },
      };
    });
  }

  async getRegisterStatus(adminId: string, restaurantId: string) {
    const register = await prismaDB.cashRegister.findFirst({
      where: {
        restaurantId,
        openedBy: adminId,
        status: RegisterStatus.OPEN,
      },
      include: {
        transactions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
        denominations: true,
      },
    });

    if (!register) {
      return {
        hasActiveRegister: false,
        currentBalance: {
          cash: 0,
          upi: 0,
          card: 0,
          total: 0,
        },
      };
    }

    // Calculate current balances
    const calculateBalance = (method: PaymentMethod) => {
      const openingBalance =
        method === "CASH"
          ? register.openingCashBalance
          : method === "UPI"
          ? register.openingUPIBalance
          : register.openingCardBalance;

      return register.transactions
        .filter((t) => t.paymentMethod === method)
        .reduce((balance, tx) => {
          return tx.type === "CASH_IN"
            ? balance + tx.amount
            : balance - tx.amount;
        }, openingBalance || 0);
    };

    return {
      hasActiveRegister: true,
      registerId: register.id,
      openedAt: register.openedAt,
      currentBalance: {
        cash: calculateBalance("CASH"),
        upi: calculateBalance("UPI"),
        card: calculateBalance("DEBIT") + calculateBalance("CREDIT"),
        total:
          register.openingBalance +
          register.transactions.reduce((total, tx) => {
            return tx.type === "CASH_IN"
              ? total + tx.amount
              : total - tx.amount;
          }, 0),
      },
      lastTransactions: register.transactions,
      denominations: register.denominations,
    };
  }
}
