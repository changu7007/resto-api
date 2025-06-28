import { Request, Response } from "express";
import { getCategoryByOutletId, getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { redis } from "../../../services/redis";
import {
  getOAllCategoriesToRedis,
  getOAllMenuCategoriesForOnlineAndDeliveryToRedis,
  getOAllMenuCategoriesToRedis,
} from "../../../lib/outlet/get-items";
import { generateSlug } from "../../../lib/utils";

export const getCategories = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const categories = await redis.get(`${outletId}-categories`);

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

  const getCategories = await getOAllCategoriesToRedis(outlet.id);

  return res.json({
    success: true,
    categories: getCategories,
    message: "POWERINGUP.. ✅",
  });
};

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

export const getAllDomainCategories = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const categories = await redis.get(`o-d-${outletId}-categories`);

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

  const getCategories = await getOAllMenuCategoriesForOnlineAndDeliveryToRedis(
    outlet.id
  );

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

  const { name, printLocationId } = req.body;

  const slug = generateSlug(name);

  if (!name) {
    throw new BadRequestsException(
      "Name Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (printLocationId !== undefined || printLocationId !== null) {
    const findPrintLocation = await prismaDB.printLocation.findFirst({
      where: {
        id: printLocationId,
      },
    });

    if (!findPrintLocation) {
      throw new NotFoundException(
        "The selected Print Location is not available",
        ErrorCode.NOT_FOUND
      );
    }
  }

  const checkSlug = await prismaDB.category.findFirst({
    where: {
      restaurantId: outlet.id,
      slug,
    },
  });

  if (checkSlug) {
    throw new BadRequestsException(
      "Category already exists",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.category.create({
    data: {
      name,
      slug,
      restaurantId: outlet.id,
      printLocationId: printLocationId,
    },
  });

  await Promise.all([
    redis.del(`o-${outlet.id}-categories`),
    redis.del(`${outlet.id}-categories`),
    redis.del(`o-d-${outletId}-categories`),
  ]);

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

  const { name, printLocationId } = req.body;

  const slug = generateSlug(name);

  if (!name) {
    throw new BadRequestsException(
      "Name Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const category = await getCategoryByOutletId(outlet.id, categoryId);

  const checkSlug = await prismaDB.category.findFirst({
    where: {
      NOT: {
        id: category?.id,
      },
      restaurantId: outlet.id,
      slug,
    },
  });

  if (checkSlug) {
    throw new BadRequestsException(
      "Category Name already exists",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (printLocationId !== undefined || printLocationId !== null) {
    const findPrintLocation = await prismaDB.printLocation.findFirst({
      where: {
        id: printLocationId,
      },
    });

    if (!findPrintLocation) {
      throw new NotFoundException(
        "The selected Print Location is not available",
        ErrorCode.NOT_FOUND
      );
    }
  }

  await prismaDB.category.update({
    where: {
      restaurantId: outlet.id,
      id: category?.id,
    },
    data: {
      name,
      slug,
      printLocationId,
    },
  });

  await Promise.all([
    redis.del(`o-${outlet.id}-categories`),
    redis.del(`${outlet.id}-categories`),

    redis.del(`o-d-${outletId}-categories`),
  ]);

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

  await Promise.all([
    redis.del(`o-${outlet.id}-categories`),
    redis.del(`o-d-${outletId}-categories`),
    redis.del(`${outlet.id}-categories`),
  ]);

  return res.json({
    success: true,
    message: "Category Deleted ",
  });
};
