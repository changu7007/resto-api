import { differenceInDays } from "date-fns";
import { prismaDB } from "..";
import { getDaysRemaining } from "./utils";
import { NotFoundException } from "../exceptions/not-found";
import { ErrorCode } from "../exceptions/root";
import { redis } from "../services/redis";
import { Payroll, CheckInRecord, UserRole } from "@prisma/client";
import { UnauthorizedException } from "../exceptions/unauthorized";

export const getOwnerUserByEmail = async (email: string) => {
  const user = await prismaDB.user.findFirst({
    where: {
      email: email,
    },
    include: { restaurant: true, billings: true },
  });

  return user;
};

export const getStaffById = async (outletId: string, id: string) => {
  const staff = await prismaDB.staff.findFirst({
    where: {
      id: id,
      restaurantId: outletId,
    },
  });

  return staff;
};

export const getOwnerById = async (adminId: string) => {
  const user = await prismaDB.user.findFirst({
    where: {
      id: adminId,
    },
  });

  return user;
};

export const getFormatUserAndSendToRedis = async (userId: string) => {
  const findOwner = await prismaDB.user.findFirst({
    where: {
      id: userId,
    },
    include: {
      restaurant: {
        include: {
          users: true,
        },
      },
      restaurants: {
        include: {
          restaurant: {
            include: {
              users: {
                include: {
                  billings: {
                    orderBy: {
                      createdAt: "desc",
                    },
                  },
                },
              },
            },
          },
        },
      },
      billings: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!findOwner?.id) {
    throw new NotFoundException("User not found", ErrorCode.UNAUTHORIZED);
  }

  // Helper function to calculate subscription status
  const calculateSubscriptionStatus = (billings: any[]) => {
    const latestBilling = billings[0];
    if (!latestBilling)
      return { isSubscribed: false, renewalDay: 0, plan: null };

    const renewalDay = getDaysRemaining(latestBilling.validDate as Date);
    return {
      isSubscribed: renewalDay > 0,
      renewalDay,
      plan: latestBilling.subscriptionPlan,
      billing: latestBilling,
    };
  };

  // Handle owned restaurants (where user is admin)
  const ownedRestaurants = findOwner.restaurant.map((outlet) => {
    // For owned restaurants, use the owner's own subscription
    const ownerSubscription = calculateSubscriptionStatus(findOwner.billings);
    return {
      id: outlet.id,
      name: outlet.name,
      image: outlet.imageUrl,
      isOwner: true,
      role: "ADMIN",
      accessType: "FULL_ACCESS",
      permissions: ["FULL_ACCESS"],
      subscriptionStatus: ownerSubscription,
    };
  });

  // Handle restaurants where user has access (not owner)
  const accessibleRestaurants = findOwner.restaurants.map((access) => {
    // Get the restaurant owner's subscription details
    const restaurantOwner = access.restaurant.users; // First user is the admin/owner
    const ownerSubscription = restaurantOwner
      ? calculateSubscriptionStatus(restaurantOwner.billings)
      : { isSubscribed: false, renewalDay: 0, plan: null };

    return {
      id: access.restaurant.id,
      name: access.restaurant.name,
      image: access.restaurant.imageUrl,
      isOwner: false,
      role: access.role,
      accessType: access.accessType,
      permissions: access.permissions || [],
      subscriptionStatus: ownerSubscription,
    };
  });

  // Merge restaurants, removing duplicates
  const allRestaurants = [
    ...ownedRestaurants,
    ...accessibleRestaurants.filter(
      (accessible) =>
        !ownedRestaurants.some((owned) => owned.id === accessible.id)
    ),
  ];

  // For the user's primary subscription status:
  // If they own any restaurants, use their own subscription
  // If they only have access to restaurants, use the first valid subscription from any restaurant they have access to
  const userSubscription =
    findOwner.billings.length > 0
      ? calculateSubscriptionStatus(findOwner.billings)
      : allRestaurants.reduce(
          (validSub, restaurant) => {
            if (validSub.isSubscribed) return validSub;
            return restaurant.subscriptionStatus;
          },
          { isSubscribed: false, renewalDay: 0, plan: null }
        );

  const formatToSend = {
    id: findOwner?.id,
    name: findOwner?.name,
    email: findOwner?.email,
    emailVerified: findOwner?.emailVerified,
    phoneNo: findOwner?.phoneNo,
    image: findOwner?.image,
    role: findOwner?.role,
    onboardingStatus: findOwner?.onboardingStatus,
    isSubscribed: userSubscription.isSubscribed,
    favItems: findOwner?.favItems,
    isTwoFA: findOwner?.isTwoFactorEnabled,
    subscriptions: findOwner.billings.map((billing) => ({
      id: billing.id,
      planName: billing.subscriptionPlan,
      paymentId: billing.paymentId,
      startDate: billing.subscribedDate,
      validDate: billing.validDate,
      amount: billing.paidAmount,
      validityDays: differenceInDays(
        new Date(billing?.validDate),
        new Date(billing?.subscribedDate)
      ),
      purchased: billing.paymentId ? "PURCHASED" : "NOT PURCHASED",
      status:
        getDaysRemaining(billing.validDate as Date) <= 0 ? "EXPIRED" : "VALID",
    })),
    toRenewal: userSubscription.renewalDay,
    plan: userSubscription.plan,
    outlets: allRestaurants.map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name,
      image: restaurant.image,
      role: restaurant.role,
      isOwner: restaurant.isOwner,
      accessType: restaurant.accessType,
      permissions: restaurant.permissions,
      subscription: {
        isValid: restaurant.subscriptionStatus.isSubscribed,
        renewalDays: restaurant.subscriptionStatus.renewalDay,
        plan: restaurant.subscriptionStatus.plan,
      },
    })),
  };

  await redis.set(userId, JSON.stringify(formatToSend), "EX", 3 * 60 * 60); // 3 hours

  return formatToSend;
};

export type FStaff = {
  id: string;
  name: string;
  email: string;
  emailVerified: Date | null;
  phoneNo: string | null;
  role: UserRole;
  image: string | null;
  isSubscribed: boolean;
  expiryDate: Date | null;
  checkIns: CheckInRecord | null;
  payroll: Payroll[];
  toRenewal: number | null;
  plan: "FREETRIAL" | "STARTER" | "PREMIUM" | "PRO" | "ENTERPRISE";
  restaurant: {
    id: string;
    name: string;
    image: string;
    adminId: string;
    address: string;
    phoneNo: string;
    email: string;
    outletType: string;
    restaurantName: string;
  };
};

export const getFormatStaffAndSendToRedis = async (staffId: string) => {
  const findStaff = await prismaDB.staff.findFirst({
    where: {
      id: staffId,
    },
    include: {
      restaurant: true,
      payroll: true,
      checkIns: {
        orderBy: {
          checkInTime: "desc",
        },
        take: 1,
      },
    },
  });

  if (!findStaff?.id) {
    throw new NotFoundException("Staff not found", ErrorCode.UNAUTHORIZED);
  }

  const getOutlet = await prismaDB.restaurant.findFirst({
    where: {
      id: findStaff?.restaurantId,
    },
  });

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const findOwner = await prismaDB.user.findFirst({
    where: {
      id: getOutlet?.adminId,
    },
    include: {
      restaurant: true,
      billings: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!findOwner?.id) {
    throw new NotFoundException(
      "Restaurant Owner not found",
      ErrorCode.OUTLET_NOT_FOUND
    );
  }

  const findSubscription = findOwner?.billings.find(
    (billing) => billing?.userId === findOwner.id
  );

  const renewalDay =
    findSubscription?.userId === findOwner.id
      ? getDaysRemaining(findSubscription.validDate as Date)
      : 0;

  const formatToSend = {
    id: findStaff?.id,
    name: findStaff?.name,
    email: findStaff?.email,
    emailVerified: findStaff?.emailVerified,
    phoneNo: findStaff?.phoneNo,
    image: findStaff?.image,
    role: findStaff?.role,
    // onboardingStatus: findStaff?.onboardingStatus,
    isSubscribed: renewalDay > 0 ? true : false,
    // isTwoFA: findStaff?.isTwoFactorEnabled,
    toRenewal: renewalDay,
    expiryDate: findSubscription?.validDate,
    plan: findSubscription?.subscriptionPlan,
    checkIns: findStaff?.checkIns[0],
    payroll: findStaff?.payroll,
    restaurant: {
      id: getOutlet?.id,
      name: getOutlet?.name,
      image: getOutlet?.imageUrl,
      adminId: getOutlet?.adminId,
      address: getOutlet?.address,
      phoneNo: getOutlet?.phoneNo,
      email: getOutlet?.email,
      outletType: getOutlet?.outletType,
      restaurantName: getOutlet?.restaurantName,
    },
  };

  await redis.set(
    findStaff?.id,
    JSON.stringify(formatToSend),
    "EX",
    3 * 60 * 60
  );
  return formatToSend;
};

export interface Transaction {
  id: string;
  type: "CASH_IN" | "CASH_OUT";
  amount: number;
  description: string;
  paymentMethod: string;
  referenceId?: string;
  performedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormattedPOSStaff {
  id: string;
  name: string;
  email: string;
  emailVerified: Date | null;
  phoneNo: string | null;
  image: string | null;
  role: UserRole;
  isSubscribed: boolean;
  toRenewal: number;
  expiryDate: Date | null;
  plan: "FREETRIAL" | "STARTER" | "PREMIUM" | "PRO" | "ENTERPRISE";
  checkIns: CheckInRecord | null;
  payroll: Payroll[];
  posStatus: {
    currentRegisterId: string | null;
    hasActiveSession: boolean;
    isRestaurantRegisterOpen: boolean;
    currentOperator: string | null;
    lastTransaction: Transaction | null;
    sessionStarted: Date | null;
    openingBalance: number;
    currentBalance: number;
    canAccessPOS: boolean;
    requiresCheckin: boolean;
    requiresRegister: boolean;
    isBlocked: boolean;
    blockReason: string | null;
  };
  restaurant: {
    id: string;
    name: string;
    image: string;
    adminId: string;
    address: string;
    phoneNo: string;
    email: string;
    outletType: string;
    restaurantName: string;
  };
}

export const getFormatStaffPOSAndSendToRedis = async (staffId: string) => {
  const findStaff = await prismaDB.staff.findFirst({
    where: {
      id: staffId,
    },
    include: {
      restaurant: true,
      cashRegisters: {
        where: {
          status: "OPEN",
          openedBy: staffId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        include: {
          transactions: {
            orderBy: {
              createdAt: "desc",
            },
            take: 5, // Get last 5 transactions
          },
        },
      },
      payroll: true,
      checkIns: {
        orderBy: {
          checkInTime: "desc",
        },
        take: 1,
      },
    },
  });

  if (!findStaff?.id) {
    throw new NotFoundException("Staff not found", ErrorCode.UNAUTHORIZED);
  }

  if (!findStaff?.posAccess) {
    throw new UnauthorizedException(
      "Staff not authorized for POS access",
      ErrorCode.UNAUTHORIZED
    );
  }

  // Get active cash register for the restaurant
  const activeRegister = await prismaDB.cashRegister.findFirst({
    where: {
      staff: {
        id: findStaff.id,
      },
      restaurantId: findStaff.restaurantId,
      status: "OPEN",
    },
    include: {
      staff: true,
    },
  });

  const getOutlet = await prismaDB.restaurant.findFirst({
    where: {
      id: findStaff?.restaurantId,
    },
  });

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Subscription checks
  const findOwner = await prismaDB.user.findFirst({
    where: {
      id: getOutlet?.adminId,
    },
    include: {
      restaurant: true,
      billings: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!findOwner?.id) {
    throw new NotFoundException(
      "Restaurant Owner not found",
      ErrorCode.OUTLET_NOT_FOUND
    );
  }

  const findSubscription = findOwner?.billings.find(
    (billing) => billing?.userId === findOwner.id
  );

  const renewalDay =
    findSubscription?.userId === findOwner.id
      ? getDaysRemaining(findSubscription.validDate as Date)
      : 0;

  // Calculate cash register status and permissions
  const activeSession = findStaff.cashRegisters[0];
  const isCheckedIn = findStaff.checkIns[0]?.checkOutTime === null;

  const registerStatus = {
    currentRegisterId: activeSession?.id || null,
    hasActiveSession: !!activeSession,
    isRestaurantRegisterOpen: !!activeRegister,
    currentOperator: activeRegister?.staff?.name || null,
    lastTransaction: activeSession?.transactions[0] || null,
    sessionStarted: activeSession?.openedAt || null,
    openingBalance: activeSession?.openingBalance || 0,
    currentBalance: activeSession ? calculateCurrentBalance(activeSession) : 0,
  };

  const posAccess = {
    canAccessPOS: findStaff.posAccess,
    requiresCheckin: !isCheckedIn,
    requiresRegister: !activeSession && findStaff.posAccess,
    isBlocked: !isCheckedIn || !findStaff.posAccess || renewalDay <= 0,
    blockReason: getBlockReason({
      isCheckedIn,
      posAccess: findStaff.posAccess,
      hasValidSubscription: renewalDay > 0,
      hasActiveRegister: !!activeSession,
    }),
  };

  const formatToSend = {
    id: findStaff?.id,
    name: findStaff?.name,
    email: findStaff?.email,
    emailVerified: findStaff?.emailVerified,
    phoneNo: findStaff?.phoneNo,
    image: findStaff?.image,
    role: findStaff?.role,
    favItems: findStaff?.favoriteMenu,
    isSubscribed: renewalDay > 0 ? true : false,
    toRenewal: renewalDay,
    expiryDate: findSubscription?.validDate,
    plan: findSubscription?.subscriptionPlan,
    checkIns: findStaff?.checkIns[0],
    payroll: findStaff?.payroll,
    posStatus: {
      ...registerStatus,
      ...posAccess,
    },
    restaurant: {
      id: getOutlet?.id,
      name: getOutlet?.name,
      image: getOutlet?.imageUrl,
      adminId: getOutlet?.adminId,
      address: getOutlet?.address,
      phoneNo: getOutlet?.phoneNo,
      email: getOutlet?.email,
      outletType: getOutlet?.outletType,
      restaurantName: getOutlet?.restaurantName,
    },
  };

  await redis.set(
    `pos-${findStaff?.id}`,
    JSON.stringify(formatToSend),
    "EX",
    3 * 60 * 60
  ); // 3 hours
  return formatToSend;
};

// Helper functions
function calculateCurrentBalance(register: any) {
  const openingBalance = register.openingBalance || 0;
  const transactions = register.transactions || [];

  return transactions.reduce((balance: number, transaction: any) => {
    return transaction.type === "CASH_IN"
      ? balance + transaction.amount
      : balance - transaction.amount;
  }, 0);
}

function getBlockReason({
  isCheckedIn,
  posAccess,
  hasValidSubscription,
  hasActiveRegister,
}: {
  isCheckedIn: boolean;
  posAccess: boolean;
  hasValidSubscription: boolean;
  hasActiveRegister: boolean;
}): string | null {
  if (!isCheckedIn) return "Staff must check-in first";
  if (!posAccess) return "No POS access permission";
  if (!hasValidSubscription) return "Subscription expired";
  if (!hasActiveRegister) return "Cash register not opened";
  return null;
}

export const getCustomerById = async (id: string, outletId: string) => {
  const customer = await prismaDB.customerRestaurantAccess.findFirst({
    where: {
      customerId: id,
      restaurantId: outletId,
    },
    include: {
      orderSession: {
        include: {
          orders: {
            include: {
              orderItems: {
                include: {
                  menuItem: true,
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      },
    },
  });

  return customer;
};
