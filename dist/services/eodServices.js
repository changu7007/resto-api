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
exports.EodServices = void 0;
const client_1 = require("@prisma/client");
const __1 = require("..");
class EodServices {
    processEndOfDay(restaurantId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield __1.prismaDB.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Close all active check-ins that are either through staff or register linked to the restaurant
                const activeCheckIns = yield tx.checkInRecord.findMany({
                    where: {
                        status: client_1.CheckInStatus.ACTIVE,
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
                    yield tx.checkInRecord.update({
                        where: { id: checkIn.id },
                        data: {
                            status: client_1.CheckInStatus.FORCE_CLOSED,
                            checkOutTime: new Date(),
                            notes: "Auto-closed during EOD process",
                        },
                    });
                }
                // Close all open registers
                const openRegisters = yield tx.cashRegister.findMany({
                    where: {
                        restaurantId,
                        status: client_1.RegisterStatus.OPEN,
                    },
                    include: {
                        transactions: true,
                    },
                });
                for (const register of openRegisters) {
                    const expectedBalance = this.calculateExpectedBalance(register);
                    yield tx.cashRegister.update({
                        where: { id: register.id },
                        data: {
                            status: client_1.RegisterStatus.FORCE_CLOSED,
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
            }));
        });
    }
    calculateExpectedBalance(register) {
        const openingBalance = register.openingBalance;
        const transactions = register.transactions;
        return transactions.reduce((balance, tx) => {
            if (tx.type === "CASH_IN") {
                return balance + tx.amount;
            }
            else {
                return balance - tx.amount;
            }
        }, openingBalance);
    }
}
exports.EodServices = EodServices;
