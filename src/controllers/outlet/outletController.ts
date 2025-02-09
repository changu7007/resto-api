import { Request, Response } from "express";
import {
  fetchOutletByIdToRedis,
  getOutletByAdminId,
  getOutletById,
  getOutletByIdForStaff,
} from "../../lib/outlet";
import { NotFoundException } from "../../exceptions/not-found";
import { ErrorCode } from "../../exceptions/root";
import { redis } from "../../services/redis";
import { prismaDB } from "../..";
import { BadRequestsException } from "../../exceptions/bad-request";
import {
  operatingHoursSchema,
  outletOnlinePortalSchema,
} from "../../schema/staff";
import { getFetchAllNotificationToRedis } from "../../lib/outlet/get-items";
import { UnauthorizedException } from "../../exceptions/unauthorized";
import { getFormatUserAndSendToRedis } from "../../lib/get-users";
import { z } from "zod";
import { generateSlug } from "../../lib/utils";
import { FoodRole } from "@prisma/client";

export const getStaffOutlet = async (req: Request, res: Response) => {
  //@ts-ignore
  const getOutlet = await redis.get(`O-${req?.user?.restaurantId}`);

  if (getOutlet) {
    return res.status(200).json({
      success: true,
      outlet: JSON.parse(getOutlet),
      message: "Fetched Successfully from Redis",
    });
  }

  //@ts-ignore
  const outlet = await getOutletByIdForStaff(req?.user?.restaurantId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await redis.set(`O-${outlet.id}`, JSON.stringify(outlet));

  return res.status(200).json({
    success: true,
    outlet,
    message: "Fetched Successfully from DB",
  });
};

export const getByOutletId = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await redis.get(`O-${outletId}`);

  if (outlet) {
    return res.json({
      success: true,
      outlet: JSON.parse(outlet),
      message: "Powered up ⚡",
    });
  }

  const getOutlet = await prismaDB.restaurant.findFirst({
    where: {
      // @ts-ignore
      adminId: req.user?.id,
      id: outletId,
    },
    include: {
      integrations: true,
      invoice: true,
    },
  });

  return res.json({ success: true, outlet: getOutlet });
};

export const getAllNotifications = async (req: Request, res: Response) => {
  // @ts-ignore
  const { outletId } = req.params;

  const rNotifications = await redis.get(`o-n-${outletId}`);

  if (rNotifications) {
    return res.json({
      success: true,
      notifications: JSON.parse(rNotifications),
      message: "Powered up ⚡",
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const notifications = await prismaDB.notification.findMany({
    where: {
      restaurantId: outlet.id,
      status: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await redis.set(`o-n-${outlet.id}`, JSON.stringify(notifications));

  return res.json({
    success: true,
    notifications: notifications,
    message: "Powering UP",
  });
};

export const deleteAllNotifications = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  await prismaDB.notification.deleteMany({
    where: {
      restaurantId: getOutlet.id,
    },
  });

  await getFetchAllNotificationToRedis(outletId);

  return res.json({
    success: true,
    message: "Marked All Read",
  });
};

export const deleteNotificationById = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;
  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.notification.delete({
    where: {
      id: id,
      restaurantId: getOutlet?.id,
    },
  });

  await getFetchAllNotificationToRedis(outletId);
  return res.json({
    success: true,
    message: "Marked as Read",
  });
};

export const getMainOutlet = async (req: Request, res: Response) => {
  const { userId } = req.params;

  //@ts-ignore
  if (userId !== req.user?.id) {
    throw new BadRequestsException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }
  //@ts-ignore
  const getOutlet = await redis.get(`O-${req?.user?.restaurantId}`);

  if (getOutlet) {
    console.log("Redis");
    return res.status(200).json({
      success: true,
      outlet: JSON.parse(getOutlet),
      message: "Fetched Successfully from Redis",
    });
  }

  const outlet = await getOutletByAdminId(
    //@ts-ignore
    req?.user?.restaurantId,
    //@ts-ignore
    req?.user?.id
  );

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await redis.set(`O-${outlet.id}`, JSON.stringify(outlet));

  return res.status(200).json({
    success: true,
    outlet,
    message: "Fetched Successfully from DB",
  });
};

export const patchOutletDetails = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const {
    name,
    imageUrl,
    restaurantName,
    phoneNo,
    email,
    address,
    city,
    pincode,
  } = req.body;

  console.log(req.body);

  const getOutlet = await prismaDB.restaurant.findFirst({
    where: {
      // @ts-ignore
      adminId: req.user?.id,
      id: outletId,
    },
    include: {
      users: {
        select: {
          sites: true,
        },
      },
    },
  });

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.restaurant.update({
    where: {
      id: getOutlet.id,
    },
    data: {
      name: name ?? getOutlet.name,
      restaurantName: restaurantName ?? getOutlet.restaurantName,
      phoneNo: phoneNo ?? getOutlet.phoneNo,
      email: email ?? getOutlet.email,
      imageUrl: imageUrl ? imageUrl : getOutlet.imageUrl,
      address: address ?? getOutlet.address,
      city: city ?? getOutlet.city,
      pincode: pincode ?? getOutlet.pincode,
    },
  });

  await redis.del(`O-${getOutlet?.id}`);

  if (getOutlet?.users?.sites?.length > 0) {
    for (const site of getOutlet?.users?.sites) {
      if (site?.subdomain) {
        await redis.del(`app-domain-${site?.subdomain}`);
      }
    }
  }

  return res.json({ success: true, message: "Updated Success" });
};

export const addFMCTokenToOutlet = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { token } = req.body;

  const getOutlet = await getOutletById(outletId);

  const updateOutlet = await prismaDB.restaurant.update({
    where: {
      id: getOutlet?.id,
    },
    data: {
      fcmToken: token,
    },
  });

  await fetchOutletByIdToRedis(updateOutlet?.id);

  return res.json({
    success: true,
    message: "FMC TOKEN ADDED SUCCESFULLY",
  });
};

export const patchOutletOnlinePOrtalDetails = async (
  req: Request,
  res: Response
) => {
  const validateFields = outletOnlinePortalSchema.safeParse(req.body);

  if (!validateFields.success) {
    throw new BadRequestsException(
      validateFields.error.message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.restaurant.update({
    where: {
      id: outlet.id,
    },
    data: {
      onlinePortal: true,
      openTime: validateFields.data.openTime.time,
      closeTime: validateFields.data.closeTime.time,
      areaLat: validateFields.data.areaLat,
      areaLong: validateFields.data.areaLong,
      orderRadius: Number(validateFields.data.orderRadius),
      isDelivery: validateFields.data.isDelivery,
      isDineIn: validateFields.data.isDineIn,
      isPickUp: validateFields.data.isPickUp,
    },
  });

  if (!outlet.integrations.find((outlet) => outlet?.name === "ONLINEHUB")) {
    await prismaDB.integration.create({
      data: {
        restaurantId: outlet.id,
        name: "ONLINEHUB",
        connected: true,
        status: true,
        link: validateFields.data.subdomain,
      },
    });
  }

  await fetchOutletByIdToRedis(outlet?.id);
  await getFormatUserAndSendToRedis(outlet?.adminId);

  if (outlet?.users?.sites?.length > 0) {
    for (const site of outlet?.users?.sites) {
      await redis.del(`app-domain-${site?.subdomain}`);
    }
  }

  return res.json({
    success: true,
    message: "Online Hub Integrated Success",
  });
};

export const updateOrCreateOperatingHours = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;
  const validateFields = operatingHoursSchema.safeParse(req.body);

  if (!validateFields.success) {
    throw new BadRequestsException(
      validateFields.error.message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.restaurant.update({
    where: {
      id: outlet.id,
    },
    data: {
      openTime: validateFields.data.openTime.time,
      closeTime: validateFields.data.closeTime.time,
    },
  });
  await redis.del(`O-${outlet.id}`);

  return res.json({
    success: true,
    message: "Operating Hours Updated Successfully",
  });
};

export const getIntegration = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getINtegrations = await prismaDB.integration.findMany({
    where: {
      restaurantId: outlet.id,
    },
  });

  await fetchOutletByIdToRedis(outlet?.id);

  return res.json({
    success: true,
    integrations: getINtegrations,
  });
};

export const createInvoiceDetails = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const { isGSTEnabled, isPrefix, invoiceNo, prefix } = req.body;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.invoice.create({
    data: {
      restaurantId: outlet.id,
      isGSTEnabled,
      isPrefix,
      invoiceNo,
      prefix: isPrefix ? prefix : "",
    },
  });
  await fetchOutletByIdToRedis(outlet?.id);

  return res.json({
    success: true,
    message: "Created Tax & Invoice Details",
  });
};

export const updateInvoiceDetails = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const { isGSTEnabled, isPrefix, invoiceNo, prefix } = req.body;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.invoice.update({
    where: {
      restaurantId: outlet.id,
    },
    data: {
      isGSTEnabled,
      isPrefix,
      invoiceNo,
      prefix: isPrefix ? prefix : "",
    },
  });
  await fetchOutletByIdToRedis(outlet?.id);

  return res.json({
    success: true,
    message: "Updated Tax & Invoice Details",
  });
};

export const fetchInvoiceDetails = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getInvoiceDetails = await prismaDB.invoice.findFirst({
    where: {
      restaurantId: outlet.id,
    },
  });

  return res.json({
    success: true,
    invoiceData: getInvoiceDetails,
  });
};

export const deleteOutlet = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  // @ts-ignore
  const userId = req?.user?.id;

  if (outlet === undefined || !outlet.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (outlet.adminId !== userId) {
    throw new UnauthorizedException(
      "Your Unauthorized To delete this Outlet",
      ErrorCode.UNAUTHORIZED
    );
  }

  await prismaDB.restaurant.delete({
    where: {
      id: outlet?.id,
      adminId: userId,
    },
  });

  await prismaDB.onboardingStatus.delete({
    where: {
      userId: userId,
    },
  });

  await redis.del(`O-${outletId}`);
  await getFormatUserAndSendToRedis(userId);

  return res.json({ success: true, message: "Outlet Deleted" });
};

export const getrazorpayConfig = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (outlet === undefined || !outlet.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const razorpayConfig = await prismaDB.razorpayIntegration.findFirst({
    where: {
      restaurantId: outlet?.id,
    },
  });

  return res.json({
    success: true,
    config: razorpayConfig,
  });
};

const formSchema = z.object({
  name: z.string().min(1, "Restaurant Legal Name is Required"),
  outletType: z.enum([
    "RESTAURANT",
    "HYBRIDKITCHEN",
    "EXPRESS",
    "BAKERY",
    "CAFE",
    "FOODTRUCK",
    "NONE",
  ]),
  shortName: z.string().min(1, "Restaurant Short Name is Required"),
  address: z.string().min(1, "Restaurant Address is Required"),
  city: z.string().min(1, "Restaurant City is Required"),
  pincode: z.string().min(1, "Restaurant Pincode is Required"),
  gst: z.string().optional(),
  fssai: z.string().optional(),
  copy: z.boolean(),
  // copyInventory: z.boolean(),
  // copyRecipes: z.boolean(),
});

// Types for mapping data
type CategoryMap = Map<string, any>;
type VariantMap = Map<string, any>;
type AddonGroupMap = Map<string, { group: any; variants: any[] }>;

export const createOutletFromOutletHub = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Validate request body (using Zod or your chosen library)
  const parsedBody = formSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new BadRequestsException(
      parsedBody.error.message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const {
    name,
    outletType,
    shortName,
    address,
    city,
    pincode,
    gst,
    fssai,
    copy: copyMenu,
  } = parsedBody.data;

  //
  // ---------------------------
  // FIRST TRANSACTION
  // Create outlet and copy categories, variants, add-on groups.
  // Build in‑memory maps for later use.
  // ---------------------------
  interface FirstTxResult {
    createOutlet: any;
    categoryMap: CategoryMap;
    variantMap: VariantMap;
    addonGroupMap: AddonGroupMap;
    // Keep a copy of the original categories data for use in the second transaction.
    categories: any[];
  }

  const firstTxResult: FirstTxResult = await prismaDB.$transaction(
    async (tx) => {
      // STEP 0: Create the new outlet (restaurant)
      const createOutlet = await tx.restaurant.create({
        data: {
          adminId: outlet.adminId,
          restaurantName: name,
          outletType: outletType,
          name: shortName,
          address,
          city,
          pincode,
          GSTIN: gst,
          fssai,
        },
      });

      // If copyMenu is false, we skip copying menu data.
      if (!copyMenu) {
        return {
          createOutlet,
          categoryMap: new Map(),
          variantMap: new Map(),
          addonGroupMap: new Map(),
          categories: [],
        };
      }

      // STEP 1: Fetch source outlet's categories (with menu items, variants, add-on groups)
      const categories = await tx.category.findMany({
        where: { restaurantId: outlet.id },
        include: {
          menuItems: {
            include: {
              menuItemVariants: { include: { variant: true } },
              menuGroupAddOns: {
                include: {
                  addOnGroups: { include: { addOnVariants: true } },
                },
              },
            },
          },
        },
      });

      // STEP 2: Create new categories for the new outlet and build a map.
      const categoryMap: CategoryMap = new Map();
      for (const cat of categories) {
        const newCat = await tx.category.create({
          data: {
            name: cat.name,
            slug: generateSlug(cat.name),
            description: cat.description,
            restaurantId: createOutlet.id,
          },
        });
        categoryMap.set(generateSlug(cat.name), newCat);
      }

      // STEP 3: Collect unique variants across all menu items.
      const variantDataMap: Map<string, any> = new Map();
      for (const cat of categories) {
        for (const menuItem of cat.menuItems) {
          for (const miv of menuItem.menuItemVariants) {
            const variantSlug = generateSlug(miv.variant.name);
            if (!variantDataMap.has(variantSlug)) {
              variantDataMap.set(variantSlug, miv.variant);
            }
          }
        }
      }

      // Create variants and build a variant map.
      const variantMap: VariantMap = new Map();
      for (const [slug, variant] of variantDataMap.entries()) {
        const newVariant = await tx.variants.create({
          data: {
            restaurantId: createOutlet.id,
            name: variant.name,
            slug,
            variantCategory: variant.variantCategory,
            status: variant.status,
          },
        });
        variantMap.set(slug, newVariant);
      }

      // STEP 4: Collect unique add-on groups (with their variants) across all menu items.
      type AddonGroupInfo = {
        title: string;
        description: string;
        status: string;
        minSelect: number;
        maxSelectString: string;
        variants: { name: string; price: number; type: string }[];
      };

      const addonGroupData: Map<string, AddonGroupInfo> = new Map();
      for (const cat of categories) {
        for (const menuItem of cat.menuItems) {
          for (const groupAddon of menuItem.menuGroupAddOns) {
            const groupSlug = generateSlug(groupAddon.addOnGroups.title);
            if (!addonGroupData.has(groupSlug)) {
              addonGroupData.set(groupSlug, {
                title: groupAddon.addOnGroups.title,
                description: groupAddon.addOnGroups.description || "",
                status: groupAddon.addOnGroups.status ? "true" : "false",
                minSelect: Number(groupAddon.addOnGroups.minSelect) || 0,
                maxSelectString: groupAddon.addOnGroups.maxSelectString || "",
                variants: groupAddon.addOnGroups.addOnVariants.map(
                  (variant) => ({
                    name: variant.name,
                    price: Number(variant.price),
                    type: variant.type as FoodRole,
                  })
                ),
              });
            }
          }
        }
      }

      // Create add-on groups and their variants.
      const addonGroupMap: AddonGroupMap = new Map();
      for (const [slug, groupData] of addonGroupData.entries()) {
        const newGroup = await tx.addOns.create({
          data: {
            restaurantId: createOutlet.id,
            title: groupData.title,
            slug: generateSlug(groupData.title),
            description: groupData.description,
            status: groupData.status === "true" ? true : false,
            minSelect: groupData.minSelect.toString(),
            maxSelectString: groupData.maxSelectString,
          },
        });

        const newVariants: any[] = [];
        for (const variant of groupData.variants) {
          const newAddonVariant = await tx.addOnVariants.create({
            data: {
              addonId: newGroup.id,
              restaurantId: createOutlet.id,
              name: variant.name,
              slug: generateSlug(variant.name),
              price: variant.price.toString(),
              type: variant.type as FoodRole,
            },
          });
          newVariants.push(newAddonVariant);
        }
        addonGroupMap.set(slug, { group: newGroup, variants: newVariants });
      }

      return {
        createOutlet,
        categoryMap,
        variantMap,
        addonGroupMap,
        categories,
      };
    }
  );

  // If we aren't copying menu data, update cache and return.
  if (!copyMenu) {
    await getFormatUserAndSendToRedis(outlet.adminId);
    return res.json({
      success: true,
      message: "Outlet Added Successfully",
    });
  }

  //
  // ---------------------------
  // SECOND TRANSACTION
  // Use the previously built maps and original categories data
  // to create menu items (and their related variants and add-on links).
  // ---------------------------
  await prismaDB.$transaction(async (tx) => {
    // Loop over each category from the source data.
    for (const cat of firstTxResult.categories) {
      const newCategory = firstTxResult.categoryMap.get(generateSlug(cat.name));
      if (!newCategory) {
        throw new Error(`New category not found for: ${cat.name}`);
      }
      // For each menu item in this category:
      for (const menuItem of cat.menuItems) {
        const newMenuItem = await tx.menuItem.create({
          data: {
            restaurantId: firstTxResult.createOutlet.id,
            categoryId: newCategory.id,
            name: menuItem.name,
            shortCode: menuItem.shortCode,
            slug: generateSlug(menuItem.name),
            description: menuItem.description,
            isVariants: menuItem.isVariants,
            isAddons: menuItem.isAddons,
            netPrice: menuItem.netPrice,
            gst: menuItem.gst,
            price: menuItem.price,
            chooseProfit: menuItem.chooseProfit,
            grossProfitType: menuItem.grossProfitType,
            grossProfitPer: menuItem.grossProfitPer,
            grossProfit: menuItem.grossProfit,
            type: menuItem.type,
            isDelivery: menuItem.isDelivery,
            isPickUp: menuItem.isPickUp,
            isDineIn: menuItem.isDineIn,
            isOnline: menuItem.isOnline,
          },
        });

        // Create menu item variants.
        for (const miv of menuItem.menuItemVariants) {
          const variantSlug = generateSlug(miv.variant.name);
          const newVariant = firstTxResult.variantMap.get(variantSlug);
          if (!newVariant) {
            throw new Error(`Variant not found for slug: ${variantSlug}`);
          }
          await tx.menuItemVariant.create({
            data: {
              menuItemId: newMenuItem.id,
              restaurantId: firstTxResult.createOutlet.id,
              variantId: newVariant.id,
              netPrice: miv.netPrice,
              gst: miv.gst,
              price: miv.price,
              chooseProfit: miv.chooseProfit,
              grossProfitType: miv.grossProfitType,
              grossProfitPer: miv.grossProfitPer,
              grossProfit: miv.grossProfit,
              foodType: miv.foodType,
            },
          });
        }

        // Create menu group add-on links.
        for (const groupAddon of menuItem.menuGroupAddOns) {
          const groupSlug = generateSlug(groupAddon.addOnGroups.title);
          const addonGroupInfo = firstTxResult.addonGroupMap.get(groupSlug);
          if (addonGroupInfo) {
            await tx.menuGroupAddOns.create({
              data: {
                menuItemId: newMenuItem.id,
                addOnGroupId: addonGroupInfo.group.id,
                minSelect: groupAddon.minSelect,
                maxSelectString: groupAddon.maxSelectString,
              },
            });
          }
        }
      }
    }
  });

  // Update the Redis cache (outside of any transaction)
  await getFormatUserAndSendToRedis(outlet.adminId);

  return res.json({
    success: true,
    message: "Outlet Added Successfully",
  });
};

export const updateOutletType = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { outletType } = req.body;
  // @ts-ignore
  const userId = req?.user?.id;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (outlet.adminId !== userId) {
    throw new UnauthorizedException(
      "You are not authorized to update this outlet type",
      ErrorCode.UNAUTHORIZED
    );
  }

  await prismaDB.restaurant.update({
    where: { id: outlet.id },
    data: { outletType },
  });

  await fetchOutletByIdToRedis(outlet?.id);
  await getFormatUserAndSendToRedis(userId);

  if (outlet?.users?.sites?.length > 0) {
    for (const site of outlet?.users?.sites) {
      await redis.del(`app-domain-${site?.subdomain}`);
    }
  }

  return res.json({
    success: true,
    message: "Outlet Type Updated Successfully",
  });
};

export const updateOnlinePortalStatus = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { status } = req.body;
  // @ts-ignore
  const userId = req?.user?.id;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (outlet.adminId !== userId) {
    throw new UnauthorizedException(
      "You are not authorized to update this outlet type",
      ErrorCode.UNAUTHORIZED
    );
  }

  await prismaDB.restaurant.update({
    where: { id: outlet.id },
    data: { onlinePortal: status },
  });

  await Promise.all([
    redis.del(`O-${outletId}`),
    getFormatUserAndSendToRedis(userId),
  ]);

  if (outlet?.users?.sites?.length > 0) {
    for (const site of outlet?.users?.sites) {
      await redis.del(`app-domain-${site?.subdomain}`);
    }
  }

  return res.json({
    success: true,
    message: "Online Portal Status Updated Successfully",
  });
};
