import { prismaDB } from "../..";
import { redis } from "../../services/redis";

export const getFetchAllTablesToRedis = async (outletId: string) => {
  const tables = await prismaDB.table.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      orderSession: {
        include: {
          orders: {
            include: { orderItems: true },
          },
        },
      },
      areas: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  await redis.set(`tables-${outletId}`, JSON.stringify(tables));
  return tables;
};

export const getFetchAllAreastoRedis = async (outletId: string) => {
  const allAreas = await prismaDB.areas.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      table: {
        include: {
          orderSession: {
            include: {
              orders: {
                include: {
                  orderItems: true,
                },
              },
            },
          },
        },
      },
    },
  });

  await redis.set(`a-${outletId}`, JSON.stringify(allAreas));
  return allAreas;
};
