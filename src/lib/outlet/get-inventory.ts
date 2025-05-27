import { prismaDB } from "../..";
import { redis } from "../../services/redis";

export const fetchOutletRawMaterialsToRedis = async (outletId: string) => {
  const rawMaterials = await prismaDB.rawMaterial.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      rawMaterialCategory: true,
      consumptionUnit: true,
      minimumStockUnit: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await redis.set(
    `${outletId}-raw-materials`,
    JSON.stringify(rawMaterials),
    "EX",
    60 * 60 * 12 // 12 hours
  );
  return rawMaterials;
};

export const fetchOutletRawMaterialCAtegoryToRedis = async (
  outletId: string
) => {
  const rawMaterialsCategory = await prismaDB.rawMaterialCategory.findMany({
    where: {
      restaurantId: outletId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await redis.set(
    `${outletId}-raw-materials-category`,
    JSON.stringify(rawMaterialsCategory),
    "EX",
    60 * 60 * 12 // 12 hours
  );

  return rawMaterialsCategory;
};

export const fetchOutletRawMaterialUnitToRedis = async (outletId: string) => {
  const rawMaterialsUnit = await prismaDB.unit.findMany({
    where: {
      restaurantId: outletId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await redis.set(
    `${outletId}-raw-materials-unit`,
    JSON.stringify(rawMaterialsUnit),
    "EX",
    60 * 60 * 12 // 12 hours
  );

  return rawMaterialsUnit;
};

export const getfetchOutletStocksToRedis = async (outletId: string) => {
  const rawMaterials = await prismaDB.rawMaterial.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      rawMaterialCategory: true,
      consumptionUnit: true,
      minimumStockUnit: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const formattedStocks = rawMaterials?.map((rawItem) => ({
    id: rawItem?.id,
    name: rawItem?.name,
    consumptionUnit: rawItem.consumptionUnit.name,
    lastPurchasedStock: `${rawItem.purchasedStock?.toFixed(2)} - ${
      rawItem?.purchasedUnit
    }`,
    stock: `${rawItem.currentStock?.toFixed(2)} - ${rawItem?.purchasedUnit}`,
    purchasedPrice: rawItem?.purchasedPrice,
    lastPurchasedPrice: rawItem?.lastPurchasedPrice,
    purchasedPricePerItem: rawItem?.purchasedPricePerItem,
    purchasedStock: `${rawItem.currentStock} - ${rawItem?.purchasedUnit}`,
    createdAt: rawItem.createdAt,
  }));

  await redis.set(
    `${outletId}-stocks`,
    JSON.stringify(formattedStocks),
    "EX",
    60 * 60 * 12 // 12 hours
  );
  return formattedStocks;
};

export const getRawMaterialById = async (outletId: string, id: string) => {
  const rawMaterial = await prismaDB.rawMaterial.findFirst({
    where: {
      id,
      restaurantId: outletId,
    },
    select: {
      id: true,
      name: true,
      currentStock: true,
      consumptionUnitId: true,
      conversionFactor: true,
    },
  });
  return rawMaterial;
};

export const calculateFoodServerForItemRecipe = async (
  recipeId: string,
  outletId: string
) => {
  const findrecipe = await prismaDB.itemRecipe.findFirst({
    where: {
      id: recipeId,
      restaurantId: outletId,
    },
    include: {
      ingredients: true,
    },
  });

  const servingsList = [];

  if (!findrecipe?.id) return 0;

  for (const recipe of findrecipe?.ingredients) {
    const ingredient = await getRawMaterialById(
      outletId,
      recipe?.rawMaterialId
    );
    //3.4L
    const availableStock = ingredient?.currentStock;
    console.log(`Ingredient ${ingredient?.name} = ${availableStock}`);
    //gm UnitId
    const unitId = ingredient?.consumptionUnitId;
    console.log(
      `Consumption UnitId:${unitId} & Recipe MOU Unit ${recipe?.unitId}`
    );
    //if gm consumptionyunitId is not equal to  recipe unit id i,e gm
    if (unitId !== recipe?.unitId) {
      //2.3 in Litre available stock and
      const servings = Math.floor(
        Number(availableStock) / Number(recipe?.quantity)
      );
      console.log(`Not Equals Unit ${servings}`);
      servingsList.push(servings);
    } else {
      //2,3*1000
      const conversion =
        Number(availableStock || 0) * Number(ingredient?.conversionFactor);
      const servings = Math.floor(
        Number(conversion) / Number(recipe?.quantity)
      );
      console.log(` Equals Unit ${servings}`);
      servingsList.push(servings);
    }
  }
  console.log(servingsList);
  return Math.min(...servingsList);
};
