import { prismaDB } from "../..";
import { redis } from "../../services/redis";

export const getAllStaff = async (outletId: string) => {
  const staffs = await prismaDB.staff.findMany({
    where: {
      restaurantId: outletId,
    },
  });
  if (staffs?.length > 0) {
    await redis.set(`staffs-${outletId}`, JSON.stringify(staffs));
    return staffs;
  } else {
    await redis.del(`staffs-${outletId}`);
  }
};
