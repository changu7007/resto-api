import { Request, Response } from "express";
import { getAddOnByOutletId, getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { prismaDB } from "../../..";
import { ErrorCode } from "../../../exceptions/root";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { redis } from "../../../services/redis";
import { generateSlug } from "../../../lib/utils";
import { z } from "zod";
import { GstType } from "@prisma/client";

export const getAddon = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const addOns = await redis.get(`o-${outletId}-addons`);

  if (addOns) {
    return res.json({
      success: true,
      addons: JSON.parse(addOns),
      message: "SUCKED",
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const addOn = await prismaDB.addOns.findMany({
    where: {
      restaurantId: outlet.id,
    },
  });
  await redis.set(`o-${outletId}-addons`, JSON.stringify(addOn));

  return res.json({
    success: true,
    addons: addOn,
  });
};

const formSchema = z.object({
  title: z.string().min(1, { message: "AddOn Group Name required" }),
  description: z.string().optional(),
  minSelect: z.coerce.number().optional().default(0),
  maxSelect: z.coerce.number().optional().default(0),
  addOnVariants: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1, { message: "addon name required" }),
        netPrice: z.string().min(1, { message: "net price required" }),
        price: z.string().min(1, { message: "price required" }),
        gst: z.coerce.number({ required_error: "GST required" }).min(0, {
          message: "GST required",
        }),
        gstType: z.nativeEnum(GstType, {
          required_error: "GST Type required",
        }),
        chooseProfit: z
          .enum(["manualProfit", "itemRecipe"])
          .optional()
          .default("manualProfit"), // Default to "manualProfit",
        grossProfit: z.coerce.number().optional().default(0),
        grossProfitType: z.enum(["INR", "PER"]).optional().default("INR"), // Default to "INR"
        grossProfitPer: z.string().optional(),
        type: z.string().min(1),
        recipeId: z.string().optional(),
      })
    )
    .min(1, { message: "Atleast 1 AddOn Variant is Required" }),
});

export const createAddOn = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const { data, error } = formSchema.safeParse(req.body);

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const slug = generateSlug(data.title);

  const findSlug = await prismaDB.addOns.findFirst({
    where: {
      slug,
    },
  });

  if (findSlug) {
    throw new BadRequestsException(
      "AddOn Group Name already exists",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.addOns.create({
    data: {
      title: data.title,
      slug,
      description: data.description,
      minSelect: data.minSelect,
      maxSelect: data.maxSelect,
      addOnVariants: {
        create: data.addOnVariants.map((addOn: any) => ({
          name: addOn.name,
          slug: generateSlug(addOn.name),
          price: addOn.price,
          type: addOn.type,
          restaurantId: outlet.id,
          gst: addOn.gst,
          gstType: addOn.gstType,
          chooseProfit: addOn.chooseProfit,
          grossProfit: addOn.grossProfit,
          grossProfitType: addOn.grossProfitType,
          grossProfitPer:
            addOn?.grossProfitType === "PER" ? addOn.grossProfitPer : null,
          itemRecipeId:
            addOn?.chooseProfit === "itemRecipe" ? addOn.recipeId : null,
          netPrice: addOn.netPrice,
        })),
      },
      restaurantId: outlet.id,
    },
  });

  await redis.del(`o-${outletId}-addons`);

  return res.json({
    success: true,
    message: " AddOn Created ",
  });
};

export const deleteAddon = async (req: Request, res: Response) => {
  const { outletId, addOnId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const addOn = await getAddOnByOutletId(outlet.id, addOnId);

  if (!addOn?.id) {
    throw new NotFoundException("Variant Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.addOns.deleteMany({
    where: {
      restaurantId: outlet.id,
      id: addOn.id,
    },
  });

  const addOns = await prismaDB.addOns.findMany({
    where: {
      restaurantId: outlet.id,
    },
  });
  await redis.set(`o-${outletId}-addons`, JSON.stringify(addOns));

  return res.json({
    success: true,
    message: " AddOn Deleted ",
  });
};

export const updateAddon = async (req: Request, res: Response) => {
  const { outletId, addOnId } = req.params;

  const { data, error } = formSchema.safeParse(req.body);

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!data.addOnVariants.length) {
    throw new BadRequestsException(
      "Atleast 1 AddOn Variants is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const addOn = await getAddOnByOutletId(outlet.id, addOnId);

  if (!addOn?.id) {
    throw new NotFoundException("Variant Not Found", ErrorCode.NOT_FOUND);
  }

  const existingVariants = addOn.addOnVariants;

  const updates = data.addOnVariants.map((variant: any) => {
    const existingVariant = existingVariants.find((ev) => ev.id === variant.id);
    if (existingVariant) {
      // Update existing variant
      return prismaDB.addOnVariants.update({
        where: { id: existingVariant.id },
        data: {
          name: variant.name,
          netPrice: variant.netPrice,
          price: variant.price,
          type: variant.type,
          gst: variant.gst,
          gstType: variant.gstType,
          chooseProfit: variant.chooseProfit,
          grossProfit: variant.grossProfit,
          grossProfitType: variant.grossProfitType,
          grossProfitPer:
            variant?.grossProfitType === "PER" ? variant.grossProfitPer : null,
          itemRecipeId:
            variant.chooseProfit === "itemRecipe" ? variant.recipeId : null,
        },
      });
    } else {
      // Create new variant
      return prismaDB.addOnVariants.create({
        data: {
          restaurantId: outlet?.id,
          name: variant.name,
          slug: generateSlug(variant.name),
          price: variant.price,
          type: variant.type,
          addonId: addOn.id,
          gst: variant.gst,
          gstType: variant.gstType,
          chooseProfit: variant.chooseProfit,
          grossProfit: variant.grossProfit,
          grossProfitType: variant.grossProfitType,
          grossProfitPer:
            variant?.grossProfitType === "PER" ? variant.grossProfitPer : null,
          itemRecipeId:
            variant.chooseProfit === "itemRecipe" ? variant.recipeId : null,
          netPrice: variant.netPrice,
        },
      });
    }
  });

  // Identify variants to delete
  const variantIdsToKeep = data.addOnVariants
    .map((v: any) => v.id)
    .filter(Boolean);
  const variantsToDelete = existingVariants.filter(
    (ev) => !variantIdsToKeep.includes(ev.id)
  );

  // Perform the update
  await prismaDB.$transaction([
    // Update AddOn
    prismaDB.addOns.update({
      where: { id: addOn.id },
      data: { title: data.title, description: data.description },
    }),
    // Update or create variants
    ...updates,
    // Delete removed variants
    prismaDB.addOnVariants.deleteMany({
      where: {
        id: { in: variantsToDelete.map((v) => v.id) },
      },
    }),
  ]);

  await redis.del(`o-${outletId}-addons`);

  return res.json({
    success: true,
    message: " Addon Updated ",
  });
};
