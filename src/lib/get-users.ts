import { differenceInDays } from "date-fns";
import { prismaDB } from "..";
import { getDaysRemaining } from "./utils";
import { NotFoundException } from "../exceptions/not-found";
import { ErrorCode } from "../exceptions/root";
import { redis } from "../services/redis";
import { UserRole } from "@prisma/client";

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
      restaurant: true,
      restaurants: {
        include: {
          restaurant: true, // Fetch the restaurant details from the access relation
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

  // Combine owned and accessible restaurants
  const ownedRestaurants = findOwner.restaurant.map((outlet) => ({
    id: outlet.id,
    name: outlet.name,
    image: outlet.imageUrl,
  }));

  const accessibleRestaurants = findOwner.restaurants.map((access) => ({
    id: access.restaurant.id,
    name: access.restaurant.name,
    image: access.restaurant.imageUrl,
  }));

  // Merge owned and accessible restaurants, removing duplicates
  const allRestaurants = [
    ...ownedRestaurants,
    ...accessibleRestaurants.filter(
      (accessible) =>
        !ownedRestaurants.some((owned) => owned.id === accessible.id)
    ),
  ];

  const findSubscription = findOwner?.billings.find(
    (billing) => billing?.userId === findOwner.id
  );

  const renewalDay =
    findSubscription?.userId === findOwner.id
      ? getDaysRemaining(findSubscription.validDate as Date)
      : 0;

  const formatToSend = {
    id: findOwner?.id,
    name: findOwner?.name,
    email: findOwner?.email,
    emailVerified: findOwner?.emailVerified,
    phoneNo: findOwner?.phoneNo,
    image: findOwner?.image,
    role: findOwner?.role,
    onboardingStatus: findOwner?.onboardingStatus,
    isSubscribed: renewalDay > 0 ? true : false,
    favItems: findOwner?.favItems,
    isTwoFA: findOwner?.isTwoFactorEnabled,
    subscriptions: findOwner?.billings.map((billing) => ({
      id: billing.id,
      planName: billing.subscriptionPlan,
      paymentId: billing.paymentId,
      startDate: billing.subscribedDate,
      validDate: billing.validDate,
      amount: billing.paidAmount,
      validityDays: differenceInDays(
        new Date(billing.validDate),
        new Date(billing.subscribedDate)
      ),
      purchased: billing.paymentId ? "PURCHASED" : "NOT PURCHASED",
      status: renewalDay === 0 ? "EXPIRED" : "VALID",
    })),
    toRenewal: renewalDay,
    plan: findSubscription?.subscriptionPlan,
    outlets: allRestaurants,
  };

  await redis.set(userId, JSON.stringify(formatToSend));

  return formatToSend;
};

export type FStaff = {
  id: string;
  name: string;
  email: string;
  emailVerified: Date | null;
  phoneNo: string | null;
  role: UserRole;
  isSubscribed: boolean;
  toRenewal: number | null;
  plan: "FREETRIAL" | "STANDARD" | "PREMIUM" | "ENTERPRISE";
  restaurantId: string;
};

export const getFormatStaffAndSendToRedis = async (staffId: string) => {
  const findStaff = await prismaDB.staff.findFirst({
    where: {
      id: staffId,
    },
    include: {
      restaurant: true,
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
      billings: true,
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
    // image: findStaff?.image,
    role: findStaff?.role,
    // onboardingStatus: findStaff?.onboardingStatus,
    isSubscribed: renewalDay > 0 ? true : false,
    // isTwoFA: findStaff?.isTwoFactorEnabled,
    toRenewal: renewalDay,
    plan: findSubscription?.subscriptionPlan,
    restaurantId: findStaff?.restaurantId,
  };

  await redis.set(findStaff?.id, JSON.stringify(formatToSend));

  return formatToSend;
};

export const getCustomerById = async (id: string, outletId: string) => {
  const customer = await prismaDB.customer.findFirst({
    where: {
      id: id,
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
      },
    },
  });

  return customer;
};
