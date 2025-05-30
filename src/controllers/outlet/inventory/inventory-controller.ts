import { Request, Response } from "express";
import { generatePurchaseNo, getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
  rawMaterialSchema,
} from "../../../schema/staff";
import { z } from "zod";
import { redis } from "../../../services/redis";
import {
  calculateFoodServerForItemRecipe,
  fetchOutletRawMaterialCAtegoryToRedis,
  fetchOutletRawMaterialsToRedis,
  fetchOutletRawMaterialUnitToRedis,
  getfetchOutletStocksToRedis,
} from "../../../lib/outlet/get-inventory";
import { UnauthorizedException } from "../../../exceptions/unauthorized";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { getOAllItems } from "../../../lib/outlet/get-items";
import { websocketManager } from "../../../services/ws";
import { generateSlug } from "../../../lib/utils";
import { GstType, PurchaseStatus } from "@prisma/client";

const unitSchema = z.object({
  name: z.string().min(1),
});

const rawMaterialCategorySchema = z.object({
  name: z.string().min(1),
});

export const getAllRawMaterials = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const rawMaterialsFromRedis = await redis.get(`${outletId}-raw-materials`);

  if (rawMaterialsFromRedis) {
    return res.json({
      success: true,
      rawMaterials: JSON.parse(rawMaterialsFromRedis),
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const rawMaterials = await fetchOutletRawMaterialsToRedis(outlet?.id);

  return res.json({
    success: true,
    rawMaterials: rawMaterials,
  });
};

export const createRawMaterial = async (req: Request, res: Response) => {
  const validateFields = rawMaterialSchema.parse(req.body);

  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);
  const slugName = generateSlug(validateFields.name);

  const rawMaterial = await prismaDB.rawMaterial.findFirst({
    where: {
      restaurantId: outlet?.id,
      slug: slugName,
    },
  });

  if (rawMaterial?.id) {
    throw new BadRequestsException(
      "Raw Material Already Exists",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.rawMaterial.create({
    data: {
      restaurantId: outlet?.id,
      name: validateFields.name,
      slug: slugName,
      shortcode: validateFields.barcode,
      categoryId: validateFields.categoryId,
      consumptionUnitId: validateFields.consumptionUnitId,
      conversionFactor: validateFields.conversionFactor,
      minimumStockLevelUnit: validateFields.minimumStockLevelUnitId,
      minimumStockLevel: validateFields.minimumStockLevel,
    },
  });

  await Promise.all([
    redis.del(`${outlet.id}-raw-materials`),
    redis.del(`${outlet.id}-stocks`),
  ]);

  return res.json({
    success: true,
    message: "Raw Material Created",
  });
};

export const updateRawMaterialById = async (req: Request, res: Response) => {
  const validateFields = rawMaterialSchema.parse(req.body);

  const { outletId, id } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const rawMaterial = await prismaDB.rawMaterial.findFirst({
    where: {
      restaurantId: outlet?.id,
      id: id,
    },
  });

  if (!rawMaterial?.id) {
    throw new NotFoundException(
      "Raw Material Not Found",
      ErrorCode.OUTLET_NOT_FOUND
    );
  }

  const slugName = generateSlug(validateFields.name);

  if (rawMaterial?.slug !== slugName) {
    const findSlug = await prismaDB.rawMaterial.findFirst({
      where: {
        restaurantId: outlet?.id,
        slug: slugName,
      },
    });

    if (findSlug?.id) {
      throw new BadRequestsException(
        "Raw Material Already Exists",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  }

  await prismaDB.rawMaterial.update({
    where: {
      id: rawMaterial?.id,
      restaurantId: outlet?.id,
    },
    data: {
      restaurantId: outlet?.id,
      name: validateFields.name,
      shortcode: validateFields.barcode,
      categoryId: validateFields.categoryId,
      conversionFactor: validateFields.conversionFactor,
      consumptionUnitId: validateFields.consumptionUnitId,
      minimumStockLevelUnit: validateFields.minimumStockLevelUnitId,
      minimumStockLevel: validateFields.minimumStockLevel,
    },
  });

  await Promise.all([
    redis.del(`${outlet.id}-raw-materials`),
    redis.del(`${outlet.id}-stocks`),
  ]);

  return res.json({
    success: true,
    message: "Raw Material Updated",
  });
};

export const getRawMaterialById = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const rawMaterial = await prismaDB.rawMaterial.findFirst({
    where: {
      restaurantId: outlet?.id,
      id: id,
    },
  });

  if (!rawMaterial?.id) {
    throw new NotFoundException(
      "Raw Material Not Found",
      ErrorCode.OUTLET_NOT_FOUND
    );
  }

  return res.json({
    success: true,
    rawMaterial,
    message: "Raw Material Updated",
  });
};

export const deleteRawMaterialById = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const rawMaterial = await prismaDB.rawMaterial.findFirst({
    where: {
      restaurantId: outlet?.id,
      id: id,
    },
  });

  if (!rawMaterial?.id) {
    throw new NotFoundException(
      "Raw Material Not Found",
      ErrorCode.OUTLET_NOT_FOUND
    );
  }

  await prismaDB.rawMaterial.delete({
    where: {
      id: rawMaterial?.id,
      restaurantId: outlet?.id,
    },
  });

  await Promise.all([
    redis.del(`${outlet.id}-raw-materials`),
    redis.del(`${outlet.id}-stocks`),
  ]);

  return res.json({
    success: true,
    message: "Raw Material Deleted",
  });
};

export const getAllRawMaterialCategory = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const rawMaterialsCategoriesFromRedis = await redis.get(
    `${outletId}-raw-materials-category`
  );

  if (rawMaterialsCategoriesFromRedis) {
    return res.json({
      success: true,
      categories: JSON.parse(rawMaterialsCategoriesFromRedis),
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const rawMaterialsCategory = await fetchOutletRawMaterialCAtegoryToRedis(
    outlet?.id
  );

  return res.json({
    success: true,
    categories: rawMaterialsCategory,
  });
};

export const createUnit = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const validateFields = unitSchema.parse(req.body);

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.unit.create({
    data: {
      restaurantId: outlet?.id,
      name: validateFields.name,
      slug: generateSlug(validateFields.name),
    },
  });

  const rawMaterialsUnit = await prismaDB.unit.findMany({
    where: {
      restaurantId: outletId,
    },
  });

  await redis.set(
    `${outletId}-raw-materials-unit`,
    JSON.stringify(rawMaterialsUnit)
  );

  return res.json({
    success: true,
    message: "Unit Created Success ✅",
  });
};

export const getUnitById = async (req: Request, res: Response) => {
  const { outletId, unitId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const unit = await prismaDB.unit.findFirst({
    where: {
      restaurantId: outlet?.id,
      id: unitId,
    },
  });

  if (!unit?.id) {
    throw new NotFoundException("Unit Not Found", ErrorCode.NOT_FOUND);
  }

  return res.json({
    success: true,
    unit,
    message: "Unit Updated Success ✅",
  });
};

export const updateUnitById = async (req: Request, res: Response) => {
  const { outletId, unitId } = req.params;

  const validateFields = unitSchema.parse(req.body);

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const unit = await prismaDB.unit.findFirst({
    where: {
      restaurantId: outlet?.id,
      id: unitId,
    },
  });

  if (!unit?.id) {
    throw new NotFoundException("Unit Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.unit.update({
    where: {
      id: unit?.id,
      restaurantId: outlet?.id,
    },
    data: {
      name: validateFields.name,
    },
  });
  await fetchOutletRawMaterialUnitToRedis(outlet?.id);

  return res.json({
    success: true,
    message: "Unit Updated Success ✅",
  });
};

export const deleteUnitById = async (req: Request, res: Response) => {
  const { outletId, unitId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const unit = await prismaDB.unit.findFirst({
    where: {
      restaurantId: outlet?.id,
      id: unitId,
    },
  });

  if (!unit?.id) {
    throw new NotFoundException("Unit Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.unit.delete({
    where: {
      id: unit?.id,
      restaurantId: outlet?.id,
    },
  });

  await fetchOutletRawMaterialUnitToRedis(outlet?.id);

  return res.json({
    success: true,
    message: "Unit Deleted Success ✅",
  });
};

export const createRawMaterialCategory = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const validateFields = rawMaterialCategorySchema.parse(req.body);

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.rawMaterialCategory.create({
    data: {
      restaurantId: outlet?.id,
      name: validateFields.name,
      slug: generateSlug(validateFields.name),
    },
  });

  await fetchOutletRawMaterialCAtegoryToRedis(outlet?.id);

  return res.json({
    success: true,
    message: "Category Created Success ✅",
  });
};

export const getCategoryById = async (req: Request, res: Response) => {
  const { outletId, categoryId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const category = await prismaDB.rawMaterialCategory.findFirst({
    where: {
      restaurantId: outlet?.id,
      id: categoryId,
    },
  });

  if (!category?.id) {
    throw new NotFoundException("Category Not Found", ErrorCode.NOT_FOUND);
  }

  return res.json({
    success: true,
    category,
    message: "Category Updated Success ✅",
  });
};

export const updateCategoryById = async (req: Request, res: Response) => {
  const { outletId, categoryId } = req.params;

  const validateFields = rawMaterialCategorySchema.parse(req.body);

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const category = await prismaDB.rawMaterialCategory.findFirst({
    where: {
      restaurantId: outlet?.id,
      id: categoryId,
    },
  });

  if (!category?.id) {
    throw new NotFoundException("Category Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.rawMaterialCategory.update({
    where: {
      id: category?.id,
      restaurantId: outlet?.id,
    },
    data: {
      name: validateFields.name,
    },
  });

  await fetchOutletRawMaterialCAtegoryToRedis(outlet?.id);

  return res.json({
    success: true,
    message: "Category Updated Success ✅",
  });
};

export const deleteCategoryById = async (req: Request, res: Response) => {
  const { outletId, categoryId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const category = await prismaDB.rawMaterialCategory.findFirst({
    where: {
      restaurantId: outlet?.id,
      id: categoryId,
    },
  });

  if (!category?.id) {
    throw new NotFoundException("Category Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.rawMaterialCategory.delete({
    where: {
      id: category?.id,
      restaurantId: outlet?.id,
    },
  });

  await fetchOutletRawMaterialCAtegoryToRedis(outlet?.id);

  return res.json({
    success: true,
    message: "Category Deleted Success ✅",
  });
};

export const getAllRawMaterialUnit = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const rawMaterialsUnitFromRedis = await redis.get(
    `${outletId}-raw-materials-unit`
  );

  if (rawMaterialsUnitFromRedis) {
    return res.json({
      success: true,
      units: JSON.parse(rawMaterialsUnitFromRedis),
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const rawMaterialsUnit = await prismaDB.unit.findMany({
    where: {
      restaurantId: outletId,
    },
  });

  await redis.set(
    `${outletId}-raw-materials-unit`,
    JSON.stringify(rawMaterialsUnit)
  );

  return res.json({
    success: true,
    units: rawMaterialsUnit,
  });
};

export const getAllPurcahses = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const allPurchasesFromRedis = await redis.get(`${outletId}-purchases`);

  if (allPurchasesFromRedis) {
    return res.json({
      success: true,
      allPurchases: JSON.parse(allPurchasesFromRedis),
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const allPurchases = await prismaDB.purchase.findMany({
    where: {
      restaurantId: outlet?.id,
    },
    include: {
      purchaseItems: {
        include: {
          purchaseUnit: true,
          rawMaterial: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await redis.set(
    `${outletId}-purchases`,
    JSON.stringify(allPurchases),
    "EX",
    60 * 60 * 3
  );

  return res.json({
    success: true,
    allPurchases,
  });
};

const purchaseRequestFormSchema = z.object({
  vendorId: z
    .string({
      required_error: "Vendor Is Required",
    })
    .min(1, { message: "Vendor Is Required" }),
  rawMaterials: z.array(
    z.object({
      id: z.string().optional(),
      rawMaterialId: z.string().min(1, { message: "Raw Material Is Required" }),
      rawMaterialName: z.string().min(1, { message: "Raw Material Name" }),
      unitName: z.string().min(1, { message: "Unit Name is required" }),
      requestUnitId: z.string().min(1, { message: "Request Unit is Required" }),
      requestQuantity: z.coerce
        .number()
        .min(0, { message: "Request Quantity is Required" }),
      netRate: z.number().optional(),
      gstType: z.nativeEnum(GstType),
      taxAmount: z.number().optional(),
      totalAmount: z.number().optional(),
    })
  ),
  summary: z
    .object({
      totalItems: z.number(),
      subTotal: z.number(),
      totalTax: z.number(),
      grandTotal: z.number(),
    })
    .optional(),
});

export const createRequestPurchase = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  // const validateFields
  const { data: validateFields, error } = purchaseRequestFormSchema.safeParse(
    req.body
  );

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user.id;
  // @ts-ignore
  const username = `${req?.user?.name}-(${req?.user?.role})`;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findVendor = await prismaDB.vendor.findFirst({
    where: {
      restaurantId: outlet.id,
      id: validateFields.vendorId,
    },
  });

  if (!findVendor?.id) {
    throw new NotFoundException("Vendor Not found", ErrorCode.NOT_FOUND);
  }

  const invoiceNo = await generatePurchaseNo(outlet.id);

  await prismaDB.$transaction(async (prisma) => {
    await prisma.purchase.create({
      data: {
        invoiceNo: invoiceNo,
        restaurantId: outlet.id,
        vendorId: findVendor.id,
        createdBy: username,
        isPaid: false,
        purchaseItems: {
          create: validateFields.rawMaterials.map((item) => ({
            rawMaterialId: item?.rawMaterialId,
            rawMaterialName: item?.rawMaterialName,
            purchaseQuantity: item?.requestQuantity,
            purchaseUnitId: item?.requestUnitId,
            purchaseUnitName: item?.unitName,
            gstType: item?.gstType,
            netRate: item?.netRate,
            taxAmount: item?.taxAmount,
            purchasePrice: item?.totalAmount,
          })),
        },
        subTotal: validateFields.summary?.subTotal,
        totalAmount: validateFields.summary?.grandTotal,
        taxes: validateFields.summary?.totalTax,
      },
    });

    await redis.del(`${outletId}-purchases`);
  });
  return res.json({
    success: true,
    message: "Request Purchase Created",
  });
};

export const createRaiseRequestPurchase = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  // const validateFields
  const { data: validateFields, error } = purchaseRequestFormSchema.safeParse(
    req.body
  );

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user.id;
  // @ts-ignore
  const username = `${req?.user?.name}-(${req?.user?.role})`;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const findVendor = await prismaDB.vendor.findFirst({
    where: {
      restaurantId: outlet.id,
      id: validateFields.vendorId,
    },
  });

  if (!findVendor?.id) {
    throw new NotFoundException("Vendor Not found", ErrorCode.NOT_FOUND);
  }

  const invoiceNo = await generatePurchaseNo(outlet.id);

  await prismaDB.$transaction(async (prisma) => {
    await prisma.purchase.create({
      data: {
        invoiceNo: invoiceNo,
        restaurantId: outlet.id,
        vendorId: findVendor.id,
        createdBy: username,
        isPaid: false,
        purchaseItems: {
          create: validateFields.rawMaterials.map((item) => ({
            rawMaterialId: item?.rawMaterialId,
            rawMaterialName: item?.rawMaterialName,
            purchaseQuantity: item?.requestQuantity,
            purchaseUnitId: item?.requestUnitId,
            purchaseUnitName: item?.unitName,
            gstType: item?.gstType,
            netRate: item?.netRate,
            taxAmount: item?.taxAmount,
            purchasePrice: item?.totalAmount,
          })),
        },
        purchaseStatus: "REQUESTED",
        subTotal: validateFields.summary?.subTotal,
        totalAmount: validateFields.summary?.grandTotal,
        taxes: validateFields.summary?.totalTax,
      },
    });

    await redis.del(`${outletId}-purchases`);
  });
  return res.json({
    success: true,
    message: "Purchase Order Raised",
  });
};

export const updateRequestPurchase = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;

  // const validateFields
  const { data: validateFields, error } = purchaseRequestFormSchema.safeParse(
    req.body
  );

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user.id;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findVendor = await prismaDB.vendor.findFirst({
    where: {
      restaurantId: outlet.id,
      id: validateFields.vendorId,
    },
  });

  if (!findVendor?.id) {
    throw new NotFoundException("Vendor Not found", ErrorCode.NOT_FOUND);
  }
  const findPurchase = await prismaDB.purchase.findFirst({
    where: {
      id: id,
      restaurantId: outlet?.id,
    },
    include: {
      purchaseItems: true,
    },
  });

  if (!findPurchase?.id) {
    throw new NotFoundException(
      "No Requested Purchases found",
      ErrorCode.NOT_FOUND
    );
  }

  //prepare purchaseItems to update & delete
  const existingPurchaseItems = findPurchase?.purchaseItems?.map((pi) => pi.id);
  const incommingItems = validateFields?.rawMaterials
    ?.map((i) => i?.id)
    .filter(Boolean);

  // Determine purchaseItem to delete (those in existing but not in incoming)
  const purchaseItemsToDelete = existingPurchaseItems.filter(
    (id) => !incommingItems.includes(id)
  );

  // Prepare transaction for atomic update
  await prismaDB.$transaction(async (prisma) => {
    //update purchase details
    await prismaDB.purchase.update({
      where: {
        id: findPurchase?.id,
        restaurantId: outlet?.id,
      },
      data: {
        vendorId: findVendor.id,
        isPaid: false,
        subTotal: validateFields.summary?.subTotal,
        totalAmount: validateFields.summary?.grandTotal,
        taxes: validateFields.summary?.totalTax,
      },
    });
    // Handle purchaseItems updates in a single operation
    if (validateFields?.rawMaterials?.length > 0) {
      // Perform upsert operations for ingredients
      const purchaseItemsUpserts = validateFields.rawMaterials.map((item) => {
        // If ingredientId exists, it's an update. Otherwise, it's a create
        return item.id
          ? prisma.purchaseItems.update({
              where: {
                id: item?.id,
                purchaseId: findPurchase?.id,
              },
              data: {
                rawMaterialId: item.rawMaterialId,
                rawMaterialName: item.rawMaterialName,
                purchaseQuantity: item.requestQuantity,
                purchaseUnitId: item?.requestUnitId,
                purchaseUnitName: item?.unitName,
                gstType: item?.gstType,
                netRate: item?.netRate,
                taxAmount: item?.taxAmount,
                purchasePrice: item?.totalAmount,
              },
            })
          : prisma.purchaseItems.create({
              data: {
                purchaseId: findPurchase?.id,
                rawMaterialId: item?.rawMaterialId,
                rawMaterialName: item.rawMaterialName,
                purchaseQuantity: item.requestQuantity,
                purchaseUnitId: item.requestUnitId,
                purchaseUnitName: item.unitName,
                gstType: item?.gstType,
                netRate: item?.netRate,
                taxAmount: item?.taxAmount,
                purchasePrice: item?.totalAmount,
              },
            });
      });

      // Execute all upsert operations
      await Promise.all(purchaseItemsUpserts);
    }

    // Delete ingredients that are no longer in the recipe
    if (purchaseItemsToDelete.length > 0) {
      await prisma.purchaseItems.deleteMany({
        where: {
          id: { in: purchaseItemsToDelete },
          purchaseId: findPurchase?.id,
        },
      });
    }
  });

  await redis.del(`${outletId}-purchases`);
  return res.json({
    success: true,
    message: "Request Purchase Updated",
  });
};

export const deleteRequestPurchase = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user.id;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findPurchase = await prismaDB.purchase.findFirst({
    where: {
      id: id,
      restaurantId: outlet?.id,
    },
  });

  if (!findPurchase?.id) {
    throw new NotFoundException(
      "No Requested Purchases found",
      ErrorCode.NOT_FOUND
    );
  }

  await prismaDB.purchase.delete({
    where: {
      id: findPurchase?.id,
      restaurantId: outlet?.id,
    },
  });

  await redis.del(`${outletId}-purchases`);
  return res.json({
    success: true,
    message: "Request Purchase Deleted ✅",
  });
};

export const cancelRequestPurchase = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user.id;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findPurchase = await prismaDB.purchase.findFirst({
    where: {
      id: id,
      restaurantId: outlet?.id,
    },
  });

  if (!findPurchase?.id) {
    throw new NotFoundException(
      "No Requested Purchases found",
      ErrorCode.NOT_FOUND
    );
  }

  await prismaDB.purchase.update({
    where: {
      id: findPurchase?.id,
      restaurantId: outlet?.id,
    },
    data: {
      purchaseStatus: "CANCELLED",
    },
  });

  await redis.del(`${outletId}-purchases`);
  return res.json({
    success: true,
    message: "Request Purchase Cancelled ✅",
  });
};

const validatePurchaseSchema = z.object({
  id: z.string().min(1, { message: "Purchase Id Missing" }),
  vendorId: z
    .string({ required_error: "Vendor is Missing" })
    .min(1, { message: "Vendor is Missing" }),
  rawMaterials: z
    .array(
      z.object({
        id: z.string().min(1, { message: "Purchase Item Id is missing" }),
        rawMaterialId: z
          .string({ required_error: "Raw Material is required" })
          .min(1, { message: "Raw Material Is Required" }),
        rawMaterialName: z.string().min(1, { message: "Raw Material Name" }),
        unitName: z.string().min(1, { message: "Unit Name is required" }),
        requestUnitId: z
          .string({ required_error: "Request Unit is Required" })
          .min(1, { message: "Request Unit is Required" }),

        requestQuantity: z.coerce
          .number()
          .min(0, { message: "Request Quantity is Required" }),
        netRate: z.coerce.number(),
        gstType: z.nativeEnum(GstType),
        taxAmount: z.coerce.number(),
        totalRate: z.coerce
          .number()
          .min(0, { message: "Purchase price is required" }),
      })
    )
    .min(1, { message: "Atleast 1 Raw Material you need to request" }),
  isPaid: z.boolean({ required_error: "You need to choose" }),
  billImage: z.string().optional(),
  amountToBePaid: z.coerce.number().min(0, { message: "Amount Required" }),
  chooseInvoice: z
    .enum(["generateInvoice", "uploadInvoice"], {
      required_error: "You need to select a invoice type.",
    })
    .optional(),
  paymentMethod: z
    .enum(["CASH", "UPI", "DEBIT", "CREDIT"], {
      required_error: "Settlement Payment Method Required.",
    })
    .optional(),
});

export const validatePurchasenRestock = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;

  const { data: validateFields, error } = validatePurchaseSchema.safeParse(
    req.body
  );

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (validateFields?.isPaid && validateFields?.paymentMethod === undefined) {
    throw new BadRequestsException(
      "Please select your payment settlement mode",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (validateFields?.amountToBePaid < 1) {
    throw new BadRequestsException(
      "You have selected IsPaid, Please Input the Amount you Paid",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user?.id;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findPurchase = await prismaDB.purchase.findFirst({
    where: {
      id,
      restaurantId: outlet?.id,
    },
  });

  if (!findPurchase?.id) {
    throw new NotFoundException(
      "Purchase Not Found to Validate",
      ErrorCode.NOT_FOUND
    );
  }

  const findVendor = await prismaDB.vendor.findFirst({
    where: {
      restaurantId: outlet.id,
      id: validateFields.vendorId,
    },
  });

  if (!findVendor?.id) {
    throw new NotFoundException("Vendor Not Found", ErrorCode.NOT_FOUND);
  }

  const transaction = await prismaDB.$transaction(async (prisma) => {
    // Step 1: Restock raw materials and update `RecipeIngredient` costs
    await Promise.all(
      validateFields?.rawMaterials?.map(async (item) => {
        const rawMaterial = await prisma.rawMaterial.findFirst({
          where: {
            id: item.rawMaterialId,
            restaurantId: outlet?.id,
          },
          include: {
            RecipeIngredient: true,
          },
        });

        if (rawMaterial) {
          console.log(
            `Raw Material Restocking started for ${rawMaterial?.name}, the old stock is ${rawMaterial?.currentStock}`
          );
          const newStock =
            Number(rawMaterial?.currentStock ?? 0) + item?.requestQuantity;
          console.log(
            `New Stock Calculated for ${rawMaterial?.name}: ${newStock}`
          );
          const newPricePerItem =
            Number(item.totalRate) / Number(item.requestQuantity);
          console.log(
            `New Price Per Item Calculated for ${rawMaterial?.name}: ${newPricePerItem}`
          );

          const updatedRawMaterial = await prisma.rawMaterial.update({
            where: {
              id: rawMaterial.id,
            },
            data: {
              currentStock: newStock,
              purchasedPrice: item.totalRate,
              purchasedPricePerItem: newPricePerItem,
              purchasedUnit: item.unitName,
              lastPurchasedPrice: rawMaterial?.purchasedPrice ?? 0,
              purchasedStock: item.requestQuantity,
            },
          });
          console.log(
            `Raw Material Restocking completed for ${rawMaterial?.name}, updated raw material stock: ${updatedRawMaterial?.currentStock}`
          );
          // Update related alerts to resolved
          await prismaDB.alert.deleteMany({
            where: {
              restaurantId: outlet.id,
              itemId: rawMaterial?.id,
              status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
            },
          });

          const findRecipeIngredients = await prisma.recipeIngredient.findFirst(
            {
              where: {
                rawMaterialId: rawMaterial?.id,
              },
            }
          );
          console.log(`finding recipe ingredients for ${rawMaterial?.name}`);
          if (findRecipeIngredients) {
            console.log(`recipe ingredients found for ${rawMaterial?.name}`);
            const recipeCostWithQuantity =
              Number(findRecipeIngredients?.quantity) /
              Number(rawMaterial?.conversionFactor);
            console.log(
              `recipe cost with quantity for ${rawMaterial?.name}: ${recipeCostWithQuantity}`
            );
            const ingredientCost = recipeCostWithQuantity * newPricePerItem;
            console.log(
              `ingredient cost for ${rawMaterial?.name}: ${ingredientCost}`
            );
            // Update linked `RecipeIngredient` cost
            await prisma.recipeIngredient.updateMany({
              where: {
                rawMaterialId: rawMaterial.id,
              },
              data: {
                cost: ingredientCost,
              },
            });
            console.log(`recipe ingredient updated for ${rawMaterial?.name}`);
          }
        }
      })
    );
    console.log(`Raw Materials Restocking completed for all items`);
    // Step 2: Recalculate `ItemRecipe` gross margin and related fields
    const recipesToUpdate = await prisma.itemRecipe.findMany({
      where: {
        restaurantId: outlet.id,
        ingredients: {
          some: {
            rawMaterial: {
              restaurantId: outlet.id,
              id: {
                in: validateFields?.rawMaterials?.map(
                  (item) => item.rawMaterialId
                ),
              },
            },
          },
        },
      },
      include: {
        ingredients: {
          include: {
            rawMaterial: true,
          },
        },
      },
    });
    console.log(
      `Recipes to update started for ${recipesToUpdate?.length} recipes`
    );

    await Promise.all(
      recipesToUpdate.map(async (recipe) => {
        console.log(`Recipe to update started for ${recipe?.name}`);
        const totalCost = recipe.ingredients.reduce(
          (sum, ingredient) =>
            sum +
            (Number(ingredient.quantity) /
              Number(ingredient?.rawMaterial?.conversionFactor)) *
              Number(ingredient?.rawMaterial?.purchasedPricePerItem),
          0
        );
        console.log(`Total cost for ${recipe?.name}: ${totalCost}`);
        const grossMargin = Number(recipe.itemPrice as number) - totalCost;
        console.log(`Gross margin for ${recipe?.name}: ${grossMargin}`);

        await prisma.itemRecipe.update({
          where: {
            id: recipe.id,
          },
          data: {
            itemCost: totalCost,
            grossMargin,
          },
        });
        console.log(`Recipe updated for ${recipe?.name}`);
        // Update linked entities
        if (recipe.menuId) {
          await prisma.menuItem.update({
            where: {
              id: recipe.menuId,
              restaurantId: outlet.id,
            },
            data: {
              grossProfit: grossMargin,
            },
          });
          console.log(`Menu Item updated for ${recipe?.name}`);
        }

        if (recipe.menuVariantId) {
          await prisma.menuItemVariant.update({
            where: {
              id: recipe.menuVariantId,
              restaurantId: outlet.id,
            },
            data: {
              grossProfit: grossMargin,
            },
          });
        }

        if (recipe.addonItemVariantId) {
          await prisma.addOnVariants.update({
            where: {
              id: recipe.addonItemVariantId,
              restaurantId: outlet.id,
            },
            data: {
              grossProfit: grossMargin,
            },
          });
        }
      })
    );

    // Step 3: Update purchase details
    const updatePurchase = await prisma.purchase.update({
      where: {
        id: findPurchase?.id,
        restaurantId: outlet?.id,
      },
      data: {
        isPaid: validateFields?.paymentMethod !== undefined,
        paymentMethod: validateFields?.paymentMethod,
        billImageUrl: validateFields?.billImage,
        invoiceType: validateFields?.chooseInvoice,
        purchaseStatus: "COMPLETED",
        purchaseItems: {
          update: validateFields?.rawMaterials?.map((item) => ({
            where: {
              id: item?.id,
              purchaseId: validateFields?.id,
            },
            data: {
              purchasePrice: item?.totalRate,
            },
          })),
        },
      },
    });

    //register with cash register
    if (validateFields?.isPaid && validateFields.paymentMethod !== undefined) {
      await prisma.expenses.create({
        data: {
          restaurantId: outletId,
          category: "Ingredients",
          amount: validateFields?.amountToBePaid,
          date: new Date(),
          description: `${findVendor?.name} - Purchase (${findPurchase?.invoiceNo})`,
          paymentMethod: validateFields?.paymentMethod,
        },
      });
    }

    return updatePurchase;
  });

  if (transaction?.id) {
    websocketManager.notifyClients(outletId, "NEW_ALERT");

    await Promise.all([
      redis.del(`${outletId}-purchases`),
      redis.del(`${outletId}-stocks`),
      redis.del(`${outletId}-vendors`),
      redis.del(`${outletId}-raw-materials`),
      redis.del(`alerts-${outletId}`),
    ]);

    return res.json({
      success: true,
      message: "Purchase Validated, Restocked, and Recipes Updated",
    });
  }
};

export const getPurchaseId = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const purchase = await prismaDB.purchase.findFirst({
    where: {
      id: id,
      restaurantId: outlet.id,
    },
    include: {
      purchaseItems: {
        include: {
          purchaseUnit: true,
          rawMaterial: true,
        },
      },
    },
  });

  if (!purchase?.id) {
    throw new NotFoundException(
      "Purchased Conent Not Found",
      ErrorCode.NOT_FOUND
    );
  }
  return res.json({
    success: true,
    purchase: purchase,
  });
};

const vendorFormSchema = z.object({
  name: z.string({ required_error: "Vendor name is required" }).min(1, {
    message: "Vendor name is required",
  }),
  categoryId: z.string({ required_error: "Category is required" }).min(1, {
    message: "Category is required",
  }),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  isContract: z.boolean().default(false),
  rawMaterials: z
    .array(
      z.object({
        id: z.string().optional(),
        rawMaterialId: z
          .string()
          .min(1, { message: "Raw Material Is Required" }),
        rawMaterialName: z.string().min(1, { message: "Raw Material Name" }),
        unitId: z.string().min(1, { message: "Unit is Required" }),
        unitName: z.string().min(1, { message: "Unit Name is required" }),
        netRate: z.coerce
          .number({ required_error: "Rate is required" })
          .min(0.01, { message: "Rate must be greater than 0" }),
        gstType: z.nativeEnum(GstType, {
          required_error: "GST Type is required",
        }),
        taxAmount: z.coerce
          .number({ required_error: "Tax Amount is required" })
          .min(0, { message: "Tax amount must be positive" }),
        totalRate: z.coerce
          .number({ required_error: "Total Rate is required" })
          .min(0, { message: "Rate must be positive" }),
        validFrom: z.string(),
        validTo: z.string(),
      })
    )
    .optional(),
});

export const createVendor = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const validateFields = vendorFormSchema.safeParse(req.body);

  if (!validateFields.success) {
    throw new BadRequestsException(
      validateFields.error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const slugName = generateSlug(validateFields.data.name);

  const findSlug = await prismaDB.vendor.findFirst({
    where: {
      slug: slugName,
      restaurantId: outlet.id,
    },
  });

  if (findSlug?.id) {
    throw new BadRequestsException(
      "Vendor Already Exists",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.vendor.create({
    data: {
      restaurantId: outlet?.id,
      name: validateFields.data.name,
      slug: slugName,
      categoryId: validateFields.data.categoryId,
      contactName: validateFields.data.contactName,
      phone: validateFields.data.phone,
      email: validateFields.data.email,
      isContract: validateFields.data.isContract,
      contractRates: {
        create: validateFields.data.rawMaterials?.map((item) => ({
          rawMaterialId: item.rawMaterialId,
          rawMaterialName: item.rawMaterialName,
          unitId: item.unitId,
          unitName: item.unitName,
          netRate: item.netRate,
          gstType: item.gstType,
          taxAmount: item.taxAmount,
          totalRate: item.totalRate,
          validFrom: new Date(item.validFrom),
          validTo: new Date(item.validTo),
        })),
      },
    },
  });

  await redis.del(`${outlet.id}-vendors`);
  return res.json({
    success: true,
    message: "Vendor Created Success ✅",
  });
};

export const updateVendor = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;
  const validateFields = vendorFormSchema.parse(req.body);
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const vendor = await prismaDB.vendor.findFirst({
    where: {
      id: id,
      restaurantId: outlet.id,
    },
    include: {
      contractRates: {
        include: {
          rawMaterial: true,
          unit: true,
        },
      },
    },
  });

  if (!vendor?.id) {
    throw new NotFoundException("Vendor Not Found", ErrorCode.NOT_FOUND);
  }
  const slugName = generateSlug(validateFields.name);

  if (slugName !== vendor.slug) {
    const findSlug = await prismaDB.vendor.findFirst({
      where: {
        slug: slugName,
        restaurantId: outlet.id,
      },
    });

    if (findSlug?.id) {
      throw new BadRequestsException(
        "Vendor Already Exists",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  }

  const existingContractRates = vendor.contractRates.map((rate) => rate.id);

  const newContractRates = validateFields.rawMaterials
    ?.map((i) => i?.id)
    .filter(Boolean);

  const deleteContractRates = existingContractRates.filter(
    (id) => !newContractRates?.includes(id)
  );

  await prismaDB.$transaction(async (tx) => {
    //update vendor
    await tx.vendor.update({
      where: {
        id: vendor.id,
        restaurantId: outlet.id,
      },
      data: {
        name: validateFields.name,
        slug: slugName,
        categoryId: validateFields.categoryId,
        contactName: validateFields.contactName,
        phone: validateFields.phone,
        email: validateFields.email,
        isContract: validateFields.isContract,
      },
    });

    if (
      validateFields.isContract &&
      validateFields?.rawMaterials &&
      validateFields?.rawMaterials?.length > 0
    ) {
      const contractRatesUpsert = validateFields.rawMaterials.map((item) => {
        return item?.id
          ? tx.vendorContractRate.update({
              where: {
                id: item.id,
                vendorId: vendor.id,
              },
              data: {
                rawMaterialId: item.rawMaterialId,
                rawMaterialName: item.rawMaterialName,
                unitId: item.unitId,
                unitName: item.unitName,
                netRate: item.netRate,
                gstType: item.gstType,
                taxAmount: item.taxAmount,
                totalRate: item.totalRate,
                validFrom: new Date(item.validFrom),
                validTo: new Date(item.validTo),
              },
            })
          : tx.vendorContractRate.create({
              data: {
                vendorId: vendor.id,
                rawMaterialId: item.rawMaterialId,
                rawMaterialName: item.rawMaterialName,
                unitId: item.unitId,
                unitName: item.unitName,
                netRate: item.netRate,
                gstType: item.gstType,
                taxAmount: item.taxAmount,
                totalRate: item.totalRate,
                validFrom: new Date(item.validFrom),
                validTo: new Date(item.validTo),
              },
            });
      });

      await Promise.all(contractRatesUpsert);

      if (deleteContractRates?.length > 0) {
        await tx.vendorContractRate.deleteMany({
          where: {
            id: {
              in: deleteContractRates,
            },
            vendorId: vendor.id,
          },
        });
      }
    }
  });

  await redis.del(`${outlet.id}-vendors`);
  return res.json({
    success: true,
    message: "Vendor Updated Success ✅",
  });
};

export const deleteVendor = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const vendor = await prismaDB.vendor.findFirst({
    where: {
      id: id,
      restaurantId: outlet.id,
    },
  });

  if (!vendor?.id) {
    throw new NotFoundException("Vendor Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.vendor.delete({
    where: {
      id: vendor.id,
      restaurantId: outlet.id,
    },
  });

  await redis.del(`${outlet.id}-vendors`);
  return res.json({
    success: true,
    message: "Vendor Deleted Success ✅",
  });
};

export const getAllVendors = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const redisVendors = await redis.get(`${outletId}-vendors`);

  if (redisVendors) {
    return res.json({
      success: true,
      vendors: JSON.parse(redisVendors),
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  const vendors = await prismaDB.vendor.findMany({
    where: {
      restaurantId: outlet?.id,
    },
    include: {
      purchases: {
        include: {
          purchaseItems: {
            include: {
              purchaseUnit: true,
              rawMaterial: true,
            },
          },
        },
      },
      contractRates: {
        include: {
          rawMaterial: true,
          unit: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await redis.set(
    `${outlet.id}-vendors`,
    JSON.stringify(vendors),
    "EX",
    60 * 60 * 12 // 24 hours
  );
  return res.json({
    success: true,
    vednors: vendors,
    message: "Vendors Fetched ✅",
  });
};

export const getAllVendorCategories = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const redisVendorsCategories = await redis.get(
    `${outletId}-vendors-categories`
  );

  if (redisVendorsCategories) {
    return res.json({
      success: true,
      vendorsCategories: JSON.parse(redisVendorsCategories),
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  const vendorsCategories = await prismaDB.vendorCategory.findMany({
    where: {
      restaurantId: outlet?.id,
    },
    select: {
      id: true,
      name: true,
    },
  });

  await redis.set(
    `${outlet.id}-vendors-categories`,
    JSON.stringify(vendorsCategories),
    "EX",
    60 * 60 * 24 // 24 hours
  );

  return res.json({
    success: true,
    vendorsCategories: vendorsCategories,
    message: "Vendors Categories Fetched ✅",
  });
};

const vendorCategoryFormSchema = z.object({
  name: z
    .string({
      required_error: "Name is required",
    })
    .min(1, {
      message: "Name is required",
    }),
});

export const createVendorCategory = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const validateFields = vendorCategoryFormSchema.safeParse(req.body);

  if (!validateFields.success) {
    throw new BadRequestsException(
      validateFields.error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const slugName = generateSlug(validateFields.data.name);

  const findSlug = await prismaDB.vendorCategory.findFirst({
    where: {
      slug: slugName,
      restaurantId: outlet.id,
    },
  });

  if (findSlug?.id) {
    throw new BadRequestsException(
      "Vendor Category Already Exists",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.vendorCategory.create({
    data: {
      restaurantId: outlet.id,
      name: validateFields.data.name,
      slug: slugName,
    },
  });

  await redis.del(`${outlet.id}-vendors-categories`);

  return res.json({
    success: true,
    message: "Vendor Category Created Successfully",
  });
};

export const allStocks = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const redisStocks = await redis.get(`${outletId}-stocks`);

  if (redisStocks) {
    return res.json({
      success: true,
      stocks: JSON.parse(redisStocks),
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const rawMaterials = await prismaDB.rawMaterial.findMany({
    where: {
      restaurantId: outlet?.id,
    },
    include: {
      rawMaterialCategory: true,
      consumptionUnit: true,
      minimumStockUnit: true,
    },
  });

  const formattedStocks = rawMaterials?.map((rawItem) => ({
    id: rawItem?.id,
    name: rawItem?.name,
    consumptionUnit: rawItem.consumptionUnit.name,
    stock: `${rawItem.currentStock?.toFixed(2)} - ${rawItem?.purchasedUnit}`,
    minStockLevel: `${rawItem?.minimumStockLevel?.toFixed(2)} - ${
      rawItem?.minimumStockUnit?.name
    }`,
    purchasedPrice: rawItem?.purchasedPrice,
    lastPurchasedPrice: rawItem?.lastPurchasedPrice,
    purchasedPricePerItem: rawItem?.purchasedPricePerItem,
    purchasedStock: `${rawItem.currentStock?.toFixed(2)} - ${
      rawItem?.purchasedUnit
    }`,
    createdAt: rawItem.createdAt,
  }));

  await redis.set(
    `${outletId}-stocks`,
    JSON.stringify(formattedStocks),
    "EX",
    60 * 60 * 12 // 12 hours
  );
  return res.json({
    success: true,
    stocks: formattedStocks,
  });
};

const recipeSchema = z.object({
  recipeType: z.enum(["RECIPE", "PREP_RECIPE"], {
    invalid_type_error: "invalid type",
    required_error: "Need to select your recipe type",
  }),
  recipeFor: z.enum(["MENU_ITEMS", "MENU_VARIANTS", "ADD_ONS"], {
    invalid_type_error: "invalid type",
    required_error: "Need to select your recipe For",
  }),
  itemId: z.string({
    invalid_type_error: "itemId should be a string",
    required_error: "you need to select an Item",
  }),
  ingredients: z
    .array(
      z.object({
        ingredientId: z.string().optional(),
        rawMaterialId: z.string({
          invalid_type_error: "rawMaterial should be a string",
          required_error: "you need to select a ingredient",
        }),
        mou: z.string({
          invalid_type_error: "Quantity should be a string",
          required_error: "quantity is required",
        }),
        quantity: z.coerce.number({
          invalid_type_error: "Quantity should be a number",
          required_error: "quantity is required",
        }),
        wastage: z.coerce.number({
          invalid_type_error: "Wastage should be a number",
          required_error: "Wastage is required",
        }),
        cost: z.coerce.number({
          invalid_type_error: "Cost should be a number",
          required_error: "Cost is required",
        }),
      })
    )
    .min(1, {
      message: "You need at aleast one ingredients to prepare recipe",
    }),
  totalCost: z.coerce.number({
    invalid_type_error: "Total Cost should be a string",
    required_error: "Total Cost is required",
  }),
  itemCost: z.coerce.number({
    invalid_type_error: "Item Cost should be a string",
    required_error: "Item Cost is required",
  }),
  grossProfit: z.coerce.number({
    invalid_type_error: "Gross profit should be a string",
    required_error: "Gross profit is required",
  }),
});

export const createItemRecipe = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  // @ts-ignore
  const userId = req?.user?.id;

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException("Unauthorized", ErrorCode.UNAUTHORIZED);
  }

  const findUser = await prismaDB.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const validateFields = recipeSchema.parse(req.body);

  const menuItems = await prismaDB.menuItem.findMany({
    where: {
      restaurantId: outlet?.id,
    },
    select: {
      id: true,
      name: true,
    },
  });

  const menuVariants = await prismaDB.menuItemVariant.findMany({
    where: {
      restaurantId: outlet?.id,
    },
    select: {
      variant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const addOns = await prismaDB.addOnVariants.findMany({
    where: {
      restaurantId: outlet?.id,
    },
    select: {
      id: true,
      name: true,
    },
  });
  const slugName =
    validateFields?.recipeFor === "MENU_ITEMS"
      ? menuItems?.find((item) => item?.id === validateFields?.itemId)?.name
      : validateFields?.recipeFor === "MENU_VARIANTS"
      ? menuVariants?.find(
          (variant) => variant?.variant?.id === validateFields?.itemId
        )?.variant?.name
      : addOns?.find((addOn) => addOn?.id === validateFields?.itemId)?.name;

  const itemRecipe = await prismaDB.itemRecipe.create({
    data: {
      restaurantId: outlet?.id,
      recipeFor: validateFields?.recipeFor,
      recipeType: validateFields?.recipeType,
      createdBy: `${findUser?.name} (${findUser?.role})`,
      lastModifiedBy: `${findUser?.name} (${findUser?.role})`,
      name:
        validateFields?.recipeFor === "MENU_ITEMS"
          ? menuItems?.find((item) => item?.id === validateFields?.itemId)?.name
          : validateFields?.recipeFor === "MENU_VARIANTS"
          ? menuVariants?.find(
              (variant) => variant?.variant?.id === validateFields?.itemId
            )?.variant?.name
          : addOns?.find((addOn) => addOn?.id === validateFields?.itemId)?.name,
      slug: generateSlug(slugName as string),
      menuId:
        validateFields?.recipeFor === "MENU_ITEMS"
          ? validateFields?.itemId
          : undefined,
      menuVariantId:
        validateFields?.recipeFor === "MENU_VARIANTS"
          ? validateFields?.itemId
          : undefined,
      addonItemVariantId:
        validateFields?.recipeFor === "ADD_ONS"
          ? validateFields?.itemId
          : undefined,
      ingredients: {
        create: validateFields?.ingredients?.map((ingredient) => ({
          rawMaterialId: ingredient?.rawMaterialId,
          quantity: ingredient?.quantity,
          wastage: ingredient?.wastage,
          cost: ingredient?.cost,
          unitId: ingredient?.mou,
        })),
      },
      grossMargin: validateFields?.grossProfit,
      itemCost: validateFields?.totalCost,
      itemPrice: validateFields?.itemCost,
    },
  });

  if (validateFields.recipeFor === "MENU_ITEMS" && validateFields.itemId) {
    await prismaDB.menuItem.update({
      where: {
        id: validateFields?.itemId,
        restaurantId: outlet?.id,
      },
      data: {
        chooseProfit: "itemRecipe",
        grossProfitPer: null,
        grossProfitType: null,
        itemRecipeId: itemRecipe?.id,
        grossProfit: validateFields?.grossProfit,
      },
    });
  }

  if (validateFields.recipeFor === "MENU_VARIANTS" && validateFields.itemId) {
    await prismaDB.menuItemVariant.update({
      where: {
        id: validateFields?.itemId,
        restaurantId: outlet?.id,
      },
      data: {
        chooseProfit: "itemRecipe",
        grossProfitPer: null,
        grossProfitType: null,
        itemRecipeId: itemRecipe?.id,
        grossProfit: validateFields?.grossProfit,
      },
    });
  }

  if (validateFields.recipeFor === "ADD_ONS" && validateFields.itemId) {
    await prismaDB.addOnVariants.update({
      where: {
        id: validateFields?.itemId,
        restaurantId: outlet?.id,
      },
      data: {
        chooseProfit: "itemRecipe",
        grossProfitPer: null,
        grossProfitType: null,
        itemRecipeId: itemRecipe?.id,
        grossProfit: validateFields?.grossProfit,
      },
    });
  }

  await getOAllItems(outlet.id);

  return res.json({
    success: true,
    message: "Item Created",
  });
};

export const updateItemRecipe = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;
  const outlet = await getOutletById(outletId);

  // @ts-ignore
  const userId = req?.user?.id;

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException("Unauthorized", ErrorCode.UNAUTHORIZED);
  }

  const findUser = await prismaDB.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const findRecipe = await prismaDB.itemRecipe.findFirst({
    where: {
      id: id,
      restaurantId: outlet?.id,
    },
    include: {
      ingredients: true,
    },
  });

  if (!findRecipe) {
    throw new NotFoundException("Recipe Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const validateFields = recipeSchema.parse(req.body);

  // Prepare ingredient operations
  const existingIngredientIds = findRecipe.ingredients.map((ing) => ing.id);
  const incomingIngredientIds = validateFields.ingredients
    .map((ing) => ing.ingredientId)
    .filter(Boolean);

  // Determine ingredients to delete (those in existing but not in incoming)
  const ingredientsToDelete = existingIngredientIds.filter(
    (id) => !incomingIngredientIds.includes(id)
  );

  // Prepare transaction for atomic update
  await prismaDB.$transaction(async (prisma) => {
    // Main recipe update
    await prisma.itemRecipe.update({
      where: {
        id: findRecipe.id,
        restaurantId: outlet?.id,
      },
      data: {
        restaurantId: outlet?.id,
        recipeFor: validateFields?.recipeFor,
        recipeType: validateFields?.recipeType,
        lastModifiedBy: `${findUser?.name} (${findUser?.role})`,
        menuId:
          validateFields?.recipeFor === "MENU_ITEMS"
            ? validateFields?.itemId
            : null,
        menuVariantId:
          validateFields?.recipeFor === "MENU_VARIANTS"
            ? validateFields?.itemId
            : null,
        addonItemVariantId:
          validateFields?.recipeFor === "ADD_ONS"
            ? validateFields?.itemId
            : null,
        grossMargin: validateFields?.grossProfit,
        itemCost: validateFields?.totalCost,
        itemPrice: validateFields?.itemCost,
      },
    });

    if (validateFields.recipeFor === "MENU_ITEMS" && validateFields.itemId) {
      await prisma.menuItem.update({
        where: {
          id: validateFields?.itemId,
          restaurantId: outlet?.id,
        },
        data: {
          chooseProfit: "itemRecipe",
          grossProfitPer: null,
          grossProfitType: null,
          itemRecipeId: findRecipe?.id,
          grossProfit: validateFields?.grossProfit,
        },
      });
    }

    if (validateFields.recipeFor === "MENU_VARIANTS" && validateFields.itemId) {
      await prisma.menuItemVariant.update({
        where: {
          id: validateFields?.itemId,
          restaurantId: outlet?.id,
        },
        data: {
          chooseProfit: "itemRecipe",
          grossProfitPer: null,
          grossProfitType: null,
          itemRecipeId: findRecipe?.id,
          grossProfit: validateFields?.grossProfit,
        },
      });
    }

    // Handle ingredient updates in a single operation
    if (validateFields?.ingredients?.length > 0) {
      // Perform upsert operations for ingredients
      const ingredientUpserts = validateFields.ingredients.map((ingredient) => {
        // If ingredientId exists, it's an update. Otherwise, it's a create
        return ingredient.ingredientId
          ? prisma.recipeIngredient.update({
              where: {
                id: ingredient.ingredientId,
                recipeId: findRecipe.id,
              },
              data: {
                rawMaterialId: ingredient.rawMaterialId,
                quantity: ingredient.quantity,
                wastage: ingredient.wastage,
                cost: ingredient.cost,
                unitId: ingredient.mou,
              },
            })
          : prisma.recipeIngredient.create({
              data: {
                recipeId: findRecipe.id,
                rawMaterialId: ingredient.rawMaterialId,
                quantity: ingredient.quantity,
                wastage: ingredient.wastage,
                cost: ingredient.cost,
                unitId: ingredient.mou,
              },
            });
      });

      // Execute all upsert operations
      await Promise.all(ingredientUpserts);
    }

    // Delete ingredients that are no longer in the recipe
    if (ingredientsToDelete.length > 0) {
      await prisma.recipeIngredient.deleteMany({
        where: {
          id: { in: ingredientsToDelete },
          recipeId: findRecipe.id,
        },
      });
    }
  });

  await getOAllItems(outlet.id);

  return res.json({
    success: true,
    message: "Recipe Updated",
  });
};

export const getAllItemRecipe = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getRecipes = await prismaDB.itemRecipe.findMany({
    where: {
      restaurantId: outlet?.id,
    },
    include: {
      addOnItemVariant: true,
      ingredients: {
        include: {
          rawMaterial: true,
          unit: true,
        },
      },
      menuItem: true,
      menuItemVariant: {
        include: {
          menuItem: true,
          variant: true,
        },
      },
    },
  });

  const formattedRecipes = getRecipes?.map((item) => ({
    id: item?.id,
    recipeType: item?.recipeType,
    recipeFor: item?.recipeFor,
    itemId:
      item?.recipeFor === "MENU_ITEMS"
        ? item?.menuId
        : item?.recipeFor === "MENU_VARIANTS"
        ? item?.menuVariantId
        : item?.addonItemVariantId,
    name:
      item?.recipeFor === "MENU_ITEMS"
        ? item?.menuItem?.find((me) => me?.id === item?.menuId)?.name
        : item?.recipeFor === "MENU_VARIANTS"
        ? `${
            item?.menuItemVariant?.find((v) => v.id === item?.menuVariantId)
              ?.menuItem?.name
          } - ${
            item?.menuItemVariant?.find((v) => v.id === item?.menuVariantId)
              ?.variant?.name
          }`
        : item?.addOnItemVariant?.find((a) => a.id === item?.addonItemVariantId)
            ?.name,
    grossMargin: item?.grossMargin,
    itemPrice: item?.itemPrice,
    itemCost: item?.itemCost,
    ingredients: item?.ingredients.map((ing) => ({
      id: ing?.id,
      rawMaterialId: ing?.rawMaterialId,
      rawMaterialName: ing?.rawMaterial?.name,
      unitId: ing?.unitId,
      unitName: ing?.unit?.name,
      wastage: ing?.wastage,
      cost: ing?.cost,
      quanity: ing?.quantity,
    })),
    createdBy: item.createdBy,
    createdAt: item?.createdAt,
  }));
  return res.json({
    success: true,
    recipes: formattedRecipes,
  });
};

export const getRecipeById = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const findRecipe = await prismaDB.itemRecipe.findFirst({
    where: {
      id: id,
      restaurantId: outlet?.id,
    },
    include: {
      ingredients: true,
    },
  });

  if (!findRecipe) {
    throw new NotFoundException("Recipe Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  return res.json({ success: true, recipe: findRecipe });
};

export const restockPurchase = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;

  const { data: validateFields, error } = validatePurchaseSchema.safeParse(
    req.body
  );

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user?.id;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findPurchase = await prismaDB.purchase.findFirst({
    where: {
      id,
      restaurantId: outlet?.id,
    },
  });

  if (!findPurchase?.id) {
    throw new NotFoundException(
      "Purchase Not Found to Validate",
      ErrorCode.NOT_FOUND
    );
  }

  const findVendor = await prismaDB.vendor.findFirst({
    where: {
      restaurantId: outlet.id,
      id: validateFields.vendorId,
    },
  });

  if (!findVendor?.id) {
    throw new NotFoundException("Vendor Not Found", ErrorCode.NOT_FOUND);
  }

  const transaction = await prismaDB.$transaction(async (prisma) => {
    // Step 1: Restock raw materials and update `RecipeIngredient` costs
    console.log(`Restock for raw Materiasls Inititated`);
    await Promise.all(
      validateFields?.rawMaterials?.map(async (item) => {
        console.log(
          `Restock for raw Material ${item.rawMaterialName} Inititated`
        );
        const rawMaterial = await prisma.rawMaterial.findFirst({
          where: {
            id: item.rawMaterialId,
            restaurantId: outlet?.id,
          },
          include: {
            RecipeIngredient: true,
          },
        });

        if (rawMaterial) {
          console.log(
            `Raw Material ${item.rawMaterialName} Found, old stock is ${rawMaterial?.currentStock}`
          );
          const newStock =
            Number(rawMaterial?.currentStock ?? 0) + item?.requestQuantity;
          console.log(`New Stock for ${item.rawMaterialName} is ${newStock}`);
          const newPricePerItem =
            Number(item.totalRate) / Number(item.requestQuantity);
          console.log(
            `New Price per item for ${item.rawMaterialName} is ${newPricePerItem}`
          );

          const updateStock = await prisma.rawMaterial.update({
            where: {
              id: rawMaterial.id,
            },
            data: {
              currentStock: newStock,
              purchasedPrice: item.totalRate,
              purchasedPricePerItem: newPricePerItem,
              purchasedUnit: item.unitName,
              lastPurchasedPrice: rawMaterial?.purchasedPrice ?? 0,
              purchasedStock: item.requestQuantity,
            },
          });

          console.log(
            `Stock for ${item.rawMaterialName} updated to ${updateStock?.currentStock}`
          );

          // Update related alerts to resolved
          await prismaDB.alert.deleteMany({
            where: {
              restaurantId: outlet.id,
              itemId: rawMaterial?.id,
              status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
            },
          });

          console.log(`Alerts for ${item.rawMaterialName} resolved`);

          const findRecipeIngredients = await prisma.recipeIngredient.findFirst(
            {
              where: {
                rawMaterialId: rawMaterial?.id,
              },
            }
          );
          console.log(
            `findRecipeIngredients for ${item.rawMaterialName} is ${findRecipeIngredients?.id}`
          );
          if (findRecipeIngredients) {
            const recipeCostWithQuantity =
              Number(findRecipeIngredients?.quantity) /
              Number(rawMaterial?.conversionFactor);
            console.log(
              `recipeCostWithQuantity for ${item.rawMaterialName} is ${recipeCostWithQuantity}`
            );
            const ingredientCost = recipeCostWithQuantity * newPricePerItem;
            console.log(
              `ingredientCost for ${item.rawMaterialName} is ${ingredientCost}`
            );
            // Update linked `RecipeIngredient` cost
            await prisma.recipeIngredient.updateMany({
              where: {
                rawMaterialId: rawMaterial.id,
              },
              data: {
                cost: ingredientCost,
              },
            });
            console.log(`RecipeIngredient for ${item.rawMaterialName} updated`);
          }
        }
      })
    );

    // Step 2: Recalculate `ItemRecipe` gross margin and related fields
    console.log(
      `Recalculate ItemRecipe gross margin and related fields Inititated`
    );
    const recipesToUpdate = await prisma.itemRecipe.findMany({
      where: {
        restaurantId: outlet.id,
        ingredients: {
          some: {
            rawMaterial: {
              restaurantId: outlet.id,
              id: {
                in: validateFields?.rawMaterials?.map(
                  (item) => item.rawMaterialId
                ),
              },
            },
          },
        },
      },
      include: {
        ingredients: {
          include: {
            rawMaterial: true,
          },
        },
      },
    });
    console.log(`Recipes to update found ${recipesToUpdate.length}`);
    await Promise.all(
      recipesToUpdate.map(async (recipe) => {
        console.log(`Updating recipe ${recipe.name}`);
        const totalCost = recipe.ingredients.reduce(
          (sum, ingredient) =>
            sum +
            (Number(ingredient.quantity) /
              Number(ingredient?.rawMaterial?.conversionFactor)) *
              Number(ingredient?.rawMaterial?.purchasedPricePerItem),
          0
        );
        console.log(`Total cost for ${recipe.name} is ${totalCost}`);
        const grossMargin = Number(recipe.itemPrice as number) - totalCost;
        console.log(`Gross margin for ${recipe.name} is ${grossMargin}`);

        await prisma.itemRecipe.update({
          where: {
            id: recipe.id,
          },
          data: {
            itemCost: totalCost,
            grossMargin,
          },
        });

        console.log(`Recipe ${recipe.name} updated`);

        // Update linked entities
        if (recipe?.menuId) {
          console.log(`Updating menu item ${recipe.name}`);
          await prisma.menuItem.update({
            where: {
              id: recipe.menuId,
              restaurantId: outlet.id,
            },
            data: {
              grossProfit: grossMargin,
            },
          });
        }

        if (recipe.menuVariantId) {
          console.log(`Updating menu variant ${recipe.name}`);
          await prisma.menuItemVariant.update({
            where: {
              id: recipe.menuVariantId,
              restaurantId: outlet.id,
            },
            data: {
              grossProfit: grossMargin,
            },
          });
        }

        if (recipe.addonItemVariantId) {
          console.log(`Updating addon variant ${recipe.name}`);
          await prisma.addOnVariants.update({
            where: {
              id: recipe.addonItemVariantId,
              restaurantId: outlet.id,
            },
            data: {
              grossProfit: grossMargin,
            },
          });
        }
      })
    );

    console.log(`All recipes updated`);
    // Step 3: Update purchase details
    console.log(`Updating purchase details`);
    const updatePurchase = await prisma.purchase.update({
      where: {
        id: findPurchase?.id,
        restaurantId: outlet?.id,
      },
      data: {
        isPaid: validateFields?.paymentMethod !== undefined,
        paymentMethod: validateFields?.paymentMethod,
        billImageUrl: validateFields?.billImage,
        invoiceType: validateFields?.chooseInvoice,
        purchaseStatus: "SETTLEMENT",
        purchaseItems: {
          update: validateFields?.rawMaterials?.map((item) => ({
            where: {
              id: item?.id,
              purchaseId: validateFields?.id,
            },
            data: {
              purchasePrice: item?.totalRate,
            },
          })),
        },
      },
    });

    return updatePurchase;
  });

  if (transaction?.id) {
    await Promise.all([
      redis.del(`${outletId}-stocks`),
      redis.del(`${outletId}-vendors`),
      redis.del(`${outletId}-raw-materials`),
      redis.del(`${outletId}-purchases`),
      redis.del(`alerts-${outletId}`),
    ]);

    websocketManager.notifyClients(outletId, "NEW_ALERT");
    return res.json({
      success: true,
      message: "Purchase Settlement Pending & Stock Restocked,Recipes Updated",
    });
  }
};

const settleFormSchema = z.object({
  id: z.string().min(1, { message: "Purchase Id Missing" }),
  vendorId: z.string().min(1, { message: "Vendor is Missing" }),
  rawMaterials: z
    .array(
      z.object({
        id: z.string().min(1, { message: "Purchase Item Id is missing" }),
        rawMaterialId: z
          .string()
          .min(1, { message: "Raw Material Is Required" }),
        rawMaterialName: z.string().min(1, { message: "Raw Material Name" }),
        unitName: z.string().min(1, { message: "Unit Name is required" }),
        requestUnitId: z
          .string()
          .min(1, { message: "Request Unit is Required" }),

        requestQuantity: z.coerce
          .number()
          .min(1, { message: "Request Quantity is Required" }),
        gstType: z.nativeEnum(GstType, {
          required_error: "GST Type is Required",
        }),
        netRate: z.coerce.number(),
        taxAmount: z.coerce.number(),
        total: z.coerce
          .number()
          .min(0, { message: "Purchase price is required" }),
      })
    )
    .min(1, { message: "Atleast 1 Raw Material you need to request" }),
  isPaid: z.boolean({ required_error: "You need to choose" }),
  billImage: z.string().optional(),
  amountToBePaid: z.coerce.number().min(0, { message: "Amount Required" }),
  chooseInvoice: z
    .enum(["generateInvoice", "uploadInvoice"], {
      required_error: "You need to select a invoice type.",
    })
    .optional(),
  paymentMethod: z.enum(["CASH", "UPI", "DEBIT", "CREDIT"], {
    required_error: "Settlement Payment Method Required.",
  }),
});

export const settlePayForRaisedPurchase = async (
  req: Request,
  res: Response
) => {
  const { outletId, id } = req.params;

  const { data: validateFields, error } = settleFormSchema.safeParse(req.body);

  console.log("Amount to be paid", validateFields);

  if (
    validateFields?.amountToBePaid === undefined ||
    validateFields?.amountToBePaid < 1
  ) {
    throw new BadRequestsException(
      "Amount Paid must be equal to the purchase amount",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (validateFields?.isPaid && validateFields?.paymentMethod === undefined) {
    throw new BadRequestsException(
      "Please select your payment settlement mode",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user?.id;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findPurchase = await prismaDB.purchase.findFirst({
    where: {
      id,
      restaurantId: outlet?.id,
    },
  });

  if (!findPurchase?.id) {
    throw new NotFoundException(
      "Purchase Not Found to Validate",
      ErrorCode.NOT_FOUND
    );
  }

  const findVendor = await prismaDB.vendor.findFirst({
    where: {
      restaurantId: outlet.id,
      id: validateFields.vendorId,
    },
  });

  if (!findVendor?.id) {
    throw new NotFoundException("Vendor Not Found", ErrorCode.NOT_FOUND);
  }

  const transaction = await prismaDB.$transaction(async (prisma) => {
    // Step 3: Update purchase details
    const updatePurchase = await prisma.purchase.update({
      where: {
        id: findPurchase?.id,
        restaurantId: outlet?.id,
      },
      data: {
        isPaid: validateFields?.isPaid,
        paymentMethod: validateFields?.paymentMethod,
        billImageUrl: validateFields?.billImage,
        invoiceType: validateFields?.chooseInvoice,
        totalAmount: validateFields?.amountToBePaid,
        purchaseStatus: "COMPLETED",
      },
    });

    return updatePurchase;
  });

  if (transaction?.id) {
    // Step 4: Refresh Redis cache

    await Promise.all([
      redis.del(`${outletId}-stocks`),
      redis.del(`${outletId}-purchases`),
      redis.del(`${outletId}-raw-materials`),
    ]);

    return res.json({
      success: true,
      message: "Purchase Settlement Pending & Stock Restocked,Recipes Updated",
    });
  }
};

export const updateStockRawMaterial = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;
  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user?.id;

  const { stock } = req?.body;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const findRawMaterial = await prismaDB.rawMaterial.findFirst({
    where: {
      id: id,
    },
  });

  if (!findRawMaterial?.id) {
    throw new NotFoundException(
      "Raw Material / Stock not found",
      ErrorCode.NOT_FOUND
    );
  }

  if (
    findRawMaterial?.purchasedStock &&
    stock > findRawMaterial?.purchasedStock
  ) {
    throw new BadRequestsException(
      "You cannot update the stock to a value greater than the last purchased stock",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.rawMaterial.update({
    where: {
      restaurantId: outlet?.id,
      id: findRawMaterial?.id,
    },
    data: {
      currentStock: stock ?? findRawMaterial?.currentStock,
    },
  });

  // Update related alerts to resolved
  await prismaDB.alert.deleteMany({
    where: {
      restaurantId: outlet.id,
      itemId: findRawMaterial?.id,
      status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
    },
  });

  websocketManager.notifyClients(outletId, "NEW_ALERT");
  await redis.del(`alerts-${outletId}`);
  await getfetchOutletStocksToRedis(outletId);
  return res.json({
    success: true,
    message: "Stock Updated",
  });
};

export const getAllTableRawMaterials = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];
  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.rawMaterial.count({
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const rawMaterials = await prismaDB.rawMaterial.findMany({
    skip,
    take,
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    include: {
      rawMaterialCategory: true,
      consumptionUnit: true,
      minimumStockUnit: true,
    },
    orderBy,
  });

  const formattedRawMaterias = rawMaterials?.map((raw) => ({
    id: raw?.id,
    name: raw?.name,
    barcode: raw?.shortcode,
    categoryId: raw?.categoryId,
    consumptionUnitId: raw?.consumptionUnitId,
    consumptionUnitName: raw?.consumptionUnit?.name,
    minimumStockLevelUnitName: raw?.minimumStockUnit?.name,
    minimumStockLevelUnitId: raw?.minimumStockLevelUnit,
    conversionFactor: raw?.conversionFactor,
    minimumStockLevel: raw?.minimumStockLevel,
    category: raw?.rawMaterialCategory?.name,
    createdAt: raw?.createdAt,
  }));

  return res.json({
    success: true,
    data: { totalCount: totalCount, rawMaterials: formattedRawMaterias },
  });
};

export const getAllVendorsForTable = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];
  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.vendor.count({
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const vendors = await prismaDB.vendor.findMany({
    skip,
    take,
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    include: {
      purchases: true,
      category: true,
      contractRates: {
        include: {
          unit: true,
          rawMaterial: true,
        },
      },
    },
    orderBy,
  });

  const formattedVendors = vendors?.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    categoryId: vendor?.categoryId,
    category: vendor?.category?.name || "Missing", // You might want to add category to your vendor schema
    contactName: vendor?.contactName || "Missing", // Add to schema if needed
    phone: vendor?.phone || "Missing", // Add to schema if needed
    email: vendor?.email || "Missing", // Add to schema if needed
    totalOrders: vendor?.purchases?.length || 0,
    lastOrder:
      vendor.purchases[0]?.createdAt.toISOString().split("T")[0] || null,
    status: "ACTIVE", // Add status field to schema if needed
    isContract: vendor?.isContract || false,
    rawMaterials: vendor?.contractRates?.map((rate) => ({
      id: rate?.id,
      rawMaterialId: rate?.rawMaterialId,
      rawMaterialName: rate?.rawMaterial?.name,
      unitId: rate?.unitId,
      unitName: rate?.unit?.name,
      netRate: rate?.netRate,
      gstType: rate?.gstType,
      taxAmount: rate?.taxAmount,
      totalRate: rate?.totalRate,
      validFrom: rate?.validFrom,
      validTo: rate?.validTo,
    })),
    avgContractRate:
      vendor?.contractRates?.reduce((acc, rate) => acc + rate.totalRate, 0) /
      vendor?.contractRates?.length,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  }));

  return res.json({
    success: true,
    data: { totalCount: totalCount, vendors: formattedVendors },
  });
};

export const getAllTableRawMaterialCategory = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];
  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.rawMaterialCategory.count({
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const rawMaterialsCategory = await prismaDB.rawMaterialCategory.findMany({
    take,
    skip,
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    orderBy,
  });

  const formattedRawMaterialCategories = rawMaterialsCategory?.map((raw) => ({
    id: raw?.id,
    name: raw?.name,
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  }));

  return res.json({
    success: true,
    data: {
      totalCount: totalCount,
      categories: formattedRawMaterialCategories,
    },
  });
};

export const allTableStocks = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];
  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.rawMaterial.count({
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const rawMaterials = await prismaDB.rawMaterial.findMany({
    skip,
    take,
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    include: {
      rawMaterialCategory: true,
      consumptionUnit: true,
      minimumStockUnit: true,
    },
    orderBy,
  });

  const formattedStocks = rawMaterials?.map((rawItem) => ({
    id: rawItem?.id,
    name: rawItem?.name,
    consumptionUnit: rawItem?.consumptionUnit?.name,
    stock: `${rawItem?.currentStock?.toFixed(2)} - ${rawItem?.purchasedUnit}`,
    minStockLevel: `${rawItem?.minimumStockLevel?.toFixed(2)} - ${
      rawItem?.minimumStockUnit?.name
    }`,
    purchasedPrice: rawItem?.purchasedPrice,
    lastPurchasedPrice: rawItem?.lastPurchasedPrice,
    purchasedPricePerItem: rawItem?.purchasedPricePerItem,
    purchasedStock: `${rawItem?.purchasedStock?.toFixed(2)} - ${
      rawItem?.purchasedUnit
    }`,
    createdAt: rawItem?.createdAt,
  }));

  return res.json({
    success: true,
    data: {
      totalCount: totalCount,
      stocks: formattedStocks,
    },
    message: "Fetched Items by database ✅",
  });
};

export const getAllTableItemRecipe = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];
  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.itemRecipe.count({
    where: {
      restaurantId: outlet?.id,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const getRecipes = await prismaDB.itemRecipe.findMany({
    skip,
    take,
    where: {
      restaurantId: outlet?.id,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    include: {
      addOnItemVariant: true,
      ingredients: {
        include: {
          rawMaterial: true,
          unit: true,
        },
      },
      menuItem: true,
      menuItemVariant: {
        include: {
          menuItem: true,
          variant: true,
        },
      },
    },
    orderBy,
  });

  const formattedRecipes = getRecipes?.map((item) => ({
    id: item?.id,
    recipeType: item?.recipeType,
    recipeFor: item?.recipeFor,
    itemId:
      item?.recipeFor === "MENU_ITEMS"
        ? item?.menuId
        : item?.recipeFor === "MENU_VARIANTS"
        ? item?.menuVariantId
        : item?.addonItemVariantId,
    name:
      item?.name ?? item?.recipeFor === "MENU_ITEMS"
        ? item?.menuItem?.find((me) => me?.id === item?.menuId)?.name
        : item?.recipeFor === "MENU_VARIANTS"
        ? `${
            item?.menuItemVariant?.find((v) => v.id === item?.menuVariantId)
              ?.menuItem?.name
          } - ${
            item?.menuItemVariant?.find((v) => v.id === item?.menuVariantId)
              ?.variant?.name
          }`
        : item?.addOnItemVariant?.find((a) => a.id === item?.addonItemVariantId)
            ?.name,
    grossMargin: item?.grossMargin,
    itemPrice: item?.itemPrice,
    itemCost: item?.itemCost,
    ingredients: item?.ingredients.map((ing) => ({
      id: ing?.id,
      rawMaterialId: ing?.rawMaterialId,
      rawMaterialName: ing?.rawMaterial?.name,
      unitId: ing?.unitId,
      unitName: ing?.unit?.name,
      cost: ing?.cost,
      quanity: ing?.quantity,
    })),
    createdBy: item.createdBy,
    createdAt: item?.createdAt,
  }));

  return res.json({
    success: true,
    data: {
      totalCount: totalCount,
      recipes: formattedRecipes,
    },
  });
};

export const getTableAllRawMaterialUnit = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const rawMaterialsUnitFromRedis = await redis.get(
    `${outletId}-raw-materials-unit`
  );

  if (rawMaterialsUnitFromRedis) {
    return res.json({
      success: true,
      units: JSON.parse(rawMaterialsUnitFromRedis),
    });
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const rawMaterialsUnit = await prismaDB.unit.findMany({
    where: {
      restaurantId: outletId,
    },
  });

  await redis.set(
    `${outletId}-raw-materials-unit`,
    JSON.stringify(rawMaterialsUnit)
  );

  return res.json({
    success: true,
    units: rawMaterialsUnit,
  });
};

export const getAllCompletedTablePurcahses = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];
  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.purchase.count({
    where: {
      restaurantId: outletId,
      purchaseStatus: {
        in: [PurchaseStatus.COMPLETED, PurchaseStatus.CANCELLED],
      },
      OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const allPurchases = await prismaDB.purchase.findMany({
    skip,
    take,
    where: {
      restaurantId: outletId,
      purchaseStatus: {
        in: [PurchaseStatus.COMPLETED, PurchaseStatus.CANCELLED],
      },
      OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    include: {
      purchaseItems: {
        include: {
          purchaseUnit: true,
          rawMaterial: true,
        },
      },
    },
    orderBy,
  });

  const formattedPurchase = allPurchases?.map((purchase) => ({
    id: purchase?.id,
    invoiceNo: purchase?.invoiceNo,
    vendorId: purchase?.vendorId,
    isPaid: purchase?.isPaid,
    subTotal: purchase?.subTotal,
    taxes: purchase?.taxes,
    paymentMethod: purchase?.paymentMethod,
    generatedAmount: purchase?.generatedAmount,
    totalAmount: purchase?.totalAmount,
    purchaseStatus: purchase?.purchaseStatus,
    createdBy: purchase?.createdBy,
    createdAt: purchase?.createdAt,
    purchaseItems: purchase?.purchaseItems?.map((item) => ({
      id: item?.id,
      rawMaterialId: item?.rawMaterialId,
      rawMaterialName: item?.rawMaterialName,
      purchaseUnitId: item?.purchaseUnitId,
      purchaseUnitName: item?.purchaseUnitName,
      purchaseQuantity: item?.purchaseQuantity,
      gstType: item?.gstType,
      netRate: item?.netRate,
      taxAmount: item?.taxAmount,
      purchasePrice: item?.purchasePrice,
    })),
  }));

  return res.json({
    success: true,
    data: {
      totalCount,
      purchases: formattedPurchase,
    },
  });
};

export const getAllRequestedTablePurcahses = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];
  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.purchase.count({
    where: {
      purchaseStatus: {
        in: [
          PurchaseStatus.PROCESSED,
          PurchaseStatus.ACCEPTED,
          PurchaseStatus.REQUESTED,
        ],
      },
      restaurantId: outletId,
      OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const allPurchases = await prismaDB.purchase.findMany({
    where: {
      restaurantId: outletId,
      purchaseStatus: {
        in: ["PROCESSED", "ACCEPTED", "REQUESTED"],
      },
      OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    include: {
      purchaseItems: {
        include: {
          purchaseUnit: true,
          rawMaterial: true,
        },
      },
    },
    orderBy,
    skip,
    take,
  });

  const formattedPurchase = allPurchases?.map((purchase) => ({
    id: purchase?.id,
    invoiceNo: purchase?.invoiceNo,
    vendorId: purchase?.vendorId,
    isPaid: purchase?.isPaid,
    subTotal: purchase?.subTotal,
    taxes: purchase?.taxes,
    paymentMethod: purchase?.paymentMethod,
    generatedAmount: purchase?.generatedAmount,
    totalAmount: purchase?.totalAmount,
    purchaseStatus: purchase?.purchaseStatus,
    createdBy: purchase?.createdBy,
    createdAt: purchase?.createdAt,
    purchaseItems: purchase?.purchaseItems?.map((item) => ({
      id: item?.id,
      rawMaterialId: item?.rawMaterialId,
      rawMaterialName: item?.rawMaterialName,
      purchaseUnitId: item?.purchaseUnitId,
      purchaseUnitName: item?.purchaseUnitName,
      purchaseQuantity: item?.purchaseQuantity,
      gstType: item?.gstType,
      netRate: item?.netRate,
      taxAmount: item?.taxAmount,
      purchasePrice: item?.purchasePrice,
    })),
  }));

  return res.json({
    success: true,
    data: {
      totalCount,
      purchases: formattedPurchase,
    },
  });
};

export const getAllSettledTablePurcahses = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }
  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];
  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.purchase.count({
    where: {
      purchaseStatus: PurchaseStatus.SETTLEMENT,
      restaurantId: outletId,
      OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const allPurchases = await prismaDB.purchase.findMany({
    skip,
    take,
    where: {
      restaurantId: outletId,
      purchaseStatus: PurchaseStatus.SETTLEMENT,
      OR: [{ invoiceNo: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    include: {
      purchaseItems: {
        include: {
          purchaseUnit: true,
          rawMaterial: true,
        },
      },
    },
    orderBy,
  });

  const formattedPurchase = allPurchases?.map((purchase) => ({
    id: purchase?.id,
    invoiceNo: purchase?.invoiceNo,
    vendorId: purchase?.vendorId,
    isPaid: purchase?.isPaid,
    subTotal: purchase?.subTotal,
    taxes: purchase?.taxes,
    paymentMethod: purchase?.paymentMethod,
    generatedAmount: purchase?.generatedAmount,
    totalAmount: purchase?.totalAmount,
    purchaseStatus: purchase?.purchaseStatus,
    createdBy: purchase?.createdBy,
    createdAt: purchase?.createdAt,
    purchaseItems: purchase?.purchaseItems?.map((item) => ({
      id: item?.id,
      rawMaterialId: item?.rawMaterialId,
      rawMaterialName: item?.rawMaterialName,
      purchaseUnitId: item?.purchaseUnitId,
      purchaseUnitName: item?.purchaseUnitName,
      purchaseQuantity: item?.purchaseQuantity,
      gstType: item?.gstType,
      netRate: item?.netRate,
      taxAmount: item?.taxAmount,
      purchasePrice: item?.purchasePrice,
    })),
  }));

  return res.json({
    success: true,
    data: {
      totalCount,
      purchases: formattedPurchase,
    },
  });
};

export const getAllTableRawMaterialUnit = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];
  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.unit.count({
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const rawMaterialsUnit = await prismaDB.unit.findMany({
    take,
    skip,
    where: {
      restaurantId: outletId,
      OR: [{ name: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    orderBy,
  });

  const formanttedUnits = rawMaterialsUnit?.map((unit) => ({
    id: unit?.id,
    name: unit?.name,
    createdAt: unit?.createdAt,
    updatedAt: unit?.updatedAt,
  }));

  return res.json({
    success: true,
    data: { totalCount, units: formanttedUnits },
  });
};

export const deleteItemRecipe = async (req: Request, res: Response) => {
  const { outletId, id: recipeId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Use transaction to handle both deletion and menu updates
  await prismaDB.$transaction(async (prisma) => {
    // First, find all related items that use this recipe
    const recipe = await prisma.itemRecipe.findUnique({
      where: { id: recipeId },
      include: {
        menuItem: true, // Get linked menu items
        menuItemVariant: true, // Get linked menu variants
        addOnItemVariant: true, // Get linked addon variants
      },
    });

    if (!recipe) {
      throw new NotFoundException("Recipe Not Found", ErrorCode.NOT_FOUND);
    }

    // Update menu items that use this recipe
    if (recipe.menuItem?.length > 0) {
      await prisma.menuItem.updateMany({
        where: {
          itemRecipeId: recipeId,
        },
        data: {
          chooseProfit: "manualProfit",
          grossProfitType: "INR",
          itemRecipeId: null, // Remove the recipe reference
        },
      });
    }

    // Update menu variants that use this recipe
    if (recipe.menuItemVariant?.length > 0) {
      await prisma.menuItemVariant.updateMany({
        where: {
          itemRecipeId: recipeId,
        },
        data: {
          chooseProfit: "manualProfit",
          grossProfitType: "INR",
          itemRecipeId: null, // Remove the recipe reference
        },
      });
    }

    // Update addon variants that use this recipe
    if (recipe.addOnItemVariant?.length > 0) {
      await prisma.addOnVariants.updateMany({
        where: {
          itemRecipeId: recipeId,
        },
        data: {
          chooseProfit: "manualProfit",
          grossProfitType: "INR",
          itemRecipeId: null, // Remove the recipe reference
        },
      });
    }

    // Finally, delete the recipe
    await prisma.itemRecipe.delete({
      where: {
        id: recipeId,
      },
    });
  });

  // Clear relevant cache
  await Promise.all([
    redis.del(`${outletId}-all-items`),
    redis.del(`${outletId}-all-items-for-online-and-delivery`),
    redis.del(`o-${outletId}-categories`),
  ]);
  return res.json({
    success: true,
    message: "Recipe deleted and linked items updated successfully",
  });
};

export const calculateItemServes = async (req: Request, res: Response) => {
  const { outletId, recipeId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const serves = await calculateFoodServerForItemRecipe(recipeId, outletId);

  return res.json({
    success: true,
    message: `This Item Serves ${serves}`,
  });
};
