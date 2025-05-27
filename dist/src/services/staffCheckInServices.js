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
exports.StaffCheckInServices = void 0;
const client_1 = require("@prisma/client");
const __1 = require("..");
const bad_request_1 = require("../exceptions/bad-request");
const root_1 = require("../exceptions/root");
const redis_1 = require("./redis");
class StaffCheckInServices {
    handleStaffChecIn(staffId, restaurantId, openingBalance, notes, denominations) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield __1.prismaDB.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                //check if the staff is already checked in
                const activeCheckIn = yield tx.checkInRecord.findFirst({
                    where: {
                        staffId: staffId,
                        status: client_1.CheckInStatus.ACTIVE,
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
                    throw new bad_request_1.BadRequestsException("Staff is already checked in", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
                }
                //check for unclosed previous checkin
                const unclosedCheckIn = yield tx.checkInRecord.findFirst({
                    where: {
                        staffId: staffId,
                        status: "ACTIVE",
                        checkOutTime: null,
                        date: {
                            lt: new Date(),
                        },
                    },
                    include: {
                        register: true,
                    },
                });
                console.log("unclosedCheckIn", unclosedCheckIn);
                if (unclosedCheckIn) {
                    // Force close previous check-in
                    yield this.forceCloseCheckInAndRegister(tx, unclosedCheckIn);
                }
                // Create new register or get active one
                const activeStaffRegister = yield tx.cashRegister.findFirst({
                    where: {
                        openedBy: staffId,
                        status: client_1.RegisterStatus.OPEN,
                    },
                });
                if (activeStaffRegister) {
                    throw new bad_request_1.BadRequestsException("Staff already has an active register", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
                }
                // Create new register for this staff
                const newRegister = yield tx.cashRegister.create({
                    data: {
                        restaurantId,
                        openedBy: staffId,
                        openingBalance,
                        openingCashBalance: openingBalance,
                        openingUPIBalance: 0,
                        openingCardBalance: 0,
                        status: client_1.RegisterStatus.OPEN,
                        openingNotes: notes,
                        denominations: {
                            create: {
                                total: openingBalance,
                                note500: denominations === null || denominations === void 0 ? void 0 : denominations.note500,
                                note200: denominations === null || denominations === void 0 ? void 0 : denominations.note200,
                                note100: denominations === null || denominations === void 0 ? void 0 : denominations.note100,
                                note50: denominations === null || denominations === void 0 ? void 0 : denominations.note50,
                                note20: denominations === null || denominations === void 0 ? void 0 : denominations.note20,
                                note10: denominations === null || denominations === void 0 ? void 0 : denominations.note10,
                                coins: denominations === null || denominations === void 0 ? void 0 : denominations.coins,
                                coins2: denominations === null || denominations === void 0 ? void 0 : denominations.coins2,
                                coins5: denominations === null || denominations === void 0 ? void 0 : denominations.coins5,
                            },
                        },
                        transactions: {
                            create: {
                                type: client_1.CashTransactionType.CASH_IN,
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
                const getTodaysStaleCheckIn = yield tx.checkInRecord.findFirst({
                    where: {
                        staffId: staffId,
                        status: client_1.CheckInStatus.STALE,
                        date: {
                            lt: new Date(),
                        },
                    },
                });
                yield redis_1.redis.del(staffId);
                if (getTodaysStaleCheckIn) {
                    // Create new check-in record
                    const checkIn = yield tx.checkInRecord.update({
                        where: { id: getTodaysStaleCheckIn === null || getTodaysStaleCheckIn === void 0 ? void 0 : getTodaysStaleCheckIn.id },
                        data: {
                            checkInTime: new Date(),
                            status: client_1.CheckInStatus.ACTIVE,
                            registerId: newRegister.id,
                            notes,
                            date: new Date(),
                        },
                    });
                    return { checkIn, register: newRegister };
                }
                else {
                    // Create new check-in record
                    const checkIn = yield tx.checkInRecord.create({
                        data: {
                            staffId,
                            checkInTime: new Date(),
                            status: client_1.CheckInStatus.ACTIVE,
                            registerId: newRegister.id,
                            notes,
                            date: new Date(),
                        },
                    });
                    return { checkIn, register: newRegister };
                }
            }));
        });
    }
    forceCloseCheckInAndRegister(tx, checkIn) {
        return __awaiter(this, void 0, void 0, function* () {
            // Force close the check-in
            yield tx.checkInRecord.update({
                where: { id: checkIn.id },
                data: {
                    status: client_1.CheckInStatus.FORCE_CLOSED,
                    checkOutTime: new Date(),
                    notes: "Auto-closed due to missing checkout",
                },
            });
            // If there's an associated register, force close it
            if (checkIn.register && checkIn.register.status === client_1.RegisterStatus.OPEN) {
                const transactions = yield tx.cashTransaction.findMany({
                    where: { registerId: checkIn.register.id },
                });
                const currentBalance = this.calculateCurrentBalance(transactions);
                yield tx.cashRegister.update({
                    where: { id: checkIn.register.id },
                    data: {
                        status: client_1.RegisterStatus.FORCE_CLOSED,
                        closingBalance: currentBalance,
                        actualBalance: currentBalance,
                        closedAt: new Date(),
                        closingNotes: "Auto-closed due to force closure of staff check-in",
                    },
                });
            }
        });
    }
    handleStaffCheckOut(staffId, closingBalance, notes, denominations) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield __1.prismaDB.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Find active check-in
                const activeCheckIn = yield tx.checkInRecord.findFirst({
                    where: {
                        staffId,
                        status: client_1.CheckInStatus.ACTIVE,
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
                    throw new bad_request_1.BadRequestsException("No active check-in found", root_1.ErrorCode.NOT_FOUND);
                }
                if (!activeCheckIn.register) {
                    throw new bad_request_1.BadRequestsException("No active register found for this check-in", root_1.ErrorCode.NOT_FOUND);
                }
                // Calculate expected balance
                const expectedBalance = this.calculateCurrentBalance(activeCheckIn.register.transactions);
                const expectedBalanceCash = this.calculateCurrentBalance(activeCheckIn.register.transactions.filter((t) => t.paymentMethod === "CASH"));
                const expectedBalanceUPI = this.calculateCurrentBalance(activeCheckIn.register.transactions.filter((t) => t.paymentMethod === "UPI"));
                const expectedCardBalance = this.calculateCurrentBalance(activeCheckIn.register.transactions.filter((t) => t.paymentMethod === "DEBIT" || t.paymentMethod === "CREDIT"));
                // Calculate discrepancy
                const discrepancy = closingBalance +
                    expectedBalanceUPI +
                    expectedCardBalance -
                    expectedBalance;
                // Close the register
                const closedRegister = yield tx.cashRegister.update({
                    where: { id: activeCheckIn.register.id },
                    data: {
                        status: client_1.RegisterStatus.CLOSED,
                        closingBalance: closingBalance + expectedBalanceUPI + expectedCardBalance,
                        closingUPIBalance: expectedBalanceUPI,
                        closingCardBalance: expectedCardBalance,
                        closingCashBalance: closingBalance,
                        actualBalance: expectedBalanceCash + expectedBalanceUPI + expectedCardBalance,
                        closedAt: new Date(),
                        closingNotes: notes,
                        discrepancies: discrepancy,
                        denominations: denominations
                            ? {
                                update: Object.assign(Object.assign({}, denominations), { total: closingBalance }),
                            }
                            : undefined,
                    },
                });
                // Record discrepancy if exists
                // if (discrepancy !== 0) {
                //   await tx.cashTransaction.create({
                //     data: {
                //       registerId: activeCheckIn.register.id,
                //       type:
                //         discrepancy > 0
                //           ? CashTransactionType.CASH_IN
                //           : CashTransactionType.CASH_OUT,
                //       amount: Math.abs(discrepancy),
                //       description: `Register balance discrepancy at closing`,
                //       performedBy: staffId,
                //       source: "MANUAL",
                //       paymentMethod: "CASH",
                //     },
                //   });
                // }
                // Close check-in
                const closedCheckIn = yield tx.checkInRecord.update({
                    where: { id: activeCheckIn.id },
                    data: {
                        checkOutTime: new Date(),
                        status: client_1.CheckInStatus.COMPLETED,
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
            }));
        });
    }
    calculateCurrentBalance(transactions) {
        return transactions.reduce((balance, tx) => {
            if (tx.type === client_1.CashTransactionType.CASH_IN) {
                return balance + tx.amount;
            }
            else {
                return balance - tx.amount;
            }
        }, 0);
    }
}
exports.StaffCheckInServices = StaffCheckInServices;
