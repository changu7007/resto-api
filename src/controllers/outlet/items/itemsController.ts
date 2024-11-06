import { Request, Response } from "express";
import {
  getAddOnByOutletId,
  getCategoryByOutletId,
  getItemByOutletId,
  getOutletById,
  getVariantByOutletId,
} from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { FoodRole } from "@prisma/client";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { redis } from "../../../services/redis";
import { getOAllItems } from "../../../lib/outlet/get-items";

export const getAllItem = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const allItems = await redis.get(`${outletId}-all-items`);

  if (allItems) {
    return res.json({
      success: true,
      items: JSON.parse(allItems),
      message: "Fetched Items By Redis ✅",
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const items = await getOAllItems(outlet.id);

  return res.json({
    success: true,
    items: items,
    message: "Fetched Items by database ✅",
  });
};

export const getItemById = async (req: Request, res: Response) => {
  const { itemId, outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const menuItem = await getItemByOutletId(outlet.id, itemId);

  if (!menuItem?.id) {
    throw new NotFoundException("Item Not Found", ErrorCode.NOT_FOUND);
  }

  return res.json({
    success: true,
    item: menuItem,
    message: "Fetched Item Success ✅",
  });
};

export const getVariantById = async (req: Request, res: Response) => {
  const { variantId, outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const variant = await getVariantByOutletId(outlet.id, variantId);

  if (!variant?.id) {
    throw new NotFoundException("Variant Not Found", ErrorCode.NOT_FOUND);
  }

  return res.json({
    success: true,
    item: variant,
    message: "Fetched Variant Success ✅",
  });
};

export const getAddONById = async (req: Request, res: Response) => {
  const { addOnId, outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const addOn = await getAddOnByOutletId(outlet.id, addOnId);

  if (!addOn?.id) {
    throw new NotFoundException("Variant Not Found", ErrorCode.NOT_FOUND);
  }

  return res.json({
    success: true,
    item: addOn,
    message: "Fetched Variant Success ✅",
  });
};

export const updateItembyId = async (req: Request, res: Response) => {
  const { itemId, outletId } = req.params;

  const validFoodTypes = Object.values(FoodRole);

  const {
    name,
    shortCode,
    description,
    categoryId,
    isFeatured,
    isArchived,
    isVariants,
    isAddons,
    isDelivery,
    isPickUp,
    isDineIn,
    isOnline,
    type,
    price,
    menuItemVariants,
    menuGroupAddOns,
    images,
  } = req.body;

  if (!name) {
    throw new BadRequestsException(
      "Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (isVariants === false) {
    if (!price) {
      throw new BadRequestsException(
        "Price is Required",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  } else {
    if (!menuItemVariants || !menuItemVariants.length)
      throw new BadRequestsException(
        "Variants is Required if this food has Multiples",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
  }

  if (isAddons && !menuGroupAddOns.length) {
    throw new BadRequestsException(
      "If Add-Ons Selected, Assign required Group AddOn to it",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!description) {
    throw new BadRequestsException(
      "Description is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  if (!categoryId) {
    throw new BadRequestsException(
      "CategoryId is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  if (!validFoodTypes.includes(type)) {
    throw new BadRequestsException(
      "Meal Type is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!images || !images.length) {
    throw new BadRequestsException(
      "Images are Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const menuItem = await getItemByOutletId(outlet.id, itemId);

  if (!menuItem?.id) {
    throw new NotFoundException("Item Not Found", ErrorCode.NOT_FOUND);
  }
  const category = await getCategoryByOutletId(outlet.id, categoryId);

  if (!category?.id) {
    throw new NotFoundException(
      "Category Not Found",
      ErrorCode.OUTLET_NOT_FOUND
    );
  }

  let updateData = {
    name,
    shortCode,
    description,
    isFeatured,
    categoryId,
    isArchived,
    isVariants,
    isAddons,
    isDelivery,
    isPickUp,
    isDineIn,
    isOnline,
    type,
    price: isVariants ? "0" : price,
  };

  // Prepare updates for variants
  const variantUpdates = isVariants
    ? menuItemVariants.map((variant: any) => {
        console.log("Variant", variant);
        const existingVariant = menuItem.menuItemVariants.find(
          (ev) => ev.id === variant.id
        );
        if (existingVariant) {
          return prismaDB.menuItemVariant.update({
            where: { id: existingVariant.id },
            data: {
              foodType: variant.foodType,
              price: variant.price,
              variantId: variant.variantId,
            },
          });
        } else {
          return prismaDB.menuItemVariant.create({
            data: {
              foodType: variant.foodType,
              price: variant.price,
              variantId: variant.variantId,
              menuItemId: menuItem.id,
            },
          });
        }
      })
    : [];

  const variantIdsToKeep = isVariants
    ? menuItemVariants.map((v: any) => v.id).filter(Boolean)
    : [];
  const variantsToDelete = menuItem.menuItemVariants.filter(
    (ev) => !variantIdsToKeep.includes(ev.id)
  );

  // Prepare updates for addons
  const addonUpdates = isAddons
    ? menuGroupAddOns.map((addon: any) => {
        const existingAddon = menuItem.menuGroupAddOns.find(
          (ea) => ea.id === addon.id
        );
        if (existingAddon) {
          return prismaDB.menuGroupAddOns.update({
            where: { id: existingAddon.id },
            data: {
              addOnGroupId: addon.addOnGroupId,
            },
          });
        } else {
          return prismaDB.menuGroupAddOns.create({
            data: { addOnGroupId: addon.addOnGroupId, menuItemId: menuItem.id },
          });
        }
      })
    : [];

  const addonIdsToKeep = isAddons
    ? menuGroupAddOns.map((a: any) => a.id).filter(Boolean)
    : [];

  const addonsToDelete = menuItem.menuGroupAddOns.filter(
    (ea) => !addonIdsToKeep.includes(ea.id)
  );

  // Prepare updates for images
  const imageUpdates = images?.map((image: any) => {
    const existingImage = menuItem.images.find((ei) => ei.url === image?.url);
    if (existingImage) {
      return prismaDB.image.update({
        where: { id: existingImage.id },
        data: {
          url: image.url,
        },
      });
    } else {
      return prismaDB.image.create({
        data: { ...image, menuId: menuItem.id },
      });
    }
  });

  const imageUrlsToKeep = images.map((i: any) => i.url);
  const imagesToDelete = menuItem.images.filter(
    (ei) => !imageUrlsToKeep.includes(ei.url)
  );

  // Perform all updates in a transaction
  await prismaDB.$transaction(async (prisma) => {
    // Update main menu item

    await prisma.menuItem.update({
      where: {
        id: menuItem.id,
      },
      data: updateData,
    });

    // Handle variants
    await Promise.all(variantUpdates);
    if (variantsToDelete.length > 0) {
      await prisma.menuItemVariant.deleteMany({
        where: { id: { in: variantsToDelete.map((v) => v.id) } },
      });
    }

    // Handle addons
    await Promise.all(addonUpdates);
    if (addonsToDelete.length > 0) {
      await prisma.menuGroupAddOns.deleteMany({
        where: { id: { in: addonsToDelete.map((a) => a.id) } },
      });
    }

    // Handle images
    await Promise.all(imageUpdates);
    if (imagesToDelete.length > 0) {
      await prisma.image.deleteMany({
        where: { id: { in: imagesToDelete.map((i) => i.id) } },
      });
    }
  });

  await getOAllItems(outlet.id);

  return res.json({
    success: true,
    message: "Update Success ✅",
  });
};

export const postItem = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const validFoodTypes = Object.values(FoodRole);

  const {
    name,
    shortCode,
    description,
    categoryId,
    isFeatured,
    isArchived,
    isVariants,
    isAddons,
    isDelivery,
    isPickUp,
    isDineIn,
    isOnline,
    type,
    price,
    menuItemVariants,
    menuGroupAddOns,
    images,
  } = req.body;

  if (!name) {
    throw new BadRequestsException(
      "Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (isVariants === false) {
    if (!price) {
      throw new BadRequestsException(
        "Price is Required",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  } else {
    if (!menuItemVariants || !menuItemVariants.length)
      throw new BadRequestsException(
        "Variants is Required if this food has Multiples",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
  }

  if (isAddons && !menuGroupAddOns.length) {
    throw new BadRequestsException(
      "If Add-Ons Selected, Assign required Group AddOn to it",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!description) {
    throw new BadRequestsException(
      "Description is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  if (!categoryId) {
    throw new BadRequestsException(
      "CategoryId is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  if (!validFoodTypes.includes(type)) {
    throw new BadRequestsException(
      "Meal Type is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!images || !images.length) {
    throw new BadRequestsException(
      "Images are Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const validPrice = isVariants ? "0" : price;
  const validVariants =
    isVariants && menuItemVariants.length > 0 ? menuItemVariants : [];
  const validAddons =
    isAddons && menuGroupAddOns.length > 0 ? menuGroupAddOns : [];

  const menuItem = await prismaDB.menuItem.create({
    data: {
      name,
      shortCode,
      description,
      categoryId,
      isFeatured,
      isArchived,
      isVariants,
      isAddons,
      isDelivery,
      isPickUp,
      isDineIn,
      isOnline,
      price: validPrice,
      type,
      menuItemVariants: {
        create: validVariants,
      },
      menuGroupAddOns: {
        create: validAddons,
      },
      images: {
        createMany: {
          data: [...images.map((image: { url: string }) => image)],
        },
      },
      restaurantId: outlet.id,
    },
  });

  await getOAllItems(outlet.id);

  return res.json({
    success: true,
    item: menuItem,
    message: "Creattion of Item Success ✅",
  });
};

export const deleteItem = async (req: Request, res: Response) => {
  const { outletId, itemId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const item = await getItemByOutletId(outlet.id, itemId);

  if (!item?.id) {
    throw new NotFoundException("Item Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.menuItem.delete({
    where: {
      restaurantId: outlet.id,
      id: item?.id,
    },
  });

  await getOAllItems(outlet.id);

  return res.json({
    success: true,
    message: "Item Deleted ",
  });
};
