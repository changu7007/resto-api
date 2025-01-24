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
import { outletOnlinePortalSchema } from "../../schema/staff";
import { getFetchAllNotificationToRedis } from "../../lib/outlet/get-items";
import { UnauthorizedException } from "../../exceptions/unauthorized";
import { getFormatUserAndSendToRedis } from "../../lib/get-users";
import { z } from "zod";

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
    imageurl,
    restaurantName,
    phoneNo,
    email,
    address,
    city,
    pincode,
  } = req.body;

  const getOutlet = await prismaDB.restaurant.findFirst({
    where: {
      // @ts-ignore
      adminId: req.user?.id,
      id: outletId,
    },
  });

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.restaurant.updateMany({
    where: {
      id: getOutlet.id,
    },
    data: {
      name: name ?? getOutlet.name,
      restaurantName: restaurantName ?? getOutlet.restaurantName,
      phoneNo: phoneNo ?? getOutlet.phoneNo,
      email: email ?? getOutlet.email,
      imageUrl: imageurl ?? getOutlet.imageUrl,
      address: address ?? getOutlet.address,
      city: city ?? getOutlet.city,
      pincode: pincode ?? getOutlet.pincode,
    },
  });

  await fetchOutletByIdToRedis(getOutlet?.id);

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
  const validateFields = outletOnlinePortalSchema.parse(req.body);

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
      openTime: validateFields.openTime,
      closeTime: validateFields.closeTime,
      areaLat: validateFields.areaLat,
      areaLong: validateFields.areaLong,
      orderRadius: Number(validateFields.orderRadius),
      isDelivery: validateFields.isDelivery,
      isDineIn: validateFields.isDineIn,
      isPickUp: validateFields.isPickUp,
    },
  });

  if (!outlet.integrations.find((outlet) => outlet?.name === "ONLINEHUB")) {
    await prismaDB.integration.create({
      data: {
        restaurantId: outlet.id,
        name: "ONLINEHUB",
        connected: true,
        status: true,
        link: validateFields.subdomain,
      },
    });
  }

  await fetchOutletByIdToRedis(outlet?.id);

  return res.json({
    success: true,
    message: "Online Hub Integrated Success",
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
      "Your Unauthorized To delete this Settings",
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
});

export const createOutletFromOutletHub = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const validateFields = formSchema.safeParse(req.body);

  if (!validateFields.success) {
    throw new BadRequestsException(
      validateFields.error.message,
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
    copy,
  } = validateFields.data;

  await prismaDB.$transaction(async (tx) => {
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

    if (copy) {
      const categories = await tx.category.findMany({
        where: { restaurantId: outlet.id },
        include: {
          menuItems: {
            include: {
              menuItemVariants: true,
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
          },
        },
      });

      for (const category of categories) {
        const newCategory = await tx.category.create({
          data: {
            name: category.name,
            description: category.description,
            restaurantId: createOutlet.id,
          },
        });

        // Copy menu items with variants and addons
        for (const menuItem of category.menuItems) {
          const newMenuItem = await tx.menuItem.create({
            data: {
              restaurantId: createOutlet.id,
              categoryId: newCategory.id,
              name: menuItem.name,
              description: menuItem.description,
              isVariants: menuItem.isVariants,
              isAddons: menuItem.isAddons,
              price: menuItem.price,
              type: menuItem.type,
              isDelivery: menuItem.isDelivery,
              isPickUp: menuItem.isPickUp,
              isDineIn: menuItem.isDineIn,
              isOnline: menuItem.isOnline,
            },
          });

          // Copy menu item variants
          if (menuItem.menuItemVariants.length > 0) {
            await tx.menuItemVariant.createMany({
              data: menuItem.menuItemVariants.map((variant) => ({
                menuItemId: newMenuItem.id,
                restaurantId: createOutlet.id,
                variantId: variant.variantId,
                price: variant.price,
                foodType: variant.foodType,
              })),
            });
          }

          // Copy addons and their variants
          if (menuItem.menuGroupAddOns.length > 0) {
            for (const groupAddon of menuItem.menuGroupAddOns) {
              const newAddOnGroup = await tx.addOns.create({
                data: {
                  restaurantId: createOutlet.id,
                  title: groupAddon.addOnGroups.title,
                  description: groupAddon.addOnGroups.description,
                  status: groupAddon.addOnGroups.status,
                  minSelect: groupAddon.addOnGroups.minSelect,
                  maxSelectString: groupAddon.addOnGroups.maxSelectString,
                },
              });

              // Create menu group addon relation
              await tx.menuGroupAddOns.create({
                data: {
                  menuItemId: newMenuItem.id,
                  addOnGroupId: newAddOnGroup.id,
                  minSelect: groupAddon.minSelect,
                  maxSelectString: groupAddon.maxSelectString,
                },
              });

              // Copy addon variants
              if (groupAddon.addOnGroups.addOnVariants.length > 0) {
                await tx.addOnVariants.createMany({
                  data: groupAddon.addOnGroups.addOnVariants.map((variant) => ({
                    addonId: newAddOnGroup.id,
                    restaurantId: createOutlet.id,
                    name: variant.name,
                    price: variant.price,
                    type: variant.type,
                  })),
                });
              }
            }
          }
        }
      }
    }
  });

  return res.json({
    success: true,
    message: "Outlet Added Successfully",
  });
};
