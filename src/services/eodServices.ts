import { CheckInStatus, RegisterStatus } from "@prisma/client";
import { prismaDB } from "..";

export class EodServices {
  async processEndOfDay(restaurantId: string) {
    return await prismaDB.$transaction(async (tx) => {
      // Close all active check-ins that are either through staff or register linked to the restaurant
      const activeCheckIns = await tx.checkInRecord.findMany({
        where: {
          status: CheckInStatus.ACTIVE,
          OR: [
            {
              staff: {
                restaurantId,
              },
            },
            {
              register: {
                restaurantId,
              },
            },
          ],
        },
      });

      for (const checkIn of activeCheckIns) {
        await tx.checkInRecord.update({
          where: { id: checkIn.id },
          data: {
            status: CheckInStatus.FORCE_CLOSED,
            checkOutTime: new Date(),
            notes: "Auto-closed during EOD process",
          },
        });
      }

      // Close all open registers
      const openRegisters = await tx.cashRegister.findMany({
        where: {
          restaurantId,
          status: RegisterStatus.OPEN,
        },
        include: {
          transactions: true,
        },
      });

      for (const register of openRegisters) {
        const expectedBalance = this.calculateExpectedBalance(register);

        await tx.cashRegister.update({
          where: { id: register.id },
          data: {
            status: RegisterStatus.FORCE_CLOSED,
            closingBalance: expectedBalance,
            actualBalance: expectedBalance,
            closedAt: new Date(),
            closingNotes: "Auto-closed during EOD process",
          },
        });
      }

      return {
        closedCheckIns: activeCheckIns.length,
        closedRegisters: openRegisters.length,
      };
    });
  }

  private calculateExpectedBalance(register: any) {
    const openingBalance = register.openingBalance;
    const transactions = register.transactions;

    return transactions.reduce((balance: number, tx: any) => {
      if (tx.type === "CASH_IN") {
        return balance + tx.amount;
      } else {
        return balance - tx.amount;
      }
    }, openingBalance);
  }
}
