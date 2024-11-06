import { prismaDB } from "../..";
import { NotFoundException } from "../../exceptions/not-found";
import { ErrorCode } from "../../exceptions/root";

export const getOutletById = async (id: string) => {
  try {
    const getOutlet = await prismaDB.restaurant.findFirst({
      where: {
        id: id,
      },
    });

    if (!getOutlet?.id) {
      throw new NotFoundException(
        "Outlet Not Found In",
        ErrorCode.OUTLET_NOT_FOUND
      );
    }

    return getOutlet;
  } catch (error) {
    console.log("Something Went Wrong");
  }
};

export const getOutletByAdminId = async (id: string, adminId: string) => {
  try {
    const getOutlet = await prismaDB.restaurant.findFirst({
      where: {
        id: id,
        adminId: adminId,
      },
    });

    if (!getOutlet?.id) {
      throw new NotFoundException(
        "Outlet Not Found In",
        ErrorCode.OUTLET_NOT_FOUND
      );
    }

    return getOutlet;
  } catch (error) {
    console.log("Something Went Wrong");
  }
};

export const getOutletByIdForStaff = async (id: string) => {
  const getOutlet = await prismaDB.restaurant.findFirst({
    where: {
      id,
    },
  });
  return getOutlet;
};

const getTodayOrdersCount = async (restaurantId: string) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const outlet = await getOutletByIdForStaff(restaurantId);

  const getOrdersCount = await prismaDB.order.findMany({
    where: {
      restaurantId: outlet?.id,
      createdAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
  });
  return getOrdersCount.length;
};

const getTotalOrderSession = async (outletId: string) => {
  const orderCount = await prismaDB.orderSession.findMany({
    where: {
      restaurantId: outletId,
    },
  });
  return orderCount.length;
};

export const generateBillNo = async (outletId: string) => {
  const orderCount = await getTotalOrderSession(outletId);
  const billId = `#${orderCount + 1}`;
  return billId;
};

export const getOrderByOutketId = async (outletId: string, orderId: string) => {
  const getOrder = await prismaDB.order.findFirst({
    where: {
      restaurantId: outletId,
      id: orderId,
    },
  });

  return getOrder;
};

export const getOrderSessionById = async (
  outletId: string,
  orderSessionId: string
) => {
  const getOrderSession = await prismaDB.orderSession.findFirst({
    where: {
      restaurantId: outletId,
      id: orderSessionId,
    },
    include: {
      table: true,
    },
  });

  return getOrderSession;
};

export const generatedOrderId = async (outletId: string) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const getOrdersCount = await prismaDB.order.findMany({
    where: {
      restaurantId: outletId,
      createdAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
  });

  const length = getOrdersCount.length;

  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // last 2 digits of the year
  const month = String(now.getMonth() + 1).padStart(2, "0"); // month with leading zero
  const day = String(now.getDate()).padStart(2, "0"); // day with leading zero

  const orderNumber = String(length + 1).padStart(4, "0"); // incrementing number with leading zeros

  const orderId = `${day}${month}${year}${orderNumber}`;
  return orderId;
};

export const getItemByOutletId = async (outletId: string, itemId: string) => {
  const getItem = await prismaDB.menuItem.findUnique({
    where: {
      restaurantId: outletId,
      id: itemId,
    },
    include: {
      images: true,
      menuItemVariants: true,
      menuGroupAddOns: true,
    },
  });

  return getItem;
};

export const getVariantByOutletId = async (
  outletId: string,
  variantId: string
) => {
  const getVariant = await prismaDB.variants.findUnique({
    where: {
      restaurantId: outletId,
      id: variantId,
    },
  });

  return getVariant;
};

export const getAddOnByOutletId = async (outletId: string, addOnId: string) => {
  const getAddon = await prismaDB.addOns.findUnique({
    where: {
      restaurantId: outletId,
      id: addOnId,
    },
    include: {
      addOnVariants: true,
    },
  });

  return getAddon;
};

export const getCategoryByOutletId = async (
  outletId: string,
  categoryId: string
) => {
  const category = await prismaDB.category.findUnique({
    where: {
      restaurantId: outletId,
      id: categoryId,
    },
  });

  return category;
};
