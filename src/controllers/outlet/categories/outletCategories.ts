import { Request, Response } from "express";
import { getCategoryByOutletId, getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { redis } from "../../../services/redis";
import { getOAllMenuCategoriesToRedis } from "../../../lib/outlet/get-items";
import { generateSlug } from "../../../lib/utils";

export const getAllCategories = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const categories = await redis.get(`o-${outletId}-categories`);

  if (categories) {
    return res.json({
      success: true,
      categories: JSON.parse(categories),
      message: "POWEREDUP ⚡",
    });
  }
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getCategories = await getOAllMenuCategoriesToRedis(outlet.id);
  return res.json({
    success: true,
    categories: getCategories,
    message: "POWERINGUP.. ✅",
  });
};

export const createCategory = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const { name } = req.body;

  if (!name) {
    throw new BadRequestsException(
      "Outlet Not Found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.category.create({
    data: {
      name,
      slug: generateSlug(name),
      restaurantId: outlet.id,
    },
  });

  await getOAllMenuCategoriesToRedis(outlet.id);

  return res.json({
    success: true,
    message: "Category Created ",
  });
};

export const updateCategory = async (req: Request, res: Response) => {
  const { outletId, categoryId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const { name } = req.body;

  if (!name) {
    throw new BadRequestsException(
      "Outlet Not Found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const category = await getCategoryByOutletId(outlet.id, categoryId);

  await prismaDB.category.update({
    where: {
      restaurantId: outlet.id,
      id: category?.id,
    },
    data: {
      name,
    },
  });

  const getCategories = await prismaDB.category.findMany({
    where: {
      restaurantId: outlet.id,
    },
    include: {
      menuItems: true,
    },
  });

  await redis.set(`o-${outlet.id}-categories`, JSON.stringify(getCategories));

  return res.json({
    success: true,
    message: "Category Updated ",
  });
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { outletId, categoryId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const category = await getCategoryByOutletId(outlet.id, categoryId);

  if (!category?.id) {
    throw new NotFoundException("Category Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.category.delete({
    where: {
      restaurantId: outlet.id,
      id: category?.id,
    },
  });
  await getOAllMenuCategoriesToRedis(outlet.id);
  return res.json({
    success: true,
    message: "Category Deleted ",
  });
};
