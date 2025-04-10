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
exports.AdminCashRegisterService = void 0;
const client_1 = require("@prisma/client");
const __1 = require("..");
const not_found_1 = require("../exceptions/not-found");
const root_1 = require("../exceptions/root");
class AdminCashRegisterService {
    openRegister(adminId, restaurantId, openingBalance, notes, denominations) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield __1.prismaDB.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Check if admin has permission for this restaurant
                const restaurant = yield tx.restaurant.findFirst({
                    where: {
                        id: restaurantId,
                        OR: [{ adminId: adminId }],
                    },
                });
                if (!restaurant) {
                    throw new not_found_1.NotFoundException("Restaurant not found or no access", root_1.ErrorCode.UNAUTHORIZED);
                }
                // Check for existing open register
                const activeRegister = yield tx.cashRegister.findFirst({
                    where: {
                        restaurantId,
                        openedBy: adminId,
                        status: client_1.RegisterStatus.OPEN,
                    },
                });
                if (activeRegister) {
                    throw new Error("Admin already has an active register");
                }
                // Create new register
                const newRegister = yield tx.cashRegister.create({
                    data: {
                        restaurantId,
                        openedBy: adminId,
                        openingBalance: openingBalance,
                        openingCashBalance: openingBalance,
                        openingUPIBalance: 0,
                        openingCardBalance: 0,
                        status: client_1.RegisterStatus.OPEN,
                        openingNotes: notes,
                        denominations: denominations
                            ? {
                                create: Object.assign({ total: openingBalance }, denominations),
                            }
                            : undefined,
                        transactions: {
                            create: {
                                type: client_1.CashTransactionType.CASH_IN,
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
            }));
        });
    }
    closeRegister(adminId, registerId, closingBalance, notes, denominations) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield __1.prismaDB.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                // Find active register
                const register = yield tx.cashRegister.findFirst({
                    where: {
                        id: registerId,
                        openedBy: adminId,
                        status: client_1.RegisterStatus.OPEN,
                    },
                    include: {
                        transactions: true,
                    },
                });
                if (!register) {
                    throw new Error("No active register found");
                }
                // Calculate expected balances for each payment method
                const calculateExpectedBalance = (transactions) => {
                    return transactions.reduce((balance, tx) => {
                        return tx.type === "CASH_IN"
                            ? balance + tx.amount
                            : balance - tx.amount;
                    }, 0);
                };
                const expectedBalances = {
                    totalExpectedBalance: calculateExpectedBalance(register.transactions),
                    cash: calculateExpectedBalance(register.transactions.filter((t) => t.paymentMethod === "CASH")),
                    upi: calculateExpectedBalance(register.transactions.filter((t) => t.paymentMethod === "UPI")),
                    card: calculateExpectedBalance(register.transactions.filter((t) => t.paymentMethod === "DEBIT" || t.paymentMethod === "CREDIT")),
                };
                // Calculate discrepancies
                const discrepancies = closingBalance +
                    expectedBalances.upi +
                    expectedBalances.card -
                    expectedBalances.totalExpectedBalance;
                // Close the register
                const closedRegister = yield tx.cashRegister.update({
                    where: { id: registerId },
                    data: {
                        status: client_1.RegisterStatus.CLOSED,
                        closingBalance: closingBalance + expectedBalances.upi + expectedBalances.card,
                        closingCashBalance: closingBalance,
                        closingUPIBalance: expectedBalances.upi,
                        closingCardBalance: expectedBalances.card,
                        actualBalance: expectedBalances.cash +
                            expectedBalances.upi +
                            expectedBalances.card,
                        closedAt: new Date(),
                        closingNotes: notes,
                        denominations: denominations
                            ? {
                                update: Object.assign(Object.assign({}, denominations), { total: closingBalance }),
                            }
                            : undefined,
                    },
                });
                // Record discrepancies if they exist
                for (const [method, amount] of Object.entries(discrepancies)) {
                    if (amount !== 0) {
                        yield tx.cashTransaction.create({
                            data: {
                                registerId,
                                type: amount > 0
                                    ? client_1.CashTransactionType.CASH_IN
                                    : client_1.CashTransactionType.CASH_OUT,
                                amount: Math.abs(amount),
                                description: `Register ${method.toUpperCase()} balance discrepancy at closing`,
                                performedBy: adminId,
                                source: "MANUAL",
                                paymentMethod: method.toUpperCase(),
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
            }));
        });
    }
    getRegisterStatus(adminId, restaurantId) {
        return __awaiter(this, void 0, void 0, function* () {
            const register = yield __1.prismaDB.cashRegister.findFirst({
                where: {
                    restaurantId,
                    openedBy: adminId,
                    status: client_1.RegisterStatus.OPEN,
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
            const calculateBalance = (method) => {
                const openingBalance = method === "CASH"
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
                    total: register.openingBalance +
                        register.transactions.reduce((total, tx) => {
                            return tx.type === "CASH_IN"
                                ? total + tx.amount
                                : total - tx.amount;
                        }, 0),
                },
                lastTransactions: register.transactions,
                denominations: register.denominations,
            };
        });
    }
}
exports.AdminCashRegisterService = AdminCashRegisterService;
