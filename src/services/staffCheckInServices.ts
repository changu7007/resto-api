import {
  CashTransactionType,
  CheckInStatus,
  RegisterStatus,
} from "@prisma/client";
import { prismaDB } from "..";
import { BadRequestsException } from "../exceptions/bad-request";
import { ErrorCode } from "../exceptions/root";
import { redis } from "./redis";

export class StaffCheckInServices {
  async handleStaffChecIn(
    staffId: string,
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
      //check if the staff is already checked in
      const activeCheckIn = await tx.checkInRecord.findFirst({
        where: {
          staffId: staffId,
          status: CheckInStatus.ACTIVE,
          checkOutTime: null,
          date: {
            gt: new Date(),
          },
        },
        include: {
          register: true,
        },
      });

      if (activeCheckIn) {
        throw new BadRequestsException(
          "Staff is already checked in",
          ErrorCode.UNPROCESSABLE_ENTITY
        );
      }
      //check for unclosed previous checkin
      const unclosedCheckIn = await tx.checkInRecord.findFirst({
        where: {
          staffId: staffId,
          status: CheckInStatus.ACTIVE,
          checkOutTime: null,
          date: {
            lt: new Date(),
          },
        },
        include: {
          register: true,
        },
      });

      if (unclosedCheckIn) {
        // Force close previous check-in
        await this.forceCloseCheckInAndRegister(tx, unclosedCheckIn);
      }

      // Create new register or get active one
      const activeStaffRegister = await tx.cashRegister.findFirst({
        where: {
          openedBy: staffId,
          status: RegisterStatus.OPEN,
        },
      });

      if (activeStaffRegister) {
        throw new BadRequestsException(
          "Staff already has an active register",
          ErrorCode.UNPROCESSABLE_ENTITY
        );
      }

      // Create new register for this staff
      const newRegister = await tx.cashRegister.create({
        data: {
          restaurantId,
          openedBy: staffId,
          openingBalance,
          openingCashBalance: openingBalance,
          openingUPIBalance: 0,
          openingCardBalance: 0,
          status: RegisterStatus.OPEN,
          openingNotes: notes,
          denominations: {
            create: {
              total: openingBalance,
              note500: denominations?.note500,
              note200: denominations?.note200,
              note100: denominations?.note100,
              note50: denominations?.note50,
              note20: denominations?.note20,
              note10: denominations?.note10,
              coins: denominations?.coins,
              coins2: denominations?.coins2,
              coins5: denominations?.coins5,
            },
          },
          transactions: {
            create: {
              type: CashTransactionType.CASH_IN,
              amount: openingBalance,
              description: "Opening balance",
              performedBy: staffId,
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

      const getTodaysStaleCheckIn = await tx.checkInRecord.findFirst({
        where: {
          staffId: staffId,
          status: CheckInStatus.STALE,
          date: {
            lt: new Date(),
          },
        },
      });
      await redis.del(staffId);
      if (getTodaysStaleCheckIn) {
        // Create new check-in record
        const checkIn = await tx.checkInRecord.update({
          where: { id: getTodaysStaleCheckIn?.id },
          data: {
            checkInTime: new Date(),
            status: CheckInStatus.ACTIVE,
            registerId: newRegister.id,
            notes,
            date: new Date(),
          },
        });

        return { checkIn, register: newRegister };
      } else {
        // Create new check-in record
        const checkIn = await tx.checkInRecord.create({
          data: {
            staffId,
            checkInTime: new Date(),
            status: CheckInStatus.ACTIVE,
            registerId: newRegister.id,
            notes,
            date: new Date(),
          },
        });

        return { checkIn, register: newRegister };
      }
    });
  }

  private async forceCloseCheckInAndRegister(tx: any, checkIn: any) {
    // Force close the check-in
    await tx.checkInRecord.update({
      where: { id: checkIn.id },
      data: {
        status: CheckInStatus.FORCE_CLOSED,
        checkOutTime: new Date(),
        notes: "Auto-closed due to missing checkout",
      },
    });

    // If there's an associated register, force close it
    if (checkIn.register && checkIn.register.status === RegisterStatus.OPEN) {
      const transactions = await tx.cashTransaction.findMany({
        where: { registerId: checkIn.register.id },
      });

      const currentBalance = this.calculateCurrentBalance(transactions);

      await tx.cashRegister.update({
        where: { id: checkIn.register.id },
        data: {
          status: RegisterStatus.FORCE_CLOSED,
          closingBalance: currentBalance,
          actualBalance: currentBalance,
          closedAt: new Date(),
          closingNotes: "Auto-closed due to force closure of staff check-in",
        },
      });
    }
  }

  async handleStaffCheckOut(
    staffId: string,
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
      // Find active check-in
      const activeCheckIn = await tx.checkInRecord.findFirst({
        where: {
          staffId,
          status: CheckInStatus.ACTIVE,
        },
        include: {
          register: {
            include: {
              denominations: true,
              transactions: true,
            },
          },
        },
      });

      if (!activeCheckIn) {
        throw new BadRequestsException(
          "No active check-in found",
          ErrorCode.NOT_FOUND
        );
      }

      if (!activeCheckIn.register) {
        throw new BadRequestsException(
          "No active register found for this check-in",
          ErrorCode.NOT_FOUND
        );
      }

      // Calculate expected balance
      const expectedBalance = this.calculateCurrentBalance(
        activeCheckIn.register.transactions
      );

      const expectedBalanceCash = this.calculateCurrentBalance(
        activeCheckIn.register.transactions.filter(
          (t) => t.paymentMethod === "CASH"
        )
      );

      const expectedBalanceUPI = this.calculateCurrentBalance(
        activeCheckIn.register.transactions.filter(
          (t) => t.paymentMethod === "UPI"
        )
      );

      const expectedCardBalance = this.calculateCurrentBalance(
        activeCheckIn.register.transactions.filter(
          (t) => t.paymentMethod === "DEBIT" || t.paymentMethod === "CREDIT"
        )
      );

      // Calculate discrepancy
      const discrepancy =
        closingBalance +
        expectedBalanceUPI +
        expectedCardBalance -
        expectedBalance;

      // Close the register
      const closedRegister = await tx.cashRegister.update({
        where: { id: activeCheckIn.register.id },
        data: {
          status: RegisterStatus.CLOSED,
          closingBalance:
            closingBalance + expectedBalanceUPI + expectedCardBalance,
          closingUPIBalance: expectedBalanceUPI,
          closingCardBalance: expectedCardBalance,
          closingCashBalance: closingBalance,
          actualBalance:
            expectedBalanceCash + expectedBalanceUPI + expectedCardBalance,
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

      // Record discrepancy if exists
      if (discrepancy !== 0) {
        await tx.cashTransaction.create({
          data: {
            registerId: activeCheckIn.register.id,
            type:
              discrepancy > 0
                ? CashTransactionType.CASH_IN
                : CashTransactionType.CASH_OUT,
            amount: Math.abs(discrepancy),
            description: `Register balance discrepancy at closing`,
            performedBy: staffId,
            source: "MANUAL",
            paymentMethod: "CASH",
          },
        });
      }

      // Close check-in
      const closedCheckIn = await tx.checkInRecord.update({
        where: { id: activeCheckIn.id },
        data: {
          checkOutTime: new Date(),
          status: CheckInStatus.COMPLETED,
          notes: notes,
        },
      });

      return {
        checkIn: closedCheckIn,
        register: closedRegister,
        summary: {
          openingBalance: activeCheckIn.register.openingBalance,
          expectedBalance,
          actualBalance: closingBalance,
          discrepancy,
          totalTransactions: activeCheckIn.register.transactions.length,
        },
      };
    });
  }

  public calculateCurrentBalance(transactions: any[]): number {
    return transactions.reduce((balance, tx) => {
      if (tx.type === CashTransactionType.CASH_IN) {
        return balance + tx.amount;
      } else {
        return balance - tx.amount;
      }
    }, 0);
  }
}
