import { differenceInDays } from "date-fns";
import { prismaDB } from "..";
import { getDaysRemaining } from "./utils";
import { NotFoundException } from "../exceptions/not-found";
import { ErrorCode } from "../exceptions/root";
import { redis } from "../services/redis";

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
    outlets: findOwner?.restaurant.map((outlet) => ({
      id: outlet.id,
      name: outlet.name,
      image: outlet.imageUrl,
    })),
  };

  await redis.set(userId, JSON.stringify(formatToSend));

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
