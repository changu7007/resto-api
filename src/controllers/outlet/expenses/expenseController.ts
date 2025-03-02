import { Request, Response } from "express";
import { z } from "zod";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { ErrorCode } from "../../../exceptions/root";
import { generatePurchaseNo, getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { UnauthorizedException } from "../../../exceptions/unauthorized";
import { prismaDB } from "../../..";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
} from "../../../schema/staff";
import { redis } from "../../../services/redis";
import { websocketManager } from "../../../services/ws";

const expenseSchema = z.object({
  category: z.enum(
    [
      "Ingredients",
      "Utilities",
      "Salaries",
      "Equipment",
      "Marketing",
      "Rent",
      "Miscellaneous",
    ],
    { required_error: "Please select a category." }
  ),
  restock: z.boolean().optional(),
  purchaseId: z.string().optional(),
  vendorId: z.string().min(1, { message: "Vendor Is Required" }).optional(),
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
      gst: z.coerce.number(),
      total: z.coerce
        .number()
        .min(0, { message: "Purchase price is required" }),
    })
  ),
  amount: z.coerce
    .number()
    .min(1, { message: "Amount should be greater than 0" }),
  description: z.string().min(3, {
    message: "Description must be at least 3 characters.",
  }),
  attachments: z.string().optional(),
  paymentMethod: z.enum(["CASH", "UPI", "DEBIT", "CREDIT"], {
    required_error: " Payment Method Required.",
  }),
  cashRegisterId: z
    .string()
    .min(1, { message: "Cash Register ID is Required" }),
});

export const createExpenses = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const { data: validateFields, error } = expenseSchema.safeParse(req.body);

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (validateFields?.category === "Ingredients" && !validateFields?.vendorId) {
    throw new BadRequestsException(
      "Vendor is required for Ingredients Expenses",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (
    validateFields?.restock &&
    (!validateFields?.rawMaterials ||
      validateFields?.rawMaterials.length === 0 ||
      validateFields?.rawMaterials?.some((r) => !r.rawMaterialId))
  ) {
    throw new BadRequestsException(
      "Raw Materials are required for Restocking",
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

  const cashRegister = await prismaDB.cashRegister.findFirst({
    where: {
      id: validateFields?.cashRegisterId,
      restaurantId: outletId,
      status: "OPEN",
    },
  });

  if (!cashRegister?.id) {
    throw new NotFoundException("Cash Register Not Found", ErrorCode.NOT_FOUND);
  }

  const result = await prismaDB.$transaction(
    async (tx) => {
      let purchaseId;

      if (
        validateFields.category === "Ingredients" &&
        validateFields?.vendorId &&
        validateFields?.restock
      ) {
        const invoiceNo = await generatePurchaseNo(outlet.id);
        const create = await tx.purchase.create({
          data: {
            restaurantId: outletId,
            // @ts-ignore
            createdBy: `${req?.user?.name}-${req?.user?.role}`,
            vendorId: validateFields?.vendorId,
            invoiceNo: invoiceNo,
            purchaseStatus: "COMPLETED",
            purchaseItems: {
              create: validateFields?.rawMaterials.map((item) => ({
                rawMaterialId: item?.rawMaterialId,
                rawMaterialName: item?.rawMaterialName,
                purchaseUnitId: item?.requestUnitId,
                purchaseUnitName: item?.unitName,
                purchaseQuantity: item?.requestQuantity,
                cgst: item?.gst / 2,
                sgst: item?.gst / 2,
                purchasePrice: item?.total,
              })),
            },
            generatedAmount: validateFields?.amount,
            isPaid: true,
            paymentMethod: validateFields?.paymentMethod,
            totalAmount: validateFields?.amount,
          },
        });
        purchaseId = create?.id;
        // Step 1: Restock raw materials and update `RecipeIngredient` costs
        await Promise.all(
          validateFields?.rawMaterials?.map(async (item) => {
            const rawMaterial = await tx.rawMaterial.findFirst({
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

              await tx.rawMaterial.update({
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
              // Update related alerts to resolved
              await tx.alert.deleteMany({
                where: {
                  restaurantId: outlet.id,
                  itemId: rawMaterial?.id,
                  status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
                },
              });

              const findRecipeIngredients = await tx.recipeIngredient.findFirst(
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
                await tx.recipeIngredient.updateMany({
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
        const recipesToUpdate = await tx.itemRecipe.findMany({
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

            await tx.itemRecipe.update({
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
              await tx.menuItem.update({
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
              await tx.menuItemVariant.update({
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
              await tx.addOnVariants.update({
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
      }

      const createExpense = await tx.expenses.create({
        data: {
          restaurantId: outlet.id,
          date: new Date(),
          // @ts-ignore
          createdBy: `${req?.user?.name} (${req?.user?.role})`,
          vendorId: validateFields?.vendorId ? validateFields?.vendorId : null,
          restock: validateFields?.restock ? validateFields?.restock : false,
          attachments: validateFields?.attachments,
          category: validateFields?.category,
          amount: validateFields?.amount,
          description: validateFields?.description,
          purchaseId: purchaseId,
          paymentMethod: validateFields?.paymentMethod,
        },
      });

      // Create cash transaction for the order
      await prismaDB.cashTransaction.create({
        data: {
          registerId: cashRegister?.id,
          amount: validateFields?.amount,
          type: "CASH_OUT",
          source: "EXPENSE",
          description: validateFields?.description,
          paymentMethod: validateFields?.paymentMethod,
          performedBy: cashRegister?.openedBy,
        },
      });

      return createExpense;
    },
    {
      maxWait: 10000, // 10s maximum wait time
      timeout: 30000, // 30s timeout
    }
  );

  if (result?.id) {
    await redis.publish("orderUpdated", JSON.stringify({ outletId }));
    await redis.del(`alerts-${outletId}`);
    websocketManager.notifyClients(outletId, "NEW_ALERT");
    return res.json({
      success: true,
      message: "Expense Created ✅",
    });
  }
};

export const updateExpenses = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;

  const { data: validateFields, error } = expenseSchema.safeParse(req.body);

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (
    validateFields?.category === "Ingredients" &&
    (!validateFields?.vendorId ||
      !validateFields?.rawMaterials ||
      validateFields?.rawMaterials.length === 0 ||
      validateFields?.rawMaterials?.some((r) => !r.rawMaterialId))
  ) {
    throw new BadRequestsException(
      "Vendor & Raw Materials Required for Expenses",
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

  const result = await prismaDB.$transaction(
    async (tx) => {
      if (validateFields?.category === "Ingredients") {
        const findPurchase = await tx.purchase.findFirst({
          where: {
            id: validateFields?.purchaseId,
            restaurantId: outlet?.id,
          },
          include: {
            purchaseItems: true,
          },
        });

        if (!findPurchase?.id) {
          throw new NotFoundException(
            "Purchase Expense Not Found for RawMaterials",
            ErrorCode.NOT_FOUND
          );
        }

        // Get existing and new raw material IDs
        const existingRawMaterialIds = findPurchase.purchaseItems.map(
          (item) => item.rawMaterialId
        );
        const newRawMaterialIds = validateFields.rawMaterials.map(
          (item) => item.rawMaterialId
        );

        // Find items to delete, update, and create
        const itemsToDelete = findPurchase.purchaseItems.filter(
          (item) => !newRawMaterialIds.includes(item.rawMaterialId)
        );

        const itemsToUpdate = validateFields.rawMaterials.filter((item) =>
          existingRawMaterialIds.includes(item.rawMaterialId)
        );

        const itemsToCreate = validateFields.rawMaterials.filter(
          (item) => !existingRawMaterialIds.includes(item.rawMaterialId)
        );

        // Update purchase with all changes
        await tx.purchase.update({
          where: {
            id: findPurchase?.id,
            restaurantId: outlet?.id,
          },
          data: {
            purchaseItems: {
              // Delete removed items
              deleteMany: itemsToDelete.map((item) => ({
                id: item.id,
              })),

              // Update existing items
              updateMany: itemsToUpdate.map((item) => ({
                where: {
                  rawMaterialId: item.rawMaterialId,
                  purchaseId: findPurchase.id,
                },
                data: {
                  rawMaterialName: item.rawMaterialName,
                  purchaseUnitId: item.requestUnitId,
                  purchaseUnitName: item.unitName,
                  purchaseQuantity: item.requestQuantity,
                  cgst: item.gst / 2,
                  sgst: item.gst / 2,
                  purchasePrice: item.total,
                },
              })),

              // Create new items
              create: itemsToCreate.map((item) => ({
                rawMaterialId: item.rawMaterialId,
                rawMaterialName: item.rawMaterialName,
                purchaseUnitId: item.requestUnitId,
                purchaseUnitName: item.unitName,
                purchaseQuantity: item.requestQuantity,
                cgst: item.gst / 2,
                sgst: item.gst / 2,
                purchasePrice: item.total,
              })),
            },
            generatedAmount: validateFields?.amount,
            totalAmount: validateFields?.amount,
            paymentMethod: validateFields?.paymentMethod,
          },
        });
      }

      const findExpenses = await tx.expenses.findFirst({
        where: {
          id: id,
          restaurantId: outlet?.id,
        },
      });

      if (!findExpenses?.id) {
        throw new NotFoundException("Expense Not Found", ErrorCode.NOT_FOUND);
      }

      const updateExpense = await tx.expenses.update({
        where: {
          id: findExpenses.id,
          restaurantId: outlet.id,
        },
        data: {
          category: validateFields?.category,
          amount: validateFields?.amount,
          description: validateFields?.description,
          attachments: validateFields?.attachments,
          paymentMethod: validateFields?.paymentMethod,
        },
      });

      return updateExpense;
    },
    {
      maxWait: 10000, // 10s maximum wait time
      timeout: 30000, // 30s timeout
    }
  );
  await redis.publish("orderUpdated", JSON.stringify({ outletId }));
  return res.json({
    success: true,
    message: "Expense Updated ✅",
    data: result,
  });
};

export const deleteExpenses = async (req: Request, res: Response) => {
  const { outletId, id } = req.params;

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

  const findExpenses = await prismaDB?.expenses.findFirst({
    where: {
      id: id,
      restaurantId: outlet?.id,
    },
  });

  if (!findExpenses?.id) {
    throw new NotFoundException("Expense Not Found", ErrorCode.NOT_FOUND);
  }

  const deleteExpense = await prismaDB.expenses.delete({
    where: {
      id: findExpenses.id,
      restaurantId: outlet.id,
    },
  });

  if (deleteExpense?.id) {
    await redis.publish("orderUpdated", JSON.stringify({ outletId }));
    return res.json({
      success: true,
      message: "Expense Deleted ✅",
    });
  }
};

export const getAllExpensesForTable = async (req: Request, res: Response) => {
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
      : [{ date: "desc" }];

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  // Fetch total count for the given query
  const totalCount = await prismaDB.expenses.count({
    where: {
      restaurantId: outletId,
      OR: [{ description: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
  });

  const getExpenses = await prismaDB?.expenses.findMany({
    take,
    skip,
    where: {
      restaurantId: outletId,
      OR: [{ description: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
    },
    select: {
      id: true,
      date: true,
      category: true,
      restock: true,
      vendorId: true,
      createdBy: true,
      attachments: true,
      description: true,
      amount: true,
      paymentMethod: true,
      purchase: {
        include: {
          vendor: true,
          purchaseItems: {
            include: {
              rawMaterial: true,
              purchaseUnit: true,
            },
          },
        },
      },
      createdAt: true,
      updatedAt: true,
    },
    orderBy,
  });

  const formattedExpenses = getExpenses?.map((expense) => ({
    id: expense?.id,
    date: expense?.date,
    category: expense?.category,
    createdBy: expense?.createdBy,
    attachments: expense?.attachments,
    description: expense?.description,
    amount: expense?.amount,
    restock: expense?.restock,
    vendorId: expense?.restock
      ? expense?.purchase?.vendor?.id
      : expense?.vendorId,
    purchaseId: expense?.purchase?.id,
    rawMaterials: expense?.purchase?.purchaseItems?.map((item) => ({
      id: item?.rawMaterial?.id,
      rawMaterialId: item?.rawMaterial?.id,
      rawMaterialName: item?.rawMaterial?.name,
      unitName: item?.purchaseUnit?.name,
      requestUnitId: item?.purchaseUnit?.id,
      requestQuantity: item?.purchaseQuantity,
      gstType: item?.gstType,
      netRate: item?.netRate,
      taxAmount: item?.taxAmount,
      total: item?.purchasePrice,
    })),
    paymentMethod: expense?.paymentMethod,
    createdAt: expense?.createdAt,
    updatedAt: expense?.updatedAt,
  }));

  return res.json({
    success: true,
    data: {
      totalCount,
      expenses: formattedExpenses,
    },
  });
};

const expenseCategoryColors: Record<string, string> = {
  Ingredients: "#3b82f6", // Blue
  Utilities: "#eab308", // Yellow
  Salaries: "#22c55e", // Green
  Equipment: "#ef4444", // Red
  Marketing: "#8b5cf6", // Purple
  Rent: "#f97316", // Orange
  Miscellaneous: "#64748b", // Gray
};

export const getCategoryExpensesStats = async (req: Request, res: Response) => {
  const { outletId } = req.params;

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

  // Fetch all expenses for the given outlet
  const expenses = await prismaDB.expenses.findMany({
    where: { restaurantId: outletId },
    select: {
      category: true,
      amount: true,
    },
  });

  // Aggregate amounts by category
  const categoryTotals: Record<string, number> = expenses.reduce(
    (acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    },
    {} as Record<string, number>
  );

  // Calculate total expenses
  const totalExpenses = Object.values(categoryTotals).reduce(
    (sum, amount) => sum + amount,
    0
  );

  // Map categories to stats
  const stats = Object.entries(categoryTotals).map(([category, amount]) => ({
    name: category,
    amount: parseFloat(amount.toFixed(2)),
    percentage: parseFloat(((amount / totalExpenses) * 100).toFixed(2)),
    color: expenseCategoryColors[category] || "#000000", // Default to black if no color assigned
  }));

  return res.json({
    success: true,
    expensesCategoryStats: stats,
  });
};
