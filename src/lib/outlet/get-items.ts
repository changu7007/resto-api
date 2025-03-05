import { prismaDB } from "../..";
import { redis } from "../../services/redis";

export const getOAllMenuCategoriesToRedis = async (outletId: string) => {
  const getCategories = await prismaDB.category.findMany({
    where: {
      restaurantId: outletId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      menuItems: {
        include: {
          _count: true,
        },
      },
    },
  });

  const formattedCategories = getCategories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    menuItems: category?.menuItems?.length,
  }));

  await redis.set(
    `o-${outletId}-categories`,
    JSON.stringify(formattedCategories)
  );
  return getCategories;
};

export const getOAllItemsForOnlineAndDelivery = async (outletId: string) => {
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

  const formattedItems = getItems
    ?.filter((i) => i.isDelivery === true || i.isOnline === true)
    ?.map((menuItem: any) => ({
      id: menuItem.id,
      shortCode: menuItem.shortCode,
      categoryId: menuItem.categoryId,
      categoryName: menuItem.category.name,
      name: menuItem.name,
      images: menuItem.images.map((image: any) => ({
        id: image.id,
        url: image.url,
      })),
      type: menuItem.type,
      price: menuItem.price,
      netPrice: menuItem?.netPrice,
      itemRecipe: {
        id: menuItem?.itemRecipe?.id,
        menuId: menuItem?.itemRecipe?.menuId,
        menuVariantId: menuItem?.itemRecipe?.menuVariantId,
        addonItemVariantId: menuItem?.itemRecipe?.addonItemVariantId,
      },
      gst: menuItem?.gst,
      grossProfit: menuItem?.grossProfit,
      isVariants: menuItem.isVariants,
      isAddOns: menuItem.isAddons,
      menuItemVariants: menuItem.menuItemVariants.map((variant: any) => ({
        id: variant.id,
        variantName: variant.variant.name,
        price: variant.price,
        netPrice: variant?.netPrice,
        gst: variant?.gst,
        grossProfit: variant?.grossProfit,
        type: variant.foodType,
      })),
      favourite: true,
      menuGroupAddOns: menuItem.menuGroupAddOns.map((addOns: any) => ({
        id: addOns.id,
        addOnGroupName: addOns.addOnGroups.title,
        description: addOns.addOnGroups.description,
        addonVariants: addOns.addOnGroups.addOnVariants.map(
          (addOnVariant: any) => ({
            id: addOnVariant.id,
            name: addOnVariant.name,
            price: addOnVariant.price,
            type: addOnVariant.type,
          })
        ),
      })),
    }));

  await redis.set(
    `${outletId}-all-items-online-and-delivery`,
    JSON.stringify(formattedItems)
  );

  return getItems;
};

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

  const formattedItems = getItems
    ?.filter((i: any) => i.isDineIn === true)
    ?.map((menuItem: any) => ({
      id: menuItem.id,
      shortCode: menuItem.shortCode,
      categoryId: menuItem.categoryId,
      categoryName: menuItem.category.name,
      name: menuItem.name,
      images: menuItem.images.map((image: any) => ({
        id: image.id,
        url: image.url,
      })),
      type: menuItem.type,
      price: menuItem.price,
      netPrice: menuItem?.netPrice,
      itemRecipe: {
        id: menuItem?.itemRecipe?.id,
        menuId: menuItem?.itemRecipe?.menuId,
        menuVariantId: menuItem?.itemRecipe?.menuVariantId,
        addonItemVariantId: menuItem?.itemRecipe?.addonItemVariantId,
      },
      gst: menuItem?.gst,
      grossProfit: menuItem?.grossProfit,
      isVariants: menuItem?.isVariants,
      isAddOns: menuItem?.isAddons,
      menuItemVariants: menuItem?.menuItemVariants?.map((variant: any) => ({
        id: variant?.id,
        variantName: variant?.variant?.name,
        price: variant?.price,
        netPrice: variant?.netPrice,
        gst: variant?.gst,
        grossProfit: variant?.grossProfit,
        type: variant?.foodType,
      })),
      favourite: true,
      menuGroupAddOns: menuItem?.menuGroupAddOns?.map((addOns: any) => ({
        id: addOns?.id,
        addOnGroupName: addOns?.addOnGroups?.title,
        description: addOns?.addOnGroups?.description,
        addonVariants: addOns?.addOnGroups?.addOnVariants?.map(
          (addOnVariant: any) => ({
            id: addOnVariant?.id,
            name: addOnVariant?.name,
            price: addOnVariant?.price,
            type: addOnVariant?.type,
          })
        ),
      })),
    }));

  await redis.set(
    `${outletId}-all-items`,
    JSON.stringify(formattedItems),
    "EX",
    300
  );

  return getItems;
};

export const getOAllCategories = async (outletId: string) => {};

export const getFetchAllNotificationToRedis = async (outletId: string) => {
  const notifications = await prismaDB.notification.findMany({
    take: 150,
    where: {
      restaurantId: outletId,
      status: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await redis.set(`o-n-${outletId}`, JSON.stringify(notifications));

  return notifications;
};
