import { Request, Response } from "express";
import { z } from "zod";
import { prismaDB } from "../../..";
import { LoyaltyProgramType, TierType, TransactionType } from "@prisma/client";
import { generateSlug } from "../../../lib/utils";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { ErrorCode } from "../../../exceptions/root";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";

// Validation schema for loyalty program
const loyaltyProgramSchema = z
  .object({
    pogramName: z.string().min(1, "Program name is required"),
    loyaltyProgramType: z.nativeEnum(LoyaltyProgramType),
    programDescription: z.string().min(1, "Description is required"),
    status: z.boolean(),
    expiryDays: z.number().min(1, "Expiry days must be at least 1"),
    pointsRatio: z.number().nullable().optional(),
    minimumPointsToRedemption: z.number().nullable().optional(),
    visitRequiredForReward: z.number().nullable().optional(),
    visitCompletedReward: z.string().nullable().optional(),
    menuId: z.string().nullable().optional(),
    referrerReward: z.number().nullable().optional(),
    refereeReward: z.number().nullable().optional(),
    loginPoints: z.number().nullable().optional(),
    cashBackPercentage: z.number().nullable().optional(),
    minSpendForCashback: z.number().nullable().optional(),
    tiers: z
      .array(
        z.object({
          name: z.string(),
          threshold: z.number(),
          benefits: z.string(),
          color: z.string().optional(),
        })
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.loyaltyProgramType === LoyaltyProgramType.LOGIN_BASED) {
        return data.loginPoints != null && data.loginPoints > 0;
      }
      return true;
    },
    {
      message: "Login points are required for login-based programs",
      path: ["loginPoints"],
    }
  )
  .refine(
    (data) => {
      if (data.loyaltyProgramType === LoyaltyProgramType.POINT_BASED) {
        return (
          data.pointsRatio != null &&
          data.pointsRatio > 0 &&
          data.minimumPointsToRedemption != null &&
          data.minimumPointsToRedemption > 0
        );
      }
      return true;
    },
    {
      message:
        "Points ratio and minimum redemption are required for points-based programs",
      path: ["pointsRatio"],
    }
  )
  .refine(
    (data) => {
      if (data.loyaltyProgramType === LoyaltyProgramType.VISIT_BASED) {
        return (
          data.visitRequiredForReward != null &&
          data.visitRequiredForReward > 0 &&
          data.visitCompletedReward != null &&
          data.menuId != null
        );
      }
      return true;
    },
    {
      message:
        "Visit requirements and reward are required for visit-based programs",
      path: ["visitRequiredForReward"],
    }
  )
  .refine(
    (data) => {
      if (data.loyaltyProgramType === LoyaltyProgramType.SPEND_BASED_TIERS) {
        return (
          data.tiers != null &&
          data.tiers.length === 3 &&
          data.tiers.some((tier) => tier.name === "SILVER") &&
          data.tiers.some((tier) => tier.name === "GOLD") &&
          data.tiers.some((tier) => tier.name === "PLATINUM") &&
          data.tiers.every((tier) => tier.threshold > 0) &&
          data.tiers.every((tier) => tier.benefits.length > 0)
        );
      }
      return true;
    },
    {
      message:
        "Tier-based programs require exactly 3 tiers (Silver, Gold, Platinum) with thresholds and benefits",
      path: ["tiers"],
    }
  )
  .refine(
    (data) => {
      if (data.loyaltyProgramType === LoyaltyProgramType.REFERAL_BASED) {
        return (
          data.referrerReward != null &&
          data.referrerReward > 0 &&
          data.refereeReward != null &&
          data.refereeReward > 0
        );
      }
      return true;
    },
    {
      message:
        "Referrer and referee rewards are required for referral-based programs",
      path: ["referrerReward"],
    }
  )
  .refine(
    (data) => {
      if (
        data.loyaltyProgramType === LoyaltyProgramType.CASHBACK_WALLET_BASED
      ) {
        return (
          data.cashBackPercentage != null &&
          data.cashBackPercentage > 0 &&
          data.minSpendForCashback != null &&
          data.minSpendForCashback > 0
        );
      }
      return true;
    },
    {
      message:
        "Cashback percentage and minimum spend are required for cashback programs",
      path: ["cashBackPercentage"],
    }
  );

// Get loyalty overview data
export const getLoyaltyOverview = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;

    // Get total members
    const totalMembers = await prismaDB.customerLoyalty.count({
      where: {
        loyaltyProgram: {
          restaurantId,
        },
      },
    });

    // Get active programs
    const activePrograms = await prismaDB.loyaltyProgram.count({
      where: {
        restaurantId,
        status: true,
      },
    });

    // Get points redeemed (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const pointsRedeemed = await prismaDB.loyaltyTransaction.aggregate({
      where: {
        restaurantId,
        type: TransactionType.POINTS_REDEEMED,
        transactionDate: {
          gte: thirtyDaysAgo,
        },
      },
      _sum: {
        points: true,
      },
    });

    // Get retention rate (customers who visited in last 30 days / total customers)
    const customersWithRecentVisits = await prismaDB.customerLoyalty.count({
      where: {
        loyaltyProgram: {
          restaurantId,
        },
        lastVisitDate: {
          gte: thirtyDaysAgo,
        },
      },
    });

    const retentionRate =
      totalMembers > 0
        ? Math.round((customersWithRecentVisits / totalMembers) * 100)
        : 0;

    // Get program performance data
    const programPerformance = await prismaDB.loyaltyProgram.findMany({
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
      const totalPoints = program.customerLoyalty.reduce(
        (sum, customer) => sum + customer.points,
        0
      );
      const totalVisits = program.customerLoyalty.reduce(
        (sum, customer) => sum + customer.visits,
        0
      );
      const totalWalletBalance = program.customerLoyalty.reduce(
        (sum, customer) => sum + customer.walletBalance,
        0
      );

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
    const recentActivity = await prismaDB.loyaltyTransaction.findMany({
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
        case TransactionType.POINTS_EARNED:
          description = `${customerName} earned ${activity.points} points`;
          break;
        case TransactionType.POINTS_REDEEMED:
          description = `${customerName} redeemed ${activity.points} points`;
          break;
        case TransactionType.VISIT_RECORDED:
          description = `${customerName} recorded a visit`;
          break;
        case TransactionType.TIER_UPGRADE:
          description = `${customerName} upgraded to a higher tier`;
          break;
        case TransactionType.REFERRAL_BONUS:
          description = `${customerName} received a referral bonus`;
          break;
        case TransactionType.CASHBACK_EARNED:
          description = `${customerName} earned ${activity.amount} cashback`;
          break;
        case TransactionType.CASHBACK_REDEEMED:
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
    const upcomingCampaigns = await prismaDB.campaign.findMany({
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
      const daysUntilStart = Math.ceil(
        (campaign.startDate.getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );

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
  } catch (error) {
    console.error("Error fetching loyalty overview:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch loyalty overview data",
    });
  }
};

// Get loyalty programs
export const getLoyaltyPrograms = async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { type } = req.query;

  let whereClause: any = {
    restaurantId,
  };

  if (type) {
    whereClause.loyaltyProgramType = type;
  }

  const programs = await prismaDB.loyaltyProgram.findMany({
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
      menuId: program?.menuId,
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
};

// Get loyalty customers
export const getLoyaltyCustomers = async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const { programId, tier, search, page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  let whereClause: any = {
    restaurantId,
  };

  if (search) {
    whereClause.customer = {
      OR: [
        { name: { contains: search as string, mode: "insensitive" } },
        { email: { contains: search as string, mode: "insensitive" } },
        { phoneNo: { contains: search as string, mode: "insensitive" } },
      ],
    };
  }

  // Get all customers with restaurant access and loyalty program
  const restaurantAccesses = await prismaDB.customerRestaurantAccess.findMany({
    where: whereClause,
    skip,
    take: Number(limit),
    orderBy: {
      createdAt: "desc",
    },
    include: {
      customer: true,
      loyaltyPrograms: {
        where: programId ? { loyaltyProgramId: programId as string } : {},
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

  const totalCustomers = await prismaDB.customerRestaurantAccess.count({
    where: whereClause,
  });

  // Format customers data
  const formattedCustomers = restaurantAccesses.map((access) => {
    const loyaltyData = access.loyaltyPrograms[0];
    const programData = loyaltyData?.loyaltyProgram;
    const tierData = loyaltyData?.currentTier;

    return {
      id: access.id,
      customerRestaurantId: access.id,
      customerId: access.customerId,
      name: access.customer?.name || "",
      email: access.customer?.email || "",
      phone: access.customer?.phoneNo || "",
      dateOfBirth: access.customer?.dob,
      enrollmentDate: loyaltyData?.enrollmentDate,
      points: loyaltyData?.points || 0,
      visits: loyaltyData?.visits || 0,
      walletBalance: loyaltyData?.walletBalance || 0,
      lifeTimePoints: loyaltyData?.lifeTimePoints || 0,
      lifeTimeSpend: loyaltyData?.lifeTimeSpend || 0,
      lastVisitDate: loyaltyData?.lastVisitDate,
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
};

// Create a new loyalty program
export const createLoyaltyProgram = async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  const programData = req.body;

  // Validate the request data
  const validationResult = loyaltyProgramSchema.safeParse(programData);

  if (!validationResult.success) {
    throw new BadRequestsException(
      validationResult?.error?.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const getOutlet = getOutletById(restaurantId);

  if (!getOutlet) {
    throw new NotFoundException(
      "Restaurant Not Found",
      ErrorCode.OUTLET_NOT_FOUND
    );
  }

  const validatedData = validationResult.data;

  // Create the program
  const program = await prismaDB.loyaltyProgram.create({
    data: {
      restaurantId: restaurantId,
      pogramName: validatedData.pogramName,
      slug: generateSlug(validatedData.pogramName),
      loyaltyProgramType: validatedData.loyaltyProgramType,
      programDescription: validatedData.programDescription,
      status: validatedData.status,
      expiryDays: validatedData.expiryDays,
      pointsRatio:
        validatedData.pointsRatio !== undefined
          ? validatedData.pointsRatio
          : null,
      minimumPointsToRedemption:
        validatedData.minimumPointsToRedemption !== undefined
          ? validatedData.minimumPointsToRedemption
          : null,
      visitRequiredForReward:
        validatedData.visitRequiredForReward !== undefined
          ? validatedData.visitRequiredForReward
          : null,
      visitCompletedReward:
        validatedData.loyaltyProgramType === "VISIT_BASED"
          ? validatedData?.visitCompletedReward
          : "FREE REWARD",
      referrerReward:
        validatedData.referrerReward !== undefined
          ? validatedData.referrerReward
          : null,
      refereeReward:
        validatedData.refereeReward !== undefined
          ? validatedData.refereeReward
          : null,
      loginPoints:
        validatedData.loginPoints !== undefined
          ? validatedData.loginPoints
          : null,
      cashBackPercentage:
        validatedData.cashBackPercentage !== undefined
          ? validatedData.cashBackPercentage
          : null,
      minSpendForCashback:
        validatedData.minSpendForCashback !== undefined
          ? validatedData.minSpendForCashback
          : null,
      menuId:
        validatedData?.menuId !== undefined ? validatedData?.menuId : null,
    },
  });

  // Create tiers if provided
  if (validatedData.tiers && validatedData.tiers.length > 0) {
    await Promise.all(
      validatedData.tiers.map((tier) =>
        prismaDB.tier.create({
          data: {
            name: tier.name as TierType,
            threshold: tier.threshold,
            benefits: tier.benefits,
            color: tier.color || "#000000",
            programId: program.id,
          },
        })
      )
    );
  }

  return res.json({
    success: true,
    message: "Loyalty program created successfully",
    data: program,
  });
};

// Update a loyalty program
export const updateLoyaltyProgram = async (req: Request, res: Response) => {
  const { restaurantId, programId } = req.params;
  const programData = req.body.programData?.data;

  // Validate the request data
  const { data, error } = loyaltyProgramSchema.safeParse(programData);

  if (error) {
    throw new BadRequestsException(
      error?.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const validatedData = data;
  const getOutlet = getOutletById(restaurantId);

  if (!getOutlet) {
    throw new NotFoundException(
      "Restaurant Not Found",
      ErrorCode.OUTLET_NOT_FOUND
    );
  }

  const findLoyaltyProgram = await prismaDB.loyaltyProgram.findFirst({
    where: {
      id: programId,
      restaurantId: restaurantId,
    },
  });

  if (!findLoyaltyProgram) {
    throw new NotFoundException(
      "Loyalty Program Not Found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Update the program
  const program = await prismaDB.loyaltyProgram.update({
    where: {
      id: findLoyaltyProgram?.id,
      restaurantId,
    },
    data: {
      pogramName: validatedData.pogramName,
      loyaltyProgramType: validatedData.loyaltyProgramType,
      programDescription: validatedData.programDescription,
      status: validatedData.status,
      expiryDays: validatedData.expiryDays,
      pointsRatio:
        validatedData.pointsRatio !== undefined
          ? validatedData.pointsRatio
          : null,
      minimumPointsToRedemption:
        validatedData.minimumPointsToRedemption !== undefined
          ? validatedData.minimumPointsToRedemption
          : null,
      visitRequiredForReward:
        validatedData.visitRequiredForReward !== undefined
          ? validatedData.visitRequiredForReward
          : null,
      visitCompletedReward:
        validatedData.loyaltyProgramType === "VISIT_BASED"
          ? validatedData?.visitCompletedReward
          : "FREE REWARD",
      referrerReward:
        validatedData.referrerReward !== undefined
          ? validatedData.referrerReward
          : null,
      refereeReward:
        validatedData.refereeReward !== undefined
          ? validatedData.refereeReward
          : null,
      loginPoints:
        validatedData.loginPoints !== undefined
          ? validatedData.loginPoints
          : null,
      cashBackPercentage:
        validatedData.cashBackPercentage !== undefined
          ? validatedData.cashBackPercentage
          : null,
      minSpendForCashback:
        validatedData.minSpendForCashback !== undefined
          ? validatedData.minSpendForCashback
          : null,
      menuId:
        validatedData?.menuId !== undefined ? validatedData?.menuId : null,
    },
  });

  // Update tiers if provided
  if (validatedData.tiers && validatedData.tiers.length > 0) {
    // Delete existing tiers
    await prismaDB.tier.deleteMany({
      where: {
        programId,
      },
    });

    // Create new tiers
    await Promise.all(
      validatedData.tiers.map((tier) =>
        prismaDB.tier.create({
          data: {
            name: tier.name as TierType,
            threshold: tier.threshold,
            benefits: tier.benefits,
            color: tier.color || "#000000",
            programId: program.id,
          },
        })
      )
    );
  }

  return res.json({
    success: true,
    message: "Loyalty program updated successfully",
    data: program,
  });
};

// Delete a loyalty program
export const deleteLoyaltyProgram = async (req: Request, res: Response) => {
  try {
    const { restaurantId, programId } = req.params;

    // Delete the loyalty program
    await prismaDB.loyaltyProgram.delete({
      where: {
        id: programId,
        restaurantId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Loyalty program deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting loyalty program:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete loyalty program",
    });
  }
};

// Add a customer to a loyalty program
export const addCustomerToLoyaltyProgram = async (
  req: Request,
  res: Response
) => {
  try {
    const { restaurantId } = req.params;
    const {
      customerId,
      programId,
      points = 0,
      visits = 0,
      walletBalance = 0,
    } = req.body;

    // Check if customer exists in the restaurant
    const customerAccess = await prismaDB.customerRestaurantAccess.findFirst({
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
    const existingEnrollment = await prismaDB.customerLoyalty.findFirst({
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
    const enrollment = await prismaDB.customerLoyalty.create({
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
  } catch (error) {
    console.error("Error adding customer to loyalty program:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add customer to loyalty program",
    });
  }
};
const customerAwardForm = z.object({
  customerId: z.string({ required_error: "Customer is required" }),
  loyaltyProgramId: z.string({ required_error: "Loyalty Program is required" }),
  points: z.number({ required_error: "Points is required" }),
  reason: z.string({ required_error: "Reason is required" }),
  notes: z.string().optional(),
});
// Award points to a customer
export const awardPointsToCustomer = async (req: Request, res: Response) => {
  const { restaurantId } = req.params;
  // Validate the request data
  const validationResult = customerAwardForm.safeParse(req.body);

  if (!validationResult.success) {
    throw new BadRequestsException(
      validationResult?.error?.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  const { customerId, loyaltyProgramId, points } = validationResult.data;

  // Check if customer is enrolled in the program
  const customerLoyalty = await prismaDB.customerLoyalty.findFirst({
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
  const transaction = await prismaDB.loyaltyTransaction.create({
    data: {
      restaurantId,
      restaurantCustomerId: customerLoyalty.restaurantCustomerId,
      programId: loyaltyProgramId,
      type: TransactionType.POINTS_EARNED,
      points,
    },
  });

  // Update customer's points
  await prismaDB.customerLoyalty.update({
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
};

// Create a campaign
export const createCampaign = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const {
      name,
      description,
      campaignType,
      startDate,
      endDate,
      isActive,
      targetAudience,
      reward,
      programId,
    } = req.body;

    // Create the campaign
    const campaign = await prismaDB.campaign.create({
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
  } catch (error) {
    console.error("Error creating campaign:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create campaign",
    });
  }
};

// Get campaigns
export const getCampaigns = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const { programId, isActive } = req.query;

    let whereClause: any = {
      restaurantId,
    };

    if (programId) {
      whereClause.programId = programId;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive === "true";
    }

    const campaigns = await prismaDB.campaign.findMany({
      where: whereClause,
      orderBy: {
        startDate: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaigns",
    });
  }
};
