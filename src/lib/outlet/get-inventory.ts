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
