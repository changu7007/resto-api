import { Request, Response } from "express";
import { getOutletById, getVariantByOutletId } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { BadRequestsException } from "../../../exceptions/bad-request";

export const getVariants = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const variant = await prismaDB.variants.findMany({
    where: {
      restaurantId: outlet.id,
    },
  });

  return res.json({
    success: true,
    variants: variant,
  });
};

export const createVariant = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const { name, variantCategory } = req.body;

  if (!name) {
    throw new BadRequestsException(
      "Variant Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!variantCategory) {
    throw new BadRequestsException(
      "Variant Category is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.variants.create({
    data: {
      name,
      variantCategory,
      restaurantId: outlet.id,
    },
  });

  return res.json({
    success: true,
    message: " Variant Created ",
  });
};

export const deleteVariant = async (req: Request, res: Response) => {
  const { outletId, variantId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const variant = await getVariantByOutletId(outlet.id, variantId);

  if (!variant?.id) {
    throw new NotFoundException("Variant Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.variants.deleteMany({
    where: {
      restaurantId: outlet.id,
      id: variantId,
    },
  });

  return res.json({
    success: true,
    message: " Variant Deleted ",
  });
};

export const updateVariant = async (req: Request, res: Response) => {
  const { outletId, variantId } = req.params;

  const { name, variantCategory } = req.body;

  if (!name) {
    throw new BadRequestsException(
      "Variant Name is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!variantCategory) {
    throw new BadRequestsException(
      "Variant Category is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const variant = await getVariantByOutletId(outlet.id, variantId);

  if (!variant?.id) {
    throw new NotFoundException("Variant Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.variants.update({
    where: {
      restaurantId: outlet.id,
      id: variantId,
    },
    data: {
      name,
      variantCategory,
    },
  });

  return res.json({
    success: true,
    message: " Variant Updated ",
  });
};
