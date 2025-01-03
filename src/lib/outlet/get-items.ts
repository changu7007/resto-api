import { prismaDB } from "../..";
import { redis } from "../../services/redis";

export const getOAllItems = async (outletId: string) => {
  const getItems = await prismaDB.menuItem.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      category: true,
      images: true,
      menuItemVariants: {
        include: {
          variant: true,
        },
      },
      menuGroupAddOns: {
        include: {
          addOnGroups: {
            include: {
              addOnVariants: true,
            },
          },
        },
      },
      itemRecipe: {
        include: {
          menuItem: true,
          menuItemVariant: true,
          addOnItemVariant: true,
        },
      },
    },
  });

  if (getItems?.length > 0) {
    await redis.set(`${outletId}-all-items`, JSON.stringify(getItems));
  } else {
    await redis.del(`${outletId}-all-items`);
  }
  return getItems;
};

export const getOAllCategories = async (outletId: string) => {};

export const getFetchAllNotificationToRedis = async (outletId: string) => {
  const notifications = await prismaDB.notification.findMany({
    where: {
      restaurantId: outletId,
      status: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (notifications?.length > 0) {
    await redis.set(`o-n-${outletId}`, JSON.stringify(notifications));
  } else {
    await redis.del(`o-n-${outletId}`);
  }
  return notifications;
};
