import { Request, Response } from "express";
import { getAddOnByOutletId, getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { prismaDB } from "../../..";
import { ErrorCode } from "../../../exceptions/root";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { redis } from "../../../services/redis";

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

export const createAddOn = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const { title, description, addOnVariants } = req.body;

  if (!title) {
    throw new BadRequestsException(
      "Addon Title is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!addOnVariants.length) {
    throw new BadRequestsException(
      "Atleast 1 AddOn Variants is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.addOns.create({
    data: {
      title,
      description,
      addOnVariants: {
        create: addOnVariants.map((addOn: any) => ({
          name: addOn.name,
          price: addOn.price,
          type: addOn.type,
        })),
      },
      restaurantId: outlet.id,
    },
  });

  const addOn = await prismaDB.addOns.findMany({
    where: {
      restaurantId: outlet.id,
    },
  });
  await redis.set(`o-${outletId}-addons`, JSON.stringify(addOn));

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

  const { title, description, addOnVariants } = req.body;

  if (!title) {
    throw new BadRequestsException(
      "Addon Title is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!addOnVariants.length) {
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

  const updates = addOnVariants.map((variant: any) => {
    const existingVariant = existingVariants.find((ev) => ev.id === variant.id);
    if (existingVariant) {
      // Update existing variant
      return prismaDB.addOnVariants.update({
        where: { id: existingVariant.id },
        data: {
          name: variant.name,
          price: variant.price,
          type: variant.type,
        },
      });
    } else {
      // Create new variant
      return prismaDB.addOnVariants.create({
        data: {
          restaurantId: outlet?.id,
          name: variant.name,
          price: variant.price,
          type: variant.type,
          addonId: addOn.id,
        },
      });
    }
  });

  // Identify variants to delete
  const variantIdsToKeep = addOnVariants.map((v: any) => v.id).filter(Boolean);
  const variantsToDelete = existingVariants.filter(
    (ev) => !variantIdsToKeep.includes(ev.id)
  );

  // Perform the update
  await prismaDB.$transaction([
    // Update AddOn
    prismaDB.addOns.update({
      where: { id: addOn.id },
      data: { title, description },
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

  const addOns = await prismaDB.addOns.findMany({
    where: {
      restaurantId: outlet.id,
    },
  });
  await redis.set(`o-${outletId}-addons`, JSON.stringify(addOns));

  return res.json({
    success: true,
    message: " Addon Updated ",
  });
};
