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
    },
  });

  return await redis.set(`${outletId}-all-items`, JSON.stringify(getItems));
};

export const getOAllCategories = async (outletId: string) => {};
