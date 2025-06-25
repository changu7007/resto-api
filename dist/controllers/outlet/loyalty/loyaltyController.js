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
exports.getCampaigns = exports.createCampaign = exports.awardPointsToCustomer = exports.addCustomerToLoyaltyProgram = exports.deleteLoyaltyProgram = exports.updateLoyaltyProgram = exports.createLoyaltyProgram = exports.getLoyaltyCustomers = exports.getLoyaltyPrograms = exports.getLoyaltyOverview = void 0;
const zod_1 = require("zod");
const __1 = require("../../..");
const client_1 = require("@prisma/client");
const utils_1 = require("../../../lib/utils");
const bad_request_1 = require("../../../exceptions/bad-request");
const root_1 = require("../../../exceptions/root");
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
// Validation schema for loyalty program
const loyaltyProgramSchema = zod_1.z
    .object({
    pogramName: zod_1.z.string().min(1, "Program name is required"),
    loyaltyProgramType: zod_1.z.nativeEnum(client_1.LoyaltyProgramType),
    programDescription: zod_1.z.string().min(1, "Description is required"),
    status: zod_1.z.boolean(),
    expiryDays: zod_1.z.number().min(1, "Expiry days must be at least 1"),
    pointsRatio: zod_1.z.number().nullable().optional(),
    minimumPointsToRedemption: zod_1.z.number().nullable().optional(),
    visitRequiredForReward: zod_1.z.number().nullable().optional(),
    visitCompletedReward: zod_1.z.string().nullable().optional(),
    menuId: zod_1.z.string().nullable().optional(),
    referrerReward: zod_1.z.number().nullable().optional(),
    refereeReward: zod_1.z.number().nullable().optional(),
    loginPoints: zod_1.z.number().nullable().optional(),
    cashBackPercentage: zod_1.z.number().nullable().optional(),
    minSpendForCashback: zod_1.z.number().nullable().optional(),
    tiers: zod_1.z
        .array(zod_1.z.object({
        name: zod_1.z.string(),
        threshold: zod_1.z.number(),
        benefits: zod_1.z.string(),
        color: zod_1.z.string().optional(),
    }))
        .optional(),
})
    .refine((data) => {
    if (data.loyaltyProgramType === client_1.LoyaltyProgramType.LOGIN_BASED) {
        return data.loginPoints != null && data.loginPoints > 0;
    }
    return true;
}, {
    message: "Login points are required for login-based programs",
    path: ["loginPoints"],
})
    .refine((data) => {
    if (data.loyaltyProgramType === client_1.LoyaltyProgramType.POINT_BASED) {
        return (data.pointsRatio != null &&
            data.pointsRatio > 0 &&
            data.minimumPointsToRedemption != null &&
            data.minimumPointsToRedemption > 0);
    }
    return true;
}, {
    message: "Points ratio and minimum redemption are required for points-based programs",
    path: ["pointsRatio"],
})
    .refine((data) => {
    if (data.loyaltyProgramType === client_1.LoyaltyProgramType.VISIT_BASED) {
        return (data.visitRequiredForReward != null &&
            data.visitRequiredForReward > 0 &&
            data.visitCompletedReward != null &&
            data.menuId != null);
    }
    return true;
}, {
    message: "Visit requirements and reward are required for visit-based programs",
    path: ["visitRequiredForReward"],
})
    .refine((data) => {
    if (data.loyaltyProgramType === client_1.LoyaltyProgramType.SPEND_BASED_TIERS) {
        return (data.tiers != null &&
            data.tiers.length === 3 &&
            data.tiers.some((tier) => tier.name === "SILVER") &&
            data.tiers.some((tier) => tier.name === "GOLD") &&
            data.tiers.some((tier) => tier.name === "PLATINUM") &&
            data.tiers.every((tier) => tier.threshold > 0) &&
            data.tiers.every((tier) => tier.benefits.length > 0));
    }
    return true;
}, {
    message: "Tier-based programs require exactly 3 tiers (Silver, Gold, Platinum) with thresholds and benefits",
    path: ["tiers"],
})
    .refine((data) => {
    if (data.loyaltyProgramType === client_1.LoyaltyProgramType.REFERAL_BASED) {
        return (data.referrerReward != null &&
            data.referrerReward > 0 &&
            data.refereeReward != null &&
            data.refereeReward > 0);
    }
    return true;
}, {
    message: "Referrer and referee rewards are required for referral-based programs",
    path: ["referrerReward"],
})
    .refine((data) => {
    if (data.loyaltyProgramType === client_1.LoyaltyProgramType.CASHBACK_WALLET_BASED) {
        return (data.cashBackPercentage != null &&
            data.cashBackPercentage > 0 &&
            data.minSpendForCashback != null &&
            data.minSpendForCashback > 0);
    }
    return true;
}, {
    message: "Cashback percentage and minimum spend are required for cashback programs",
    path: ["cashBackPercentage"],
});
// Get loyalty overview data
const getLoyaltyOverview = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { restaurantId } = req.params;
        // Get total members
        const totalMembers = yield __1.prismaDB.customerLoyalty.count({
            where: {
                loyaltyProgram: {
                    restaurantId,
                },
            },
        });
        // Get active programs
        const activePrograms = yield __1.prismaDB.loyaltyProgram.count({
            where: {
                restaurantId,
                status: true,
            },
        });
        // Get points redeemed (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const pointsRedeemed = yield __1.prismaDB.loyaltyTransaction.aggregate({
            where: {
                restaurantId,
                type: client_1.TransactionType.POINTS_REDEEMED,
                transactionDate: {
                    gte: thirtyDaysAgo,
                },
            },
            _sum: {
                points: true,
            },
        });
        // Get retention rate (customers who visited in last 30 days / total customers)
        const customersWithRecentVisits = yield __1.prismaDB.customerLoyalty.count({
            where: {
                loyaltyProgram: {
                    restaurantId,
                },
                lastVisitDate: {
                    gte: thirtyDaysAgo,
                },
            },
        });
        const retentionRate = totalMembers > 0
            ? Math.round((customersWithRecentVisits / totalMembers) * 100)
            : 0;
        // Get program performance data
        const programPerformance = yield __1.prismaDB.loyaltyProgram.findMany({
            where: {
                restaurantId,
            },
            select: {
                id: true,
                pogramName: true,
                loyaltyProgramType: true,
                customerLoyalty: {
                    select: {
                        points: true,
                        visits: true,
                        walletBalance: true,
                    },
                },
            },
        });
        // Format program performance data
        const formattedProgramPerformance = programPerformance.map((program) => {
            const totalPoints = program.customerLoyalty.reduce((sum, customer) => sum + customer.points, 0);
            const totalVisits = program.customerLoyalty.reduce((sum, customer) => sum + customer.visits, 0);
            const totalWalletBalance = program.customerLoyalty.reduce((sum, customer) => sum + customer.walletBalance, 0);
            return {
                id: program.id,
                name: program.pogramName,
                type: program.loyaltyProgramType,
                totalPoints,
                totalVisits,
                totalWalletBalance,
            };
        });
        // Get recent activity
        const recentActivity = yield __1.prismaDB.loyaltyTransaction.findMany({
            where: {
                restaurantId,
            },
            orderBy: {
                transactionDate: "desc",
            },
            take: 5,
            include: {
                restaurantCustomers: {
                    select: {
                        customer: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });
        // Format recent activity
        const formattedRecentActivity = recentActivity.map((activity) => {
            const customerName = activity.restaurantCustomers.customer
                ? `${activity.restaurantCustomers.customer.name}`
                : "Unknown Customer";
            let description = "";
            switch (activity.type) {
                case client_1.TransactionType.POINTS_EARNED:
                    description = `${customerName} earned ${activity.points} points`;
                    break;
                case client_1.TransactionType.POINTS_REDEEMED:
                    description = `${customerName} redeemed ${activity.points} points`;
                    break;
                case client_1.TransactionType.VISIT_RECORDED:
                    description = `${customerName} recorded a visit`;
                    break;
                case client_1.TransactionType.TIER_UPGRADE:
                    description = `${customerName} upgraded to a higher tier`;
                    break;
                case client_1.TransactionType.REFERRAL_BONUS:
                    description = `${customerName} received a referral bonus`;
                    break;
                case client_1.TransactionType.CASHBACK_EARNED:
                    description = `${customerName} earned ${activity.amount} cashback`;
                    break;
                case client_1.TransactionType.CASHBACK_REDEEMED:
                    description = `${customerName} redeemed ${activity.amount} cashback`;
                    break;
                default:
                    description = `${customerName} performed a loyalty action`;
            }
            return {
                id: activity.id,
                description,
                date: activity.transactionDate,
                type: activity.type,
            };
        });
        // Get upcoming campaigns
        const upcomingCampaigns = yield __1.prismaDB.campaign.findMany({
            where: {
                restaurantId,
                isActive: true,
                startDate: {
                    gte: new Date(),
                },
            },
            orderBy: {
                startDate: "asc",
            },
            take: 5,
        });
        // Format upcoming campaigns
        const formattedUpcomingCampaigns = upcomingCampaigns.map((campaign) => {
            const daysUntilStart = Math.ceil((campaign.startDate.getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24));
            return {
                id: campaign.id,
                name: campaign.name,
                description: campaign.description,
                type: campaign.campaignType,
                startDate: campaign.startDate,
                endDate: campaign.endDate,
                daysUntilStart,
                targetAudience: campaign.targetAudience,
                reward: campaign.reward,
            };
        });
        return res.status(200).json({
            success: true,
            data: {
                totalMembers,
                activePrograms,
                pointsRedeemed: pointsRedeemed._sum.points || 0,
                retentionRate,
                programPerformance: formattedProgramPerformance,
                recentActivity: formattedRecentActivity,
                upcomingCampaigns: formattedUpcomingCampaigns,
            },
        });
    }
    catch (error) {
        console.error("Error fetching loyalty overview:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch loyalty overview data",
        });
    }
});
exports.getLoyaltyOverview = getLoyaltyOverview;
// Get loyalty programs
const getLoyaltyPrograms = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { restaurantId } = req.params;
    const { type } = req.query;
    let whereClause = {
        restaurantId,
    };
    if (type) {
        whereClause.loyaltyProgramType = type;
    }
    const programs = yield __1.prismaDB.loyaltyProgram.findMany({
        where: whereClause,
        include: {
            customerLoyalty: {
                select: {
                    id: true,
                },
            },
            tiers: {
                select: {
                    id: true,
                    name: true,
                    threshold: true,
                    benefits: true,
                    color: true,
                },
            },
        },
    });
    // Format programs data
    const formattedPrograms = programs.map((program) => {
        const memberCount = program.customerLoyalty.length;
        const tiers = program.tiers.map((tier) => ({
            id: tier.id,
            name: tier.name,
            threshold: tier.threshold,
            benefits: tier.benefits,
            color: tier.color,
        }));
        return {
            id: program.id,
            name: program.pogramName,
            type: program.loyaltyProgramType,
            status: program.status,
            description: program.programDescription,
            memberCount,
            tiers,
            menuId: program === null || program === void 0 ? void 0 : program.menuId,
            // Program type specific fields
            pointsRatio: program.pointsRatio,
            loginPoints: program.loginPoints,
            minimumPointsToRedemption: program.minimumPointsToRedemption,
            visitRequiredForReward: program.visitRequiredForReward,
            visitCompletedReward: program.visitCompletedReward,
            referrerReward: program.referrerReward,
            refereeReward: program.refereeReward,
            cashBackPercentage: program.cashBackPercentage,
            minSpendForCashback: program.minSpendForCashback,
        };
    });
    return res.json({
        success: true,
        data: formattedPrograms,
    });
});
exports.getLoyaltyPrograms = getLoyaltyPrograms;
// Get loyalty customers
const getLoyaltyCustomers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { restaurantId } = req.params;
    const { programId, tier, search, page = 0, limit = 10 } = req.query;
    const skip = Number(page) * Number(limit);
    let whereClause = {
        restaurantId,
    };
    if (search) {
        whereClause.customer = {
            OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phoneNo: { contains: search, mode: "insensitive" } },
            ],
        };
    }
    // Get all customers with restaurant access and loyalty program
    const restaurantAccesses = yield __1.prismaDB.customerRestaurantAccess.findMany({
        where: whereClause,
        skip,
        take: Number(limit),
        orderBy: {
            createdAt: "desc",
        },
        include: {
            customer: true,
            loyaltyPrograms: {
                where: programId ? { loyaltyProgramId: programId } : {},
                include: {
                    loyaltyProgram: {
                        select: {
                            id: true,
                            pogramName: true,
                            loyaltyProgramType: true,
                        },
                    },
                    currentTier: {
                        select: {
                            id: true,
                            name: true,
                            color: true,
                        },
                    },
                },
            },
        },
    });
    const totalCustomers = yield __1.prismaDB.customerRestaurantAccess.count({
        where: whereClause,
    });
    // Format customers data
    const formattedCustomers = restaurantAccesses.map((access) => {
        var _a, _b, _c, _d;
        const loyaltyData = access.loyaltyPrograms[0];
        const programData = loyaltyData === null || loyaltyData === void 0 ? void 0 : loyaltyData.loyaltyProgram;
        const tierData = loyaltyData === null || loyaltyData === void 0 ? void 0 : loyaltyData.currentTier;
        return {
            id: access.id,
            customerRestaurantId: access.id,
            customerId: access.customerId,
            name: ((_a = access.customer) === null || _a === void 0 ? void 0 : _a.name) || "",
            email: ((_b = access.customer) === null || _b === void 0 ? void 0 : _b.email) || "",
            phone: ((_c = access.customer) === null || _c === void 0 ? void 0 : _c.phoneNo) || "",
            dateOfBirth: (_d = access.customer) === null || _d === void 0 ? void 0 : _d.dob,
            enrollmentDate: loyaltyData === null || loyaltyData === void 0 ? void 0 : loyaltyData.enrollmentDate,
            points: (loyaltyData === null || loyaltyData === void 0 ? void 0 : loyaltyData.points) || 0,
            visits: (loyaltyData === null || loyaltyData === void 0 ? void 0 : loyaltyData.visits) || 0,
            walletBalance: (loyaltyData === null || loyaltyData === void 0 ? void 0 : loyaltyData.walletBalance) || 0,
            lifeTimePoints: (loyaltyData === null || loyaltyData === void 0 ? void 0 : loyaltyData.lifeTimePoints) || 0,
            lifeTimeSpend: (loyaltyData === null || loyaltyData === void 0 ? void 0 : loyaltyData.lifeTimeSpend) || 0,
            lastVisitDate: loyaltyData === null || loyaltyData === void 0 ? void 0 : loyaltyData.lastVisitDate,
            program: programData
                ? {
                    id: programData.id,
                    name: programData.pogramName,
                    type: programData.loyaltyProgramType,
                }
                : null,
            tier: tierData
                ? {
                    id: tierData.id,
                    name: tierData.name,
                    color: tierData.color,
                }
                : null,
        };
    });
    return res.json({
        success: true,
        data: {
            customers: formattedCustomers,
            pagination: {
                total: totalCustomers,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(totalCustomers / Number(limit)),
            },
        },
    });
});
exports.getLoyaltyCustomers = getLoyaltyCustomers;
// Create a new loyalty program
const createLoyaltyProgram = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { restaurantId } = req.params;
    const programData = req.body;
    // Validate the request data
    const validationResult = loyaltyProgramSchema.safeParse(programData);
    if (!validationResult.success) {
        throw new bad_request_1.BadRequestsException((_a = validationResult === null || validationResult === void 0 ? void 0 : validationResult.error) === null || _a === void 0 ? void 0 : _a.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const getOutlet = (0, outlet_1.getOutletById)(restaurantId);
    if (!getOutlet) {
        throw new not_found_1.NotFoundException("Restaurant Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const validatedData = validationResult.data;
    // Create the program
    const program = yield __1.prismaDB.loyaltyProgram.create({
        data: {
            restaurantId: restaurantId,
            pogramName: validatedData.pogramName,
            slug: (0, utils_1.generateSlug)(validatedData.pogramName),
            loyaltyProgramType: validatedData.loyaltyProgramType,
            programDescription: validatedData.programDescription,
            status: validatedData.status,
            expiryDays: validatedData.expiryDays,
            pointsRatio: validatedData.pointsRatio !== undefined
                ? validatedData.pointsRatio
                : null,
            minimumPointsToRedemption: validatedData.minimumPointsToRedemption !== undefined
                ? validatedData.minimumPointsToRedemption
                : null,
            visitRequiredForReward: validatedData.visitRequiredForReward !== undefined
                ? validatedData.visitRequiredForReward
                : null,
            visitCompletedReward: validatedData.loyaltyProgramType === "VISIT_BASED"
                ? validatedData === null || validatedData === void 0 ? void 0 : validatedData.visitCompletedReward
                : "FREE REWARD",
            referrerReward: validatedData.referrerReward !== undefined
                ? validatedData.referrerReward
                : null,
            refereeReward: validatedData.refereeReward !== undefined
                ? validatedData.refereeReward
                : null,
            loginPoints: validatedData.loginPoints !== undefined
                ? validatedData.loginPoints
                : null,
            cashBackPercentage: validatedData.cashBackPercentage !== undefined
                ? validatedData.cashBackPercentage
                : null,
            minSpendForCashback: validatedData.minSpendForCashback !== undefined
                ? validatedData.minSpendForCashback
                : null,
            menuId: (validatedData === null || validatedData === void 0 ? void 0 : validatedData.menuId) !== undefined ? validatedData === null || validatedData === void 0 ? void 0 : validatedData.menuId : null,
        },
    });
    // Create tiers if provided
    if (validatedData.tiers && validatedData.tiers.length > 0) {
        yield Promise.all(validatedData.tiers.map((tier) => __1.prismaDB.tier.create({
            data: {
                name: tier.name,
                threshold: tier.threshold,
                benefits: tier.benefits,
                color: tier.color || "#000000",
                programId: program.id,
            },
        })));
    }
    return res.json({
        success: true,
        message: "Loyalty program created successfully",
        data: program,
    });
});
exports.createLoyaltyProgram = createLoyaltyProgram;
// Update a loyalty program
const updateLoyaltyProgram = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { restaurantId, programId } = req.params;
    const programData = (_b = req.body.programData) === null || _b === void 0 ? void 0 : _b.data;
    // Validate the request data
    const { data, error } = loyaltyProgramSchema.safeParse(programData);
    if (error) {
        throw new bad_request_1.BadRequestsException(error === null || error === void 0 ? void 0 : error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const validatedData = data;
    const getOutlet = (0, outlet_1.getOutletById)(restaurantId);
    if (!getOutlet) {
        throw new not_found_1.NotFoundException("Restaurant Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const findLoyaltyProgram = yield __1.prismaDB.loyaltyProgram.findFirst({
        where: {
            id: programId,
            restaurantId: restaurantId,
        },
    });
    if (!findLoyaltyProgram) {
        throw new not_found_1.NotFoundException("Loyalty Program Not Found", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Update the program
    const program = yield __1.prismaDB.loyaltyProgram.update({
        where: {
            id: findLoyaltyProgram === null || findLoyaltyProgram === void 0 ? void 0 : findLoyaltyProgram.id,
            restaurantId,
        },
        data: {
            pogramName: validatedData.pogramName,
            loyaltyProgramType: validatedData.loyaltyProgramType,
            programDescription: validatedData.programDescription,
            status: validatedData.status,
            expiryDays: validatedData.expiryDays,
            pointsRatio: validatedData.pointsRatio !== undefined
                ? validatedData.pointsRatio
                : null,
            minimumPointsToRedemption: validatedData.minimumPointsToRedemption !== undefined
                ? validatedData.minimumPointsToRedemption
                : null,
            visitRequiredForReward: validatedData.visitRequiredForReward !== undefined
                ? validatedData.visitRequiredForReward
                : null,
            visitCompletedReward: validatedData.loyaltyProgramType === "VISIT_BASED"
                ? validatedData === null || validatedData === void 0 ? void 0 : validatedData.visitCompletedReward
                : "FREE REWARD",
            referrerReward: validatedData.referrerReward !== undefined
                ? validatedData.referrerReward
                : null,
            refereeReward: validatedData.refereeReward !== undefined
                ? validatedData.refereeReward
                : null,
            loginPoints: validatedData.loginPoints !== undefined
                ? validatedData.loginPoints
                : null,
            cashBackPercentage: validatedData.cashBackPercentage !== undefined
                ? validatedData.cashBackPercentage
                : null,
            minSpendForCashback: validatedData.minSpendForCashback !== undefined
                ? validatedData.minSpendForCashback
                : null,
            menuId: (validatedData === null || validatedData === void 0 ? void 0 : validatedData.menuId) !== undefined ? validatedData === null || validatedData === void 0 ? void 0 : validatedData.menuId : null,
        },
    });
    // Update tiers if provided
    if (validatedData.tiers && validatedData.tiers.length > 0) {
        // Delete existing tiers
        yield __1.prismaDB.tier.deleteMany({
            where: {
                programId,
            },
        });
        // Create new tiers
        yield Promise.all(validatedData.tiers.map((tier) => __1.prismaDB.tier.create({
            data: {
                name: tier.name,
                threshold: tier.threshold,
                benefits: tier.benefits,
                color: tier.color || "#000000",
                programId: program.id,
            },
        })));
    }
    return res.json({
        success: true,
        message: "Loyalty program updated successfully",
        data: program,
    });
});
exports.updateLoyaltyProgram = updateLoyaltyProgram;
// Delete a loyalty program
const deleteLoyaltyProgram = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { restaurantId, programId } = req.params;
        // Delete the loyalty program
        yield __1.prismaDB.loyaltyProgram.delete({
            where: {
                id: programId,
                restaurantId,
            },
        });
        return res.status(200).json({
            success: true,
            message: "Loyalty program deleted successfully",
        });
    }
    catch (error) {
        console.error("Error deleting loyalty program:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete loyalty program",
        });
    }
});
exports.deleteLoyaltyProgram = deleteLoyaltyProgram;
// Add a customer to a loyalty program
const addCustomerToLoyaltyProgram = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { restaurantId } = req.params;
        const { customerId, programId, points = 0, visits = 0, walletBalance = 0, } = req.body;
        // Check if customer exists in the restaurant
        const customerAccess = yield __1.prismaDB.customerRestaurantAccess.findFirst({
            where: {
                restaurantId,
                customerId,
            },
        });
        if (!customerAccess) {
            return res.status(404).json({
                success: false,
                message: "Customer not found in this restaurant",
            });
        }
        // Check if customer is already enrolled in the program
        const existingEnrollment = yield __1.prismaDB.customerLoyalty.findFirst({
            where: {
                loyaltyProgramId: programId,
                restaurantCustomerId: customerAccess.id,
            },
        });
        if (existingEnrollment) {
            return res.status(400).json({
                success: false,
                message: "Customer is already enrolled in this program",
            });
        }
        // Add customer to the loyalty program
        const enrollment = yield __1.prismaDB.customerLoyalty.create({
            data: {
                restaurantCustomerId: customerAccess.id,
                loyaltyProgramId: programId,
                enrollmentDate: new Date(),
                points,
                visits,
                walletBalance,
                lifeTimePoints: points,
                lifeTimeSpend: 0,
            },
        });
        return res.status(201).json({
            success: true,
            message: "Customer added to loyalty program successfully",
            data: enrollment,
        });
    }
    catch (error) {
        console.error("Error adding customer to loyalty program:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to add customer to loyalty program",
        });
    }
});
exports.addCustomerToLoyaltyProgram = addCustomerToLoyaltyProgram;
const customerAwardForm = zod_1.z.object({
    customerId: zod_1.z.string({ required_error: "Customer is required" }),
    loyaltyProgramId: zod_1.z.string({ required_error: "Loyalty Program is required" }),
    points: zod_1.z.number({ required_error: "Points is required" }),
    reason: zod_1.z.string({ required_error: "Reason is required" }),
    notes: zod_1.z.string().optional(),
});
// Award points to a customer
const awardPointsToCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const { restaurantId } = req.params;
    // Validate the request data
    const validationResult = customerAwardForm.safeParse(req.body);
    if (!validationResult.success) {
        throw new bad_request_1.BadRequestsException((_c = validationResult === null || validationResult === void 0 ? void 0 : validationResult.error) === null || _c === void 0 ? void 0 : _c.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const { customerId, loyaltyProgramId, points } = validationResult.data;
    // Check if customer is enrolled in the program
    const customerLoyalty = yield __1.prismaDB.customerLoyalty.findFirst({
        where: {
            loyaltyProgram: {
                id: loyaltyProgramId,
                restaurantId,
            },
            restuarantCustomer: {
                customerId: customerId,
            },
        },
    });
    if (!customerLoyalty) {
        return res.status(404).json({
            success: false,
            message: "Customer is not enrolled in this program",
        });
    }
    // Create a transaction record
    const transaction = yield __1.prismaDB.loyaltyTransaction.create({
        data: {
            restaurantId,
            restaurantCustomerId: customerLoyalty.restaurantCustomerId,
            programId: loyaltyProgramId,
            type: client_1.TransactionType.POINTS_EARNED,
            points,
        },
    });
    // Update customer's points
    yield __1.prismaDB.customerLoyalty.update({
        where: {
            id: customerLoyalty.id,
        },
        data: {
            points: {
                increment: points,
            },
            lifeTimePoints: {
                increment: points,
            },
        },
    });
    return res.status(201).json({
        success: true,
        message: "Points awarded successfully",
        data: transaction,
    });
});
exports.awardPointsToCustomer = awardPointsToCustomer;
// Create a campaign
const createCampaign = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { restaurantId } = req.params;
        const { name, description, campaignType, startDate, endDate, isActive, targetAudience, reward, programId, } = req.body;
        // Create the campaign
        const campaign = yield __1.prismaDB.campaign.create({
            data: {
                restaurantId,
                programId,
                name,
                description,
                campaignType,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                isActive,
                targetAudience,
                reward,
            },
        });
        return res.status(201).json({
            success: true,
            message: "Campaign created successfully",
            data: campaign,
        });
    }
    catch (error) {
        console.error("Error creating campaign:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create campaign",
        });
    }
});
exports.createCampaign = createCampaign;
// Get campaigns
const getCampaigns = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { restaurantId } = req.params;
        const { programId, isActive } = req.query;
        let whereClause = {
            restaurantId,
        };
        if (programId) {
            whereClause.programId = programId;
        }
        if (isActive !== undefined) {
            whereClause.isActive = isActive === "true";
        }
        const campaigns = yield __1.prismaDB.campaign.findMany({
            where: whereClause,
            orderBy: {
                startDate: "desc",
            },
        });
        return res.status(200).json({
            success: true,
            data: campaigns,
        });
    }
    catch (error) {
        console.error("Error fetching campaigns:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch campaigns",
        });
    }
});
exports.getCampaigns = getCampaigns;
