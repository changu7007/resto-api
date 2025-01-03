import { Request, Response } from "express";
import { generatePurchaseNo, getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { rawMaterialSchema } from "../../../schema/staff";
import { z } from "zod";
import { redis } from "../../../services/redis";
import {
  fetchOutletRawMaterialCAtegoryToRedis,
  fetchOutletRawMaterialsToRedis,
  fetchOutletRawMaterialUnitToRedis,
  getfetchOutletStocksToRedis,
} from "../../../lib/outlet/get-inventory";
import { UnauthorizedException } from "../../../exceptions/unauthorized";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { getOAllItems } from "../../../lib/outlet/get-items";

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

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.rawMaterial.create({
    data: {
      restaurantId: outlet?.id,
      name: validateFields.name,
      shortcode: validateFields.barcode,
      categoryId: validateFields.categoryId,
      consumptionUnitId: validateFields.consumptionUnitId,
      conversionFactor: validateFields.conversionFactor,
      minimumStockLevelUnit: validateFields.minimumStockLevelUnitId,
      minimumStockLevel: validateFields.minimumStockLevel,
    },
  });

  await fetchOutletRawMaterialsToRedis(outlet?.id);

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

  await fetchOutletRawMaterialsToRedis(outlet?.id);

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

  await fetchOutletRawMaterialsToRedis(outlet?.id);

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

  await redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases));

  return res.json({
    success: true,
    allPurchases,
  });
};

const purchaseRequestFormSchema = z.object({
  vendorId: z.string().min(1, { message: "Vendor Is Required" }),
  rawMaterials: z.array(
    z.object({
      id: z.string().optional(),
      rawMaterialId: z.string().min(1, { message: "Raw Material Is Required" }),
      rawMaterialName: z.string().min(1, { message: "Raw Material Name" }),
      unitName: z.string().min(1, { message: "Unit Name is required" }),
      requestUnitId: z.string().min(1, { message: "Request Unit is Required" }),
      requestQuantity: z.coerce
        .number()
        .min(1, { message: "Request Quantity is Required" }),
      sgst: z.coerce.number().optional(),
      cgst: z.coerce.number().optional(),
      total: z.coerce.number().optional(),
    })
  ),
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
    const purchase = await prismaDB.purchase.create({
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
            sgst: item?.sgst,
            cgst: item?.cgst,
            purchasePrice: item?.total,
          })),
        },
      },
    });

    if (purchase?.id) {
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

      await redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases));
    }
  });
  return res.json({
    success: true,
    message: "Request Purchase Created",
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
  });

  await redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases));
  return res.json({
    success: true,
    message: "Request Purchase Created",
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
  });

  await redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases));
  return res.json({
    success: true,
    message: "Request Purchase Deleted ✅",
  });
};

const validatePurchaseSchema = z.object({
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
        gst: z.coerce.number(),
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
  paymentMethod: z
    .enum(["CASH", "UPI", "DEBIT", "CREDIT"], {
      required_error: "Settlement Payment Method Required.",
    })
    .optional(),
  totalTaxes: z.coerce.number().min(0, { message: "taxes invalid" }),
  subTotal: z.coerce.number().min(0, { message: "taxes invalid" }),
  total: z.coerce.number().min(0, { message: "total required" }),
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

  if (validateFields?.total === undefined || validateFields?.total < 1) {
    throw new BadRequestsException(
      "Please Provide Raw Material Purchase Prices",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (validateFields?.isPaid && validateFields?.paymentMethod === undefined) {
    throw new BadRequestsException(
      "Please select your payment settlement mode",
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
          const newStock =
            Number(rawMaterial?.currentStock ?? 0) + item?.requestQuantity;
          const newPricePerItem =
            Number(item.total) / Number(item.requestQuantity);

          await prisma.rawMaterial.update({
            where: {
              id: rawMaterial.id,
            },
            data: {
              currentStock: newStock,
              purchasedPrice: item.total,
              purchasedPricePerItem: newPricePerItem,
              purchasedUnit: item.unitName,
              lastPurchasedPrice: rawMaterial?.purchasedPrice ?? 0,
              purchasedStock: newStock,
            },
          });

          const findRecipeIngredients = await prisma.recipeIngredient.findFirst(
            {
              where: {
                rawMaterialId: rawMaterial?.id,
              },
            }
          );
          if (findRecipeIngredients) {
            const recipeCostWithQuantity =
              Number(findRecipeIngredients?.quantity) /
              Number(rawMaterial?.conversionFactor);
            const ingredientCost = recipeCostWithQuantity * newPricePerItem;
            // Update linked `RecipeIngredient` cost
            await prisma.recipeIngredient.updateMany({
              where: {
                rawMaterialId: rawMaterial.id,
              },
              data: {
                cost: ingredientCost,
              },
            });
          }
        }
      })
    );

    // Step 2: Recalculate `ItemRecipe` gross margin and related fields
    const recipesToUpdate = await prisma.itemRecipe.findMany({
      where: {
        restaurantId: outlet.id,
      },
      include: {
        ingredients: {
          include: {
            rawMaterial: true,
          },
        },
      },
    });

    await Promise.all(
      recipesToUpdate.map(async (recipe) => {
        const totalCost = recipe.ingredients.reduce(
          (sum, ingredient) =>
            sum +
            (Number(ingredient.quantity) /
              Number(ingredient?.rawMaterial?.conversionFactor)) *
              Number(ingredient?.rawMaterial?.purchasedPricePerItem),
          0
        );
        const grossMargin = Number(recipe.itemPrice as number) - totalCost;

        await prisma.itemRecipe.update({
          where: {
            id: recipe.id,
          },
          data: {
            itemCost: totalCost,
            grossMargin,
          },
        });

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
        subTotal: validateFields?.subTotal,
        taxes: validateFields?.totalTaxes,
        totalAmount: validateFields?.total,
        purchaseStatus: "COMPLETED",
        purchaseItems: {
          update: validateFields?.rawMaterials?.map((item) => ({
            where: {
              id: item?.id,
              purchaseId: validateFields?.id,
            },
            data: {
              cgst: item.gst / 2,
              sgst: item.gst / 2,
              purchasePrice: item?.total,
            },
          })),
        },
      },
    });

    return updatePurchase;
  });

  if (transaction?.id) {
    // Step 4: Refresh Redis cache
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

    await Promise.all([
      getfetchOutletStocksToRedis(outletId),
      redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases)),
      fetchOutletRawMaterialsToRedis(outlet?.id),
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
  name: z.string().min(1),
});

export const createVendor = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const validateFields = vendorFormSchema.parse(req.body);
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  await prismaDB.vendor.create({
    data: {
      restaurantId: outlet?.id,
      name: validateFields.name,
    },
  });

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
    },
  });

  await redis.set(`${outlet.id}-vendors`, JSON.stringify(vendors));
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
  });

  if (!vendor?.id) {
    throw new NotFoundException("Vendor Not Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.vendor.update({
    where: {
      id: vendor.id,
      restaurantId: outlet.id,
    },
    data: {
      name: validateFields.name,
    },
  });

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
    },
  });

  await redis.set(`${outlet.id}-vendors`, JSON.stringify(vendors));
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
    },
  });

  await redis.set(`${outlet.id}-vendors`, JSON.stringify(vendors));
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
    },
  });

  await redis.set(`${outlet.id}-vendors`, JSON.stringify(vendors));
  return res.json({
    success: true,
    vednors: vendors,
    message: "Vendors Fetched ✅",
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
    stock: `${rawItem.currentStock} - ${rawItem?.purchasedUnit}`,
    purchasedPrice: rawItem?.purchasedPrice,
    lastPurchasedPrice: rawItem?.lastPurchasedPrice,
    purchasedPricePerItem: rawItem?.purchasedPricePerItem,
    purchasedStock: `${rawItem.currentStock} - ${rawItem?.purchasedUnit}`,
    createdAt: rawItem.createdAt,
  }));

  await redis.set(`${outletId}-stocks`, JSON.stringify(formattedStocks));
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
          invalid_type_error: "Quantity should be a string",
          required_error: "quantity is required",
        }),
        cost: z.coerce.number({
          invalid_type_error: "Cost should be a string",
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

  const itemRecipe = await prismaDB.itemRecipe.create({
    data: {
      restaurantId: outlet?.id,
      recipeFor: validateFields?.recipeFor,
      recipeType: validateFields?.recipeType,
      createdBy: `${findUser?.name} (${findUser?.role})`,
      lastModifiedBy: `${findUser?.name} (${findUser?.role})`,
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
                cost: ingredient.cost,
                unitId: ingredient.mou,
              },
            })
          : prisma.recipeIngredient.create({
              data: {
                recipeId: findRecipe.id,
                rawMaterialId: ingredient.rawMaterialId,
                quantity: ingredient.quantity,
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

  if (validateFields?.total === undefined || validateFields?.total < 1) {
    throw new BadRequestsException(
      "Please Provide Raw Material Purchase Prices",
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
          const newStock =
            Number(rawMaterial?.currentStock ?? 0) + item?.requestQuantity;
          const newPricePerItem =
            Number(item.total) / Number(item.requestQuantity);

          await prisma.rawMaterial.update({
            where: {
              id: rawMaterial.id,
            },
            data: {
              currentStock: newStock,
              purchasedPrice: item.total,
              purchasedPricePerItem: newPricePerItem,
              purchasedUnit: item.unitName,
              lastPurchasedPrice: rawMaterial?.purchasedPrice ?? 0,
              purchasedStock: newStock,
            },
          });

          const findRecipeIngredients = await prisma.recipeIngredient.findFirst(
            {
              where: {
                rawMaterialId: rawMaterial?.id,
              },
            }
          );
          if (findRecipeIngredients) {
            const recipeCostWithQuantity =
              Number(findRecipeIngredients?.quantity) /
              Number(rawMaterial?.conversionFactor);
            const ingredientCost = recipeCostWithQuantity * newPricePerItem;
            // Update linked `RecipeIngredient` cost
            await prisma.recipeIngredient.updateMany({
              where: {
                rawMaterialId: rawMaterial.id,
              },
              data: {
                cost: ingredientCost,
              },
            });
          }
        }
      })
    );

    // Step 2: Recalculate `ItemRecipe` gross margin and related fields
    const recipesToUpdate = await prisma.itemRecipe.findMany({
      where: {
        restaurantId: outlet.id,
      },
      include: {
        ingredients: {
          include: {
            rawMaterial: true,
          },
        },
      },
    });

    await Promise.all(
      recipesToUpdate.map(async (recipe) => {
        const totalCost = recipe.ingredients.reduce(
          (sum, ingredient) =>
            sum +
            (Number(ingredient.quantity) /
              Number(ingredient?.rawMaterial?.conversionFactor)) *
              Number(ingredient?.rawMaterial?.purchasedPricePerItem),
          0
        );
        const grossMargin = Number(recipe.itemPrice as number) - totalCost;

        await prisma.itemRecipe.update({
          where: {
            id: recipe.id,
          },
          data: {
            itemCost: totalCost,
            grossMargin,
          },
        });

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
        subTotal: validateFields?.subTotal,
        taxes: validateFields?.totalTaxes,
        generatedAmount: validateFields?.total,
        totalAmount: validateFields?.amountToBePaid,
        purchaseStatus: "SETTLEMENT",
        purchaseItems: {
          update: validateFields?.rawMaterials?.map((item) => ({
            where: {
              id: item?.id,
              purchaseId: validateFields?.id,
            },
            data: {
              cgst: item.gst / 2,
              sgst: item.gst / 2,
              purchasePrice: item?.total,
            },
          })),
        },
      },
    });

    return updatePurchase;
  });

  if (transaction?.id) {
    // Step 4: Refresh Redis cache
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

    await Promise.all([
      getfetchOutletStocksToRedis(outletId),
      redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases)),
      fetchOutletRawMaterialsToRedis(outlet?.id),
    ]);

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
        gst: z.coerce.number(),
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
      "Please Provide the amount you paid in input field",
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

    await Promise.all([
      getfetchOutletStocksToRedis(outletId),
      redis.set(`${outletId}-purchases`, JSON.stringify(allPurchases)),
      fetchOutletRawMaterialsToRedis(outlet?.id),
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

  await prismaDB.rawMaterial.update({
    where: {
      restaurantId: outlet?.id,
      id: findRawMaterial?.id,
    },
    data: {
      currentStock: stock ?? findRawMaterial?.currentStock,
    },
  });
  await getfetchOutletStocksToRedis(outletId);
  return res.json({
    success: true,
    message: "Stock Updated",
  });
};
