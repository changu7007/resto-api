import { prismaDB } from "../..";
import { redis } from "../../services/redis";

export const getAllStaff = async (outletId: string) => {
  const staffs = await prismaDB.staff.findMany({
    where: {
      restaurantId: outletId,
    },
  });

  await redis.set(`staffs-${outletId}`, JSON.stringify(staffs), "EX", 300);
};
