import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { getPeriodDates } from "../../../lib/utils";
import { getStaffById } from "../../../lib/get-users";
import { subMonths, format } from "date-fns";

export const orderStatsForOutlet = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { period } = req.query;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const { startDate, endDate } = getPeriodDates(period as string);

  const orders = await prismaDB.order.findMany({
    where: {
      restaurantId: outlet.id,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      totalAmount: true,
      orderType: true,
    },
  });

  // Initialize totals for all types and the "All" category
  const totals = {
    all: { revenue: 0, orders: 0 },
    express: { revenue: 0, orders: 0 },
    dineIn: { revenue: 0, orders: 0 },
    delivery: { revenue: 0, orders: 0 },
    takeaway: { revenue: 0, orders: 0 },
  };

  // Sum up the revenue and order counts for each category and the total
  orders.forEach((order) => {
    const amount = parseFloat(order.totalAmount);

    // Sum for all orders
    totals.all.revenue += amount;
    totals.all.orders++;

    // Sum for each orderType
    switch (order.orderType) {
      case "EXPRESS":
        totals.express.revenue += amount;
        totals.express.orders++;
        break;
      case "DINEIN":
        totals.dineIn.revenue += amount;
        totals.dineIn.orders++;
        break;
      case "DELIVERY":
        totals.delivery.revenue += amount;
        totals.delivery.orders++;
        break;
      case "TAKEAWAY":
        totals.takeaway.revenue += amount;
        totals.takeaway.orders++;
        break;
    }
  });

  // Format the stats (this is just an example, you can adjust the format)
  const expressFormattedStats = {
    totalRevenue: totals.all.revenue,
    totalOrders: totals.all.orders,
    stats: [
      {
        type: "EXPRESS",
        revenue: totals.express.revenue,
        orders: totals.express.orders,
      },
      {
        type: "DELIVERY",
        revenue: totals.delivery.revenue,
        orders: totals.delivery.orders,
      },
      {
        type: "TAKEAWAY",
        revenue: totals.takeaway.revenue,
        orders: totals.takeaway.orders,
      },
    ],
  };

  const formattedStats = {
    totalRevenue: totals.all.revenue,
    totalOrders: totals.all.orders,
    stats: [
      {
        type: "DINEIN",
        revenue: totals.dineIn.revenue,
        orders: totals.dineIn.orders,
      },
      {
        type: "DELIVERY",
        revenue: totals.delivery.revenue,
        orders: totals.delivery.orders,
      },
      {
        type: "TAKEAWAY",
        revenue: totals.takeaway.revenue,
        orders: totals.takeaway.orders,
      },
    ],
  };

  if (outlet.outletType === "BAKERY" || outlet.outletType === "EXPRESS") {
    return res.json({
      success: true,
      stats: expressFormattedStats,
      message: "Powered Up",
    });
  } else {
    return res.json({
      success: true,
      stats: formattedStats,
      message: "Powered Up",
    });
  }
};

export const orderStatsForOutletByStaff = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;
  const { period } = req.query;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }
  //@ts-ignore
  const staff = await getStaffById(outlet.id, req.user?.id);

  if (!staff?.id) {
    throw new NotFoundException("Unauthorized", ErrorCode.UNAUTHORIZED);
  }

  const { startDate, endDate } = getPeriodDates(period as string);

  const orders = await prismaDB.order.findMany({
    where: {
      restaurantId: outlet.id,
      staffId: staff?.id,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      totalAmount: true,
      orderType: true,
    },
  });

  // Initialize totals for all types and the "All" category
  const totals = {
    all: { revenue: 0, orders: 0 },
    dineIn: { revenue: 0, orders: 0 },
    delivery: { revenue: 0, orders: 0 },
    takeaway: { revenue: 0, orders: 0 },
  };

  // Sum up the revenue and order counts for each category and the total
  orders.forEach((order) => {
    const amount = parseFloat(order.totalAmount);

    // Sum for all orders
    totals.all.revenue += amount;
    totals.all.orders++;

    // Sum for each orderType
    switch (order.orderType) {
      case "DINEIN":
        totals.dineIn.revenue += amount;
        totals.dineIn.orders++;
        break;
      case "DELIVERY":
        totals.delivery.revenue += amount;
        totals.delivery.orders++;
        break;
      case "TAKEAWAY":
        totals.takeaway.revenue += amount;
        totals.takeaway.orders++;
        break;
    }
  });

  // Format the stats (this is just an example, you can adjust the format)
  const formattedStats = {
    totalRevenue: totals.all.revenue,
    totalOrders: totals.all.orders,
    stats: [
      {
        type: "DINEIN",
        revenue: totals.dineIn.revenue,
        orders: totals.dineIn.orders,
      },
      {
        type: "DELIVERY",
        revenue: totals.delivery.revenue,
        orders: totals.delivery.orders,
      },
      {
        type: "TAKEAWAY",
        revenue: totals.takeaway.revenue,
        orders: totals.takeaway.orders,
      },
    ],
  };

  return res.json({
    success: true,
    stats: formattedStats,
    message: "Powered Up",
  });
};

type TopItem = {
  id: string;
  name: string;
  category: string;
  orders: number;
  revenue: number;
  imageUrl: string; // Assuming you have an image URL for the food item
};

export const outletTopSellingItems = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const period = req.query.period || "all";
  const categoryId = (req.query.categoryId as string) || "all";

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const { startDate, endDate } = getPeriodDates(period as string);

  // Build the filter for category
  const categoryFilter =
    categoryId !== "all" ? { categoryId: { categoryId: categoryId } } : {};

  // Fetch top-selling items
  const topItems = await prismaDB.orderItem.findMany({
    where: {
      order: {
        restaurantId: outlet.id,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      menuItem: categoryFilter.categoryId ? { categoryId: categoryId } : {},
    },
    include: {
      menuItem: {
        include: {
          category: true,
          images: true,
        },
      },
    },
  });

  // Aggregate the data
  const aggregated: { [key: string]: TopItem } = {};

  topItems.forEach((item) => {
    const foodId = item.menuItem.id;
    if (!aggregated[foodId]) {
      aggregated[foodId] = {
        id: foodId,
        name: item.menuItem.name,
        category: item.menuItem.category.name,
        orders: 0,
        revenue: 0,
        imageUrl: item.menuItem.images[0].url, // Adjust as needed
      };
    }
    aggregated[foodId].orders += Number(item.quantity);
    aggregated[foodId].revenue += Number(item.price);
  });

  // Convert the aggregated object to an array and sort by orders
  const sortedTopItems = Object.values(aggregated)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5); // Top 5 items
  return res.json({
    success: true,
    topItems: sortedTopItems,
    message: "Powered Up",
  });
};

export const lastSixMonthsOrders = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const sixMonthsAgo = subMonths(new Date(), 6);

  const orders = await prismaDB.order.findMany({
    where: {
      restaurantId: outlet?.id,
      createdAt: {
        gte: sixMonthsAgo,
      },
      // orderStatus: "COMPLETED",
    },
    select: {
      orderType: true,
      createdAt: true,
    },
  });

  // Initialize an object to accumulate order counts by month and orderType
  const monthlyData: Record<
    string,
    { express: number; dineIn: number; takeaway: number; delivery: number }
  > = {};

  orders?.forEach((order) => {
    const month = format(order?.createdAt, "MMMM");

    if (!monthlyData[month]) {
      monthlyData[month] = { express: 0, dineIn: 0, delivery: 0, takeaway: 0 };
    }

    switch (order?.orderType) {
      case "EXPRESS":
        monthlyData[month].express++;
        break;
      case "DINEIN":
        monthlyData[month].dineIn++;
        break;
      case "TAKEAWAY":
        monthlyData[month].takeaway++;
        break;
      case "DELIVERY":
        monthlyData[month].delivery++;
        break;
    }
  });

  const chartData = Array.from({ length: 6 })
    .map((_, index) => {
      const month = format(subMonths(new Date(), index), "MMMM");
      return {
        month,
        Express: monthlyData[month]?.express || 0,
        DineIn: monthlyData[month]?.dineIn || 0,
        Takeaway: monthlyData[month]?.takeaway || 0,
        Delivery: monthlyData[month]?.delivery || 0,
      };
    })
    .reverse();

  return res.json({
    success: true,
    monthStats: chartData,
  });
};
