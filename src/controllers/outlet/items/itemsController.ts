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
import { z } from "zod";
import { getFormatUserAndSendToRedis } from "../../../lib/get-users";

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

const menuSchema = z.object({
  name: z.string().min(1),
  shortCode: z.string().optional(),
  description: z.string().min(1),
  images: z.object({ url: z.string() }).array(),
  price: z.string().optional(),
  netPrice: z.string().optional(),
  gst: z.coerce.number().optional(),
  chooseProfit: z
    .enum(["manualProfit", "itemRecipe"], {
      required_error: "You need to select a gross profit type.",
    })
    .optional(),
  grossProfit: z.coerce.number().optional(),
  grossProfitType: z
    .enum(["INR", "PER"], {
      required_error: "You need to select a gross profit type.",
    })
    .optional(),
  grossProfitPer: z.string().optional(),
  type: z.enum(
    ["VEG", "NONVEG", "EGG", "SOFTDRINKS", "ALCOHOL", "NONALCOHOLIC", "MILK"],
    {
      required_error: "You need to select a food type.",
    }
  ),
  menuItemVariants: z.array(
    z.object({
      id: z.string().optional(),
      variantId: z.string(),
      price: z.string(),
      netPrice: z.string(),
      gst: z.coerce.number().min(0, { message: "Gst Required" }),
      chooseProfit: z.enum(["manualProfit", "itemRecipe"], {
        required_error: "You need to select a gross profit type.",
      }),
      grossProfit: z.coerce.number().optional(),
      grossProfitType: z.enum(["INR", "PER"], {
        required_error: "You need to select a gross profit type.",
      }),
      grossProfitPer: z.string().optional(),
      foodType: z.enum(
        [
          "VEG",
          "NONVEG",
          "EGG",
          "SOFTDRINKS",
          "ALCOHOL",
          "NONALCOHOLIC",
          "MILK",
        ],
        {
          required_error: "You need to select a food type.",
        }
      ),
    })
  ),
  menuGroupAddOns: z.array(
    z.object({
      id: z.string().optional(),
      addOnGroupId: z.string(),
    })
  ),
  isVariants: z.boolean().default(false),
  isAddons: z.boolean().default(false),
  categoryId: z.string().min(1),
  isDelivery: z.boolean().optional(),
  isPickUp: z.boolean().optional(),
  isDineIn: z.boolean().optional(),
  isOnline: z.boolean().optional(),
});

export const updateItembyId = async (req: Request, res: Response) => {
  const { itemId, outletId } = req.params;
  const validateFields = menuSchema.parse(req.body);

  const validFoodTypes = Object.values(FoodRole);

  if (!validateFields.name) {
    throw new BadRequestsException(
      "Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (validateFields.isVariants === false) {
    if (!validateFields.price) {
      throw new BadRequestsException(
        "Price is Required",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  } else {
    if (
      !validateFields.menuItemVariants ||
      !validateFields.menuItemVariants.length
    )
      throw new BadRequestsException(
        "Variants is Required if this food has Multiples",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
  }

  if (validateFields.isAddons && !validateFields.menuGroupAddOns.length) {
    throw new BadRequestsException(
      "If Add-Ons Selected, Assign required Group AddOn to it",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!validateFields.description) {
    throw new BadRequestsException(
      "Description is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  if (!validateFields.categoryId) {
    throw new BadRequestsException(
      "CategoryId is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  if (!validFoodTypes.includes(validateFields.type)) {
    throw new BadRequestsException(
      "Meal Type is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // if (!images || !images.length) {
  //   throw new BadRequestsException(
  //     "Images are Required",
  //     ErrorCode.UNPROCESSABLE_ENTITY
  //   );
  // }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const menuItem = await getItemByOutletId(outlet.id, itemId);

  if (!menuItem?.id) {
    throw new NotFoundException("Item Not Found", ErrorCode.NOT_FOUND);
  }
  const category = await getCategoryByOutletId(
    outlet.id,
    validateFields?.categoryId
  );

  if (!category?.id) {
    throw new NotFoundException(
      "Category Not Found",
      ErrorCode.OUTLET_NOT_FOUND
    );
  }

  // Prepare updates for variants
  const variantUpdates = validateFields?.isVariants
    ? validateFields?.menuItemVariants.map((variant) => {
        console.log("Variant", variant);
        const existingVariant = menuItem.menuItemVariants.find(
          (ev) => ev.id === variant.id
        );
        if (existingVariant) {
          return prismaDB.menuItemVariant.update({
            where: { id: existingVariant.id },
            data: {
              foodType: variant.foodType,
              netPrice: variant?.netPrice,
              gst: variant?.gst,
              price: variant.price,
              chooseProfit: variant?.chooseProfit,
              grossProfitType: variant?.grossProfitType,
              grossProfitPer:
                variant?.grossProfitType === "PER"
                  ? variant?.grossProfitPer
                  : null,
              grossProfit: variant?.grossProfit,
              variantId: variant.variantId,
            },
          });
        } else {
          return prismaDB.menuItemVariant.create({
            data: {
              restaurantId: outlet?.id,
              foodType: variant.foodType,
              netPrice: variant?.netPrice,
              gst: variant?.gst,
              price: variant.price,
              chooseProfit: variant?.chooseProfit,
              grossProfitType: variant?.grossProfitType,
              grossProfitPer:
                variant?.grossProfitType === "PER"
                  ? variant?.grossProfitPer
                  : null,
              grossProfit: variant?.grossProfit,
              variantId: variant?.variantId,
              menuItemId: menuItem.id,
            },
          });
        }
      })
    : [];

  const variantIdsToKeep = validateFields?.isVariants
    ? validateFields?.menuItemVariants.map((v: any) => v.id).filter(Boolean)
    : [];
  const variantsToDelete = menuItem.menuItemVariants.filter(
    (ev) => !variantIdsToKeep.includes(ev.id)
  );

  // Prepare updates for addons
  const addonUpdates = validateFields?.isAddons
    ? validateFields?.menuGroupAddOns.map((addon) => {
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

  const addonIdsToKeep = validateFields?.isAddons
    ? validateFields?.menuGroupAddOns.map((a) => a.id).filter(Boolean)
    : [];

  const addonsToDelete = menuItem.menuGroupAddOns.filter(
    (ea) => !addonIdsToKeep.includes(ea.id)
  );

  // Prepare updates for images
  const imageUpdates = validateFields?.images?.map((image) => {
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

  const imageUrlsToKeep = validateFields?.images.map((i) => i.url);
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
      data: {
        name: validateFields?.name,
        shortCode: validateFields?.shortCode,
        description: validateFields?.description,
        categoryId: validateFields?.categoryId,
        isVariants: validateFields?.isVariants,
        isAddons: validateFields?.isAddons,
        isDelivery: validateFields?.isDelivery,
        isPickUp: validateFields?.isPickUp,
        isDineIn: validateFields?.isDineIn,
        isOnline: validateFields?.isOnline,
        type: validateFields?.type,
        price: validateFields?.isVariants ? "0" : validateFields?.price,
        gst: validateFields?.isVariants ? null : validateFields?.gst,
        netPrice: validateFields?.isVariants ? null : validateFields?.netPrice,
        chooseProfit: validateFields?.isVariants
          ? null
          : validateFields?.chooseProfit,
        grossProfitType: validateFields?.isVariants
          ? null
          : validateFields?.grossProfitType,
        grossProfitPer: validateFields?.isVariants
          ? null
          : validateFields?.grossProfitType === "PER"
          ? validateFields?.grossProfitPer
          : null,
        grossProfit: validateFields?.isVariants
          ? null
          : validateFields?.grossProfit,
      },
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

  const validateFields = menuSchema.parse(req.body);

  const validFoodTypes = Object.values(FoodRole);

  if (!validateFields.name) {
    throw new BadRequestsException(
      "Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (validateFields.isVariants === false) {
    if (!validateFields.price) {
      throw new BadRequestsException(
        "Price is Required",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  } else {
    if (
      !validateFields.menuItemVariants ||
      !validateFields.menuItemVariants.length
    )
      throw new BadRequestsException(
        "Variants is Required if this food has Multiples",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
  }

  if (validateFields.isAddons && !validateFields.menuGroupAddOns.length) {
    throw new BadRequestsException(
      "If Add-Ons Selected, Assign required Group AddOn to it",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!validateFields.description) {
    throw new BadRequestsException(
      "Description is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  if (!validateFields.categoryId) {
    throw new BadRequestsException(
      "CategoryId is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  if (!validFoodTypes.includes(validateFields.type)) {
    throw new BadRequestsException(
      "Meal Type is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // if (!images || !images.length) {
  //   throw new BadRequestsException(
  //     "Images are Required",
  //     ErrorCode.UNPROCESSABLE_ENTITY
  //   );
  // }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const validVariants =
    validateFields?.isVariants && validateFields?.menuItemVariants.length > 0
      ? validateFields?.menuItemVariants
      : [];
  const validAddons =
    validateFields?.isAddons && validateFields?.menuGroupAddOns.length > 0
      ? validateFields?.menuGroupAddOns
      : [];

  const menuItem = await prismaDB.menuItem.create({
    data: {
      name: validateFields?.name,
      shortCode: validateFields?.shortCode,
      description: validateFields?.description,
      categoryId: validateFields?.categoryId,
      isVariants: validateFields?.isVariants,
      isAddons: validateFields?.isAddons,
      isDelivery: validateFields?.isDelivery,
      isPickUp: validateFields?.isPickUp,
      isDineIn: validateFields?.isDineIn,
      isOnline: validateFields?.isOnline,
      price: validateFields?.isVariants ? "0" : validateFields?.price,
      gst: validateFields?.isVariants ? null : validateFields?.gst,
      netPrice: validateFields?.isVariants ? null : validateFields?.netPrice,
      chooseProfit: validateFields?.isVariants
        ? null
        : validateFields?.chooseProfit,
      grossProfitType: validateFields?.isVariants
        ? null
        : validateFields?.grossProfitType,
      grossProfitPer: validateFields?.isVariants
        ? null
        : validateFields?.grossProfitType === "PER"
        ? validateFields?.grossProfitPer
        : null,
      grossProfit: validateFields?.isVariants
        ? null
        : validateFields?.grossProfit,
      type: validateFields?.type,
      menuItemVariants: {
        create: validVariants.map((variant) => ({
          restaurantId: outlet?.id,
          variantId: variant?.variantId,
          foodType: variant?.foodType,
          netPrice: variant?.netPrice,
          gst: variant?.gst,
          price: variant?.price,
          chooseProfit: variant?.chooseProfit,
          grossProfitType: variant?.grossProfitType,
          grossProfitPer:
            variant?.grossProfitType === "PER" ? variant?.grossProfitPer : null,
          grossProfit: variant?.grossProfit,
        })),
      },
      menuGroupAddOns: {
        create: validAddons,
      },
      images: {
        createMany:
          validateFields?.images.length > 0
            ? {
                data: [
                  ...validateFields?.images.map(
                    (image: { url: string }) => image
                  ),
                ],
              }
            : undefined,
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

export const getShortCodeStatus = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { shortCode } = req.body;
  console.log("Short Code", shortCode);
  const findShortCode = await prismaDB.menuItem.findFirst({
    where: {
      restaurantId: outletId,
      shortCode: shortCode,
    },
  });

  if (findShortCode?.id) {
    return res.json({
      success: true,
    });
  } else {
    return res.json({
      success: false,
    });
  }
};

export const getMenuVariants = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getVariants = await prismaDB.menuItemVariant.findMany({
    where: {
      restaurantId: outlet?.id,
    },
    include: {
      menuItem: true,
      variant: true,
    },
  });

  const formattedVariants = getVariants?.map((variant) => ({
    id: variant?.id,
    name: `${variant?.menuItem?.name}-${variant?.variant?.name}`,
    price: variant?.price,
  }));

  return res.json({
    success: true,
    menuVariants: formattedVariants,
  });
};

export const addItemToUserFav = async (req: Request, res: Response) => {
  const { id } = req.body;
  const { outletId } = req.params;
  // @ts-ignore
  const userId = req?.user?.id;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const user = await prismaDB.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new BadRequestsException("Admin Not found", ErrorCode.UNAUTHORIZED);
  }

  // Check if the menu ID exists in favItems
  const updatedFavItems = user?.favItems.includes(id)
    ? user.favItems.filter((favId) => favId !== id) // Remove the ID if present
    : [...user.favItems, id]; // Add the ID if not present

  // Update the favItems field
  await prismaDB.user.update({
    where: {
      id: user.id,
    },
    data: {
      favItems: updatedFavItems, // Directly set the updated array
    },
  });

  await getFormatUserAndSendToRedis(user?.id);

  return res.json({
    success: true,
    message: "Added to favourites",
  });
};

export const getSingleAddons = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getAddons = await prismaDB.addOnVariants.findMany({
    where: {
      restaurantId: outlet?.id,
    },
    include: {
      addon: true,
    },
  });

  const formattedAddOns = getAddons?.map((addOn) => ({
    id: addOn?.id,
    name: addOn?.name,
    price: addOn?.price,
  }));

  return res.json({
    success: true,
    addOnItems: formattedAddOns,
  });
};
