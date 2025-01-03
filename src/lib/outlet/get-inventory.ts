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
  });

  await redis.set(`${outletId}-raw-materials`, JSON.stringify(rawMaterials));
  return rawMaterials;
};

export const fetchOutletRawMaterialCAtegoryToRedis = async (
  outletId: string
) => {
  const rawMaterialsCategory = await prismaDB.rawMaterialCategory.findMany({
    where: {
      restaurantId: outletId,
    },
  });

  await redis.set(
    `${outletId}-raw-materials-category`,
    JSON.stringify(rawMaterialsCategory)
  );

  return rawMaterialsCategory;
};

export const fetchOutletRawMaterialUnitToRedis = async (outletId: string) => {
  const rawMaterialsUnit = await prismaDB.unit.findMany({
    where: {
      restaurantId: outletId,
    },
  });

  await redis.set(
    `${outletId}-raw-materials-unit`,
    JSON.stringify(rawMaterialsUnit)
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

  await redis.set(`${outletId}-stocks`, JSON.stringify(formattedStocks));
  return formattedStocks;
};
