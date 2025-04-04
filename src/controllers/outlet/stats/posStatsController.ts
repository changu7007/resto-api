import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import {
  endOfDay,
  set,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { DateTime } from "luxon";

// Helper function to calculate percentage change
const calculatePercentageChange = (
  current: number,
  previous: number
): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  const percentageChange = ((current - previous) / previous) * 100;
  return Number(percentageChange.toFixed(2));
};

interface OrderTypeCount {
  type: string;
  count: number;
}

export const getPosStats = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  //@ts-ignore
  const { id: staffId } = req.user;
  const outlet = await getOutletById(outletId);

  const timeZone = "Asia/Kolkata"; // Default timezone
  const today = new Date();
  const yesterday = subDays(today, 1);
  const lastMonth = subDays(today, 30);

  let startHour = 0;
  let endHour = 23;

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.NOT_FOUND);
  }

  if (outlet?.openTime && outlet?.closeTime) {
    startHour = parseInt(outlet?.openTime.split(":")[0]);
    const closeHour = parseInt(outlet?.closeTime.split(":")[0]);
    endHour = closeHour < startHour ? closeHour + 24 : closeHour;
  }

  // Generate hours array based on operating hours
  const operatingHours: number[] = [];
  for (let i = startHour; i <= endHour; i++) {
    operatingHours.push(i % 24);
  }

  // Get today's date range in restaurant's timezone
  const todayStart = DateTime.now()
    .setZone(timeZone)
    .startOf("day")
    .toUTC()
    .toISO();
  const todayEnd = DateTime.now()
    .setZone(timeZone)
    .endOf("day")
    .toUTC()
    .toISO();

  const currentRevenue = await prismaDB.order.aggregate({
    where: {
      restaurantId: outletId,
      staffId: staffId,
      orderStatus: "COMPLETED",
      isPaid: true,
      updatedAt: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
    },
    _sum: {
      totalAmount: true,
    },
  });

  const previousRevenue = await prismaDB.order.aggregate({
    where: {
      restaurantId: outletId,
      staffId: staffId,
      orderStatus: "COMPLETED",
      isPaid: true,
      updatedAt: {
        gte: subDays(lastMonth, 30),
        lte: lastMonth,
      },
    },
    _sum: {
      totalAmount: true,
    },
  });

  //active orders
  const activeOrders = await prismaDB.order.count({
    where: {
      restaurantId: outletId,
      staffId: staffId,
      orderStatus: {
        in: ["PREPARING", "FOODREADY", "INCOMMING", "SERVED", "OUTFORDELIVERY"],
      },
    },
  });

  //Get Total Orders and average order value
  const totalOrders = await prismaDB.order.aggregate({
    where: {
      restaurantId: outletId,
      staffId: staffId,
      orderStatus: "COMPLETED",
      updatedAt: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
    },
    _avg: {
      totalAmount: true,
    },
    _count: true,
  });

  // Get active tables
  const tables = await prismaDB.table.aggregate({
    where: {
      restaurantId: outletId,
    },
    _count: {
      id: true,
    },
  });

  const activeTables = await prismaDB.table.count({
    where: {
      restaurantId: outletId,
      occupied: true,
    },
  });

  // Get today's orders by hour
  const getTodayOrdersByHour = async () => {
    // Start and end of today in the restaurant's time zone
    const todayStart = DateTime.now()
      .setZone(timeZone)
      .startOf("day")
      .toUTC()
      .toISO();
    const todayEnd =
      DateTime.now().setZone(timeZone).endOf("day").toUTC().toISO() ??
      new Date().toISOString();

    if (!todayStart || !todayEnd) {
      throw new Error("Failed to calculate today's date range.");
    }

    // Get all orders for today
    const orders = await prismaDB.order.groupBy({
      by: ["createdAt"],
      _count: {
        id: true,
      },
      where: {
        restaurantId: outletId,
        createdAt: {
          gte: new Date(todayStart),
          lte: new Date(todayEnd),
        },
      },
    });

    // Get order statuses for today
    const orderStatuses = await prismaDB.order.groupBy({
      by: ["createdAt", "orderStatus"],
      _count: {
        id: true,
      },
      where: {
        restaurantId: outletId,
        createdAt: {
          gte: new Date(todayStart),
          lte: new Date(todayEnd),
        },
      },
    });

    // Get orders by type for today
    const ordersByType = await prismaDB.order.groupBy({
      by: ["createdAt", "orderType"],
      _count: {
        id: true,
      },
      where: {
        restaurantId: outletId,
        createdAt: {
          gte: new Date(todayStart),
          lte: new Date(todayEnd),
        },
      },
    });

    // Generate data only for outlet operating hours
    const hours = Array.from(
      { length: endHour - startHour + 1 },
      (_, i) => (startHour + i) % 24
    );

    const ordersByHour = hours.map((hour) => {
      // Filter orders for this hour
      const ordersAtHour = orders.filter((order) => {
        const orderHour = DateTime.fromJSDate(order.createdAt, {
          zone: timeZone,
        }).hour;
        return orderHour === hour;
      });

      // Count total orders for this hour
      const count = ordersAtHour.reduce(
        (sum, order) => sum + order._count.id,
        0
      );

      // Get order statuses for this hour
      const statuses = orderStatuses
        .filter((status) => {
          const statusHour = DateTime.fromJSDate(status.createdAt, {
            zone: timeZone,
          }).hour;
          return statusHour === hour;
        })
        .reduce((acc, status) => {
          acc[status.orderStatus] = status._count.id;
          return acc;
        }, {} as Record<string, number>);

      // Get orders by type for this hour
      const typeOrders = ordersByType.filter((order) => {
        const orderHour = DateTime.fromJSDate(order.createdAt, {
          zone: timeZone,
        }).hour;
        return orderHour === hour;
      });

      // Calculate counts for each order type
      const dineInCount = typeOrders
        .filter((o) => o.orderType === "DINEIN")
        .reduce((sum, o) => sum + o._count.id, 0);

      const takeawayCount = typeOrders
        .filter((o) => o.orderType === "TAKEAWAY")
        .reduce((sum, o) => sum + o._count.id, 0);

      const deliveryCount = typeOrders
        .filter((o) => o.orderType === "DELIVERY")
        .reduce((sum, o) => sum + o._count.id, 0);

      const expressCount = typeOrders
        .filter((o) => o.orderType === "EXPRESS")
        .reduce((sum, o) => sum + o._count.id, 0);

      return {
        hour: `${hour.toString().padStart(2, "0")}:00`,
        count,
        status: statuses,
        dineIn: dineInCount,
        takeaway: takeawayCount,
        delivery: deliveryCount,
        express: expressCount,
        total: count,
      };
    });

    return ordersByHour;
  };

  // Modified getDailyOrderStats to use operating hours
  const getDailyOrderStats = async () => {
    const result = (await prismaDB.order.aggregateRaw({
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: ["$restaurantId", { $toObjectId: outletId }],
            },
          },
        },
        {
          $addFields: {
            hour: {
              $hour: {
                date: "$updatedAt",
                timezone: "Asia/Kolkata",
              },
            },
          },
        },
        {
          $group: {
            _id: {
              hour: "$hour",
              orderType: "$orderType",
            },
            count: { $sum: 1 },
          },
        },
      ],
    })) as unknown as Array<{
      _id: { hour: number; orderType: string };
      count: number;
    }>;

    // Convert the raw aggregation result to the required format
    // Format the results
    const formattedStats = operatingHours.map((hour) => {
      const hourOrders = result.filter((r) => r._id.hour === hour);

      return {
        time: `${hour.toString().padStart(2, "0")}:00`,
        dineIn:
          hourOrders.find((o) => o._id.orderType === "DINEIN")?.count || 0,
        takeaway:
          hourOrders.find((o) => o._id.orderType === "TAKEAWAY")?.count || 0,
        delivery:
          hourOrders.find((o) => o._id.orderType === "DELIVERY")?.count || 0,
        express:
          hourOrders.find((o) => o._id.orderType === "EXPRESS")?.count || 0,
        total: hourOrders.reduce((acc, o) => acc + o.count, 0),
      };
    });

    return formattedStats;
  };

  const getWeeklyOrderStats = async () => {
    const result = (await prismaDB.order.aggregateRaw({
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: ["$restaurantId", { $toObjectId: outletId }],
            },
          },
        },
        {
          $addFields: {
            dayOfWeek: {
              $dayOfWeek: {
                date: "$updatedAt",
                timezone: "Asia/Kolkata",
              },
            },
          },
        },
        {
          $group: {
            _id: {
              dayOfWeek: "$dayOfWeek",
              orderType: "$orderType",
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            "_id.dayOfWeek": 1,
          },
        },
      ],
    })) as unknown as Array<{
      _id: { dayOfWeek: number; orderType: string };
      count: number;
    }>;

    console.log("Weekly Raw MongoDB Result:", JSON.stringify(result, null, 2));

    // MongoDB dayOfWeek: 1 (Sunday) to 7 (Saturday)
    // Convert to: 0 (Sunday) to 6 (Saturday)
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Format the results
    const formattedStats = daysOfWeek.map((day, index) => {
      // MongoDB's dayOfWeek is 1-based, so we add 1 to our index
      const dayOrders = result.filter((r) => r._id.dayOfWeek === index + 1);

      return {
        time: day,
        dineIn: dayOrders.find((o) => o._id.orderType === "DINEIN")?.count || 0,
        takeaway:
          dayOrders.find((o) => o._id.orderType === "TAKEAWAY")?.count || 0,
        delivery:
          dayOrders.find((o) => o._id.orderType === "DELIVERY")?.count || 0,
        express:
          dayOrders.find((o) => o._id.orderType === "EXPRESS")?.count || 0,
        total: dayOrders.reduce((acc, o) => acc + o.count, 0),
      };
    });

    return formattedStats;
  };

  // Calculate growth percentages
  const calculateGrowth = async () => {
    const today = await prismaDB.order.groupBy({
      by: ["orderType"],
      where: {
        restaurantId: outletId,
        createdAt: {
          gte: startOfDay(new Date()),
        },
      },
      _count: true,
    });

    const yesterday = await prismaDB.order.groupBy({
      by: ["orderType"],
      where: {
        restaurantId: outletId,
        createdAt: {
          gte: startOfDay(subDays(new Date(), 1)),
          lt: startOfDay(new Date()),
        },
      },
      _count: true,
    });

    return {
      dineIn: calculatePercentageChange(
        today.find((t) => t.orderType === "DINEIN")?._count || 0,
        yesterday.find((t) => t.orderType === "DINEIN")?._count || 0
      ),
      express: calculatePercentageChange(
        today.find((t) => t.orderType === "EXPRESS")?._count || 0,
        yesterday.find((t) => t.orderType === "EXPRESS")?._count || 0
      ),
      takeaway: calculatePercentageChange(
        today.find((t) => t.orderType === "TAKEAWAY")?._count || 0,
        yesterday.find((t) => t.orderType === "TAKEAWAY")?._count || 0
      ),
      delivery: calculatePercentageChange(
        today.find((t) => t.orderType === "DELIVERY")?._count || 0,
        yesterday.find((t) => t.orderType === "DELIVERY")?._count || 0
      ),
    };
  };

  const [dailyStats, weeklyStats, growth, todayOrdersByHour] =
    await Promise.all([
      getDailyOrderStats(),
      getWeeklyOrderStats(),
      calculateGrowth(),
      getTodayOrdersByHour(),
    ]);

  // Filter order types based on outlet type
  const isBakeryOrExpress =
    outlet.outletType === "BAKERY" || outlet.outletType === "EXPRESS";

  const filterOrderTypes = (data: any[]) => {
    return data.map((item) => {
      const filtered = { ...item };
      if (isBakeryOrExpress) {
        delete filtered.dineIn;
      } else {
        delete filtered.express;
      }
      return filtered;
    });
  };

  res.json({
    success: true,
    data: {
      totalSalesRevenue: {
        amount: currentRevenue._sum.totalAmount || 0,
        percentageChange: calculatePercentageChange(
          currentRevenue._sum.totalAmount || 0,
          previousRevenue._sum.totalAmount || 0
        ).toFixed(2),
      },
      activeOrders,
      totalOrders: {
        count: totalOrders._count,
        averageOrderValue: Math.round(totalOrders._avg.totalAmount || 0),
      },
      activeTables: {
        active: activeTables,
        total: tables._count.id,
        occupancyRate: Math.round((activeTables / tables._count.id) * 100),
      },
      orderingGrowth: {
        growth: isBakeryOrExpress
          ? {
              takeaway: growth.takeaway,
              delivery: growth.delivery,
              express: growth.express,
            }
          : {
              dineIn: growth.dineIn,
              takeaway: growth.takeaway,
              delivery: growth.delivery,
            },
        todays: filterOrderTypes(todayOrdersByHour),
        daily: filterOrderTypes(dailyStats),
        weekly: filterOrderTypes(weeklyStats),
      },
    },
  });
};

export const getPopularItems = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  const [popularItems, total] = await Promise.all([
    prismaDB.orderItem.groupBy({
      by: ["menuId", "name"],
      where: {
        order: {
          restaurantId: outletId,
          orderStatus: "COMPLETED",
        },
      },
      _count: {
        menuId: true,
      },
      orderBy: {
        _count: {
          menuId: "desc",
        },
      },
      take: limit,
      skip,
    }),
    prismaDB.orderItem
      .groupBy({
        by: ["menuId"],
        where: {
          order: {
            restaurantId: outletId,
            orderStatus: "COMPLETED",
          },
        },
      })
      .then((items) => items.length),
  ]);

  // Get category names for each menu item
  const itemsWithCategories = await Promise.all(
    popularItems.map(async (item) => {
      const menuItem = await prismaDB.menuItem.findUnique({
        where: { id: item.menuId },
        select: {
          category: {
            select: { name: true },
          },
        },
      });

      return {
        name: item.name,
        category: menuItem?.category.name || "Uncategorized",
        orderCount: item._count.menuId,
      };
    })
  );

  res.json({
    success: true,
    data: {
      items: itemsWithCategories,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      },
    },
  });
};

// Get Staff Performance based on OrderSession and Orders
export const getStaffPerformance = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  const [staffPerformance, total] = await Promise.all([
    prismaDB.orderSession.groupBy({
      by: ["staffId"],
      where: {
        restaurantId: outletId,
        sessionStatus: "COMPLETED",
        staffId: { not: null },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: limit,
      skip,
    }),
    prismaDB.orderSession
      .groupBy({
        by: ["staffId"],
        where: {
          restaurantId: outletId,
          sessionStatus: "COMPLETED",
          staffId: { not: null },
        },
      })
      .then((staff) => staff.length),
  ]);

  // Get staff details
  const staffWithDetails = await Promise.all(
    staffPerformance.map(async (perf) => {
      const staff = await prismaDB.staff.findUnique({
        where: { id: perf.staffId! },
        select: {
          name: true,
          role: true,
        },
      });

      return {
        name: staff?.name || "Unknown",
        role: staff?.role || "Unknown",
        orderCount: perf._count.id,
      };
    })
  );

  res.json({
    success: true,
    data: {
      staff: staffWithDetails,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      },
    },
  });
};

// Get Inventory Alerts based on RawMaterial
export const getInventoryAlerts = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  const [lowStockItems, total] = await Promise.all([
    prismaDB.rawMaterial.findMany({
      where: {
        restaurantId: outletId,
        currentStock: {
          lte: 10, // Assuming low stock threshold is 10
        },
      },
      select: {
        name: true,
        currentStock: true,
        consumptionUnit: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        currentStock: "asc",
      },
      take: limit,
      skip,
    }),
    prismaDB.rawMaterial.count({
      where: {
        restaurantId: outletId,
        currentStock: {
          lte: 10,
        },
      },
    }),
  ]);

  res.json({
    success: true,
    data: {
      alerts: lowStockItems.map((item) => ({
        itemName: item.name,
        currentStock: item.currentStock?.toFixed(2),
        unit: item.consumptionUnit.name,
        alertType: "LOW_STOCK",
      })),
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
      },
    },
  });
};

// Get Inventory Overview Statistics
export const getInventoryOverview = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  // Get total inventory value
  const totalInventoryValue = await prismaDB.rawMaterial.aggregate({
    where: {
      restaurantId: outletId,
    },
    _sum: {
      purchasedPricePerItem: true,
    },
  });

  // Get low stock items count
  const lowStockItems = await prismaDB.rawMaterial.count({
    where: {
      restaurantId: outletId,
      currentStock: {
        lte: prismaDB.rawMaterial.fields.minimumStockLevel,
      },
    },
  });

  // Get active vendors count
  const activeVendors = await prismaDB.vendor.count({
    where: {
      restaurantId: outletId,
    },
  });

  // Calculate inventory turnover
  // First, get total purchases in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const monthlyPurchases = await prismaDB.purchase.aggregate({
    where: {
      restaurantId: outletId,
      createdAt: {
        gte: thirtyDaysAgo,
      },
      purchaseStatus: "COMPLETED",
    },
    _sum: {
      totalAmount: true,
    },
  });

  // Calculate turnover rate (monthly purchases / current inventory value)
  const turnoverRate =
    monthlyPurchases._sum.totalAmount &&
    totalInventoryValue._sum.purchasedPricePerItem
      ? (
          monthlyPurchases._sum.totalAmount /
          totalInventoryValue._sum.purchasedPricePerItem
        ).toFixed(1)
      : 0;

  // Get stock movement trend (last 6 months)
  const sixMonthsAgo = subMonths(new Date(), 6);
  const stockMovement = await prismaDB.purchase.groupBy({
    by: ["createdAt"],
    where: {
      restaurantId: outletId,
      purchaseStatus: "COMPLETED",
      createdAt: {
        gte: startOfMonth(sixMonthsAgo),
      },
    },
    _sum: {
      totalAmount: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Get category distribution
  const categoryDistribution = await prismaDB.rawMaterialCategory.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      ramMaterial: {
        select: {
          purchasedPricePerItem: true,
          currentStock: true,
        },
      },
    },
  });

  const formattedCategoryDistribution = categoryDistribution.map(
    (category) => ({
      category: category.name,
      value: category.ramMaterial.reduce(
        (sum, item) =>
          sum + (item.purchasedPricePerItem || 0) * (item.currentStock || 0),
        0
      ),
    })
  );

  // Format stock movement data
  const formattedStockMovement = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), i);
    const monthData = stockMovement.find(
      (entry) =>
        new Date(entry.createdAt).getMonth() === month.getMonth() &&
        new Date(entry.createdAt).getFullYear() === month.getFullYear()
    );
    return {
      month: month.toLocaleString("default", { month: "short" }),
      value: monthData?._sum.totalAmount || 0,
    };
  }).reverse();

  res.json({
    success: true,
    data: {
      totalValue: totalInventoryValue._sum.purchasedPricePerItem || 0,
      lowStockItems,
      turnoverRate: Number(turnoverRate),
      activeVendors,
      stockMovementData: formattedStockMovement,
      categoryDistributionData: formattedCategoryDistribution,
    },
  });
};
interface ColumnFilter {
  id: string;
  value: string;
}
// Get Stock Levels with search, category filter and pagination
export const getStockLevels = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { search = "" as string, pageIndex, pageSize } = req.query;

  try {
    const take = Number(pageSize) || 4;
    const skip = Number(pageIndex) * take;

    // Parse the filters from the nested query format
    let categoryFilters: string[] = [];
    if (req.query.filters && typeof req.query.filters === "object") {
      const filtersObj = req.query.filters as Record<string, any>;
      // Check if we have category filter
      if (
        filtersObj[0] &&
        filtersObj[0].id === "category" &&
        Array.isArray(filtersObj[0].value)
      ) {
        categoryFilters = filtersObj[0].value;
      }
    }

    // Base query conditions
    const baseWhere = {
      restaurantId: outletId,
      ...(search
        ? {
            name: {
              contains: search as string,
              mode: "insensitive" as const,
            },
          }
        : {}),
      ...(categoryFilters.length > 0
        ? {
            OR: categoryFilters.map((category) => ({
              rawMaterialCategory: {
                name: category,
              },
            })),
          }
        : {}),
    };

    // Get categories for filter
    const categories = await prismaDB.rawMaterialCategory.findMany({
      where: {
        restaurantId: outletId,
      },
      select: {
        name: true,
      },
    });

    const formattedCategories = [...categories.map((c) => c.name)];

    // Get stock items with pagination
    const [items, total] = await Promise.all([
      prismaDB.rawMaterial.findMany({
        where: baseWhere,
        include: {
          rawMaterialCategory: true,
          consumptionUnit: true,
          minimumStockUnit: true,
          purchaseItems: {
            orderBy: {
              purchase: {
                createdAt: "desc",
              },
            },
            take: 1,
            include: {
              purchase: {
                select: {
                  createdAt: true,
                },
              },
            },
          },
        },
        orderBy: {
          name: "asc",
        },
        skip,
        take,
      }),
      prismaDB.rawMaterial.count({
        where: baseWhere,
      }),
    ]);

    // Format the response data
    const formattedItems = items.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.rawMaterialCategory.name,
      currentStock: item.currentStock?.toFixed(2) || 0,
      unit: item.consumptionUnit.name,
      minStockLevel: item.minimumStockLevel || 0,
      minStockUnit: item.minimumStockUnit.name,
      lastPurchasePrice:
        item.lastPurchasedPrice || item.purchasedPricePerItem || 0,
      lastPurchaseDate: item.purchaseItems[0]?.purchase.createdAt
        ? new Date(item.purchaseItems[0].purchase.createdAt)
            .toISOString()
            .split("T")[0]
        : null,
      status:
        (item.currentStock || 0) <= (item.minimumStockLevel || 0)
          ? "Critical"
          : (item.currentStock || 0) <= (item.minimumStockLevel || 0) * 0.5
          ? "Low"
          : "Good",
    }));

    res.json({
      success: true,
      data: {
        totalCount: total,
        items: formattedItems,
        categories: formattedCategories,
        pagination: {
          total,
          pages: Math.ceil(total / take),
          currentPage: pageIndex,
        },
      },
    });
  } catch (error) {
    console.error("Error in getStockLevels:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch stock levels",
    });
  }
};

// Get Purchase Order Statistics and Recent Orders
export const getPurchaseOrderStats = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);
  const previousMonth = subMonths(today, 1);

  // Get pending orders count and value
  const pendingOrders = await prismaDB.purchase.aggregate({
    where: {
      restaurantId: outletId,
      purchaseStatus: "REQUESTED",
    },
    _count: true,
    _sum: {
      totalAmount: true,
    },
  });

  // Get completed orders this month
  const completedOrders = await prismaDB.purchase.aggregate({
    where: {
      restaurantId: outletId,
      purchaseStatus: "COMPLETED",
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
    _count: true,
    _sum: {
      totalAmount: true,
    },
  });

  // Calculate average order value for last 30 days
  const averageOrderValue =
    completedOrders._count > 0
      ? (completedOrders._sum.totalAmount || 0) / completedOrders._count
      : 0;

  // Get purchase trends for last 6 months
  const purchaseTrends = await prismaDB.purchase.groupBy({
    by: ["createdAt"],
    where: {
      restaurantId: outletId,
      purchaseStatus: "COMPLETED",
      createdAt: {
        gte: subMonths(today, 6),
      },
    },
    _sum: {
      totalAmount: true,
    },
  });

  // Format purchase trends by month
  const monthlyTrends = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(today, i);
    const monthData = purchaseTrends.find(
      (p) => new Date(p.createdAt).getMonth() === month.getMonth()
    );
    return {
      month: month.toLocaleString("default", { month: "short" }),
      amount: monthData?._sum.totalAmount || 0,
    };
  }).reverse();

  // Get recent purchase orders
  const recentOrders = await prismaDB.purchase.findMany({
    where: {
      restaurantId: outletId,
    },
    include: {
      vendor: true,
      purchaseItems: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  // Format recent orders
  const formattedOrders = recentOrders.map((order) => ({
    id: order.invoiceNo,
    vendor: order.vendor.name,
    items: order.purchaseItems.length,
    total: order.totalAmount || 0,
    status: order.purchaseStatus,
    date: order.createdAt.toISOString().split("T")[0],
  }));

  res.json({
    success: true,
    data: {
      stats: {
        pendingOrders: {
          count: pendingOrders._count,
          value: pendingOrders._sum.totalAmount || 0,
        },
        completedOrders: {
          count: completedOrders._count,
          value: completedOrders._sum.totalAmount || 0,
        },
        averageOrderValue,
      },
      purchaseTrends: monthlyTrends,
      recentOrders: formattedOrders,
    },
  });
};

// Create new purchase order
export const createPurchaseOrder = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { vendorId, items } = req.body;

  try {
    // Generate invoice number
    const latestPO = await prismaDB.purchase.findFirst({
      where: { restaurantId: outletId },
      orderBy: { createdAt: "desc" },
    });

    const poNumber = latestPO
      ? `PO${String(parseInt(latestPO.invoiceNo.slice(2)) + 1).padStart(
          3,
          "0"
        )}`
      : "PO001";

    // Create purchase order with items
    const purchaseOrder = await prismaDB.purchase.create({
      data: {
        restaurantId: outletId,
        vendorId,
        invoiceNo: poNumber,
        purchaseStatus: "REQUESTED",
        purchaseItems: {
          create: items.map((item: any) => ({
            rawMaterialId: item.rawMaterialId,
            rawMaterialName: item.name,
            purchaseUnitId: item.unitId,
            purchaseUnitName: item.unit,
            purchaseQuantity: item.quantity,
            purchasePrice: item.price,
            totalPrice: item.quantity * item.price,
          })),
        },
      },
      include: {
        vendor: true,
        purchaseItems: true,
      },
    });

    res.json({
      success: true,
      data: purchaseOrder,
    });
  } catch (error) {
    console.error("Error in createPurchaseOrder:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create purchase order",
    });
  }
};

// Get purchase order details
export const getPurchaseOrderDetails = async (req: Request, res: Response) => {
  const { outletId, orderId } = req.params;

  try {
    const order = await prismaDB.purchase.findFirst({
      where: {
        restaurantId: outletId,
        invoiceNo: orderId,
      },
      include: {
        vendor: true,
        purchaseItems: {
          include: {
            purchaseUnit: true,
            rawMaterial: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error in getPurchaseOrderDetails:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch purchase order details",
    });
  }
};

export const getVendorStats = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { search = "" } = req.query;
  // Get total vendors count
  const totalVendors = await prismaDB.vendor.count({
    where: {
      restaurantId: outletId,
    },
  });

  // Get active orders count
  const activeOrders = await prismaDB.purchase.count({
    where: {
      restaurantId: outletId,
      purchaseStatus: {
        in: ["REQUESTED", "PROCESSED", "ACCEPTED"],
      },
    },
  });

  // Calculate average response time (time between REQUESTED and ACCEPTED status)
  const orders = await prismaDB.purchase.findMany({
    where: {
      restaurantId: outletId,
      purchaseStatus: "ACCEPTED",
      createdAt: {
        gte: subDays(new Date(), 30), // Last 30 days
      },
    },
    select: {
      createdAt: true,
      updatedAt: true,
    },
  });

  const avgResponseTime =
    orders.length > 0
      ? orders.reduce((acc, order) => {
          const diff = order.updatedAt.getTime() - order.createdAt.getTime();
          return acc + diff;
        }, 0) /
        orders.length /
        (1000 * 60 * 60 * 24) // Convert to days
      : 0;

  // Get monthly spend
  const monthlySpend = await prismaDB.purchase.aggregate({
    where: {
      restaurantId: outletId,
      purchaseStatus: "COMPLETED",
      createdAt: {
        gte: startOfMonth(new Date()),
      },
    },
    _sum: {
      totalAmount: true,
    },
  });

  // Get purchase history for last 6 months
  const purchaseHistory = await prismaDB.purchase.groupBy({
    by: ["createdAt"],
    where: {
      restaurantId: outletId,
      purchaseStatus: "COMPLETED",
      createdAt: {
        gte: subMonths(new Date(), 6),
      },
    },
    _sum: {
      totalAmount: true,
    },
  });

  // Format purchase history
  const formattedHistory = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), i);
    const monthData = purchaseHistory.find(
      (p) => new Date(p.createdAt).getMonth() === month.getMonth()
    );
    return {
      month: month.toLocaleString("default", { month: "short" }),
      amount: monthData?._sum.totalAmount || 0,
    };
  }).reverse();

  // Get vendors list with their performance metrics
  const vendors = await prismaDB.vendor.findMany({
    where: {
      restaurantId: outletId,
      name: {
        contains: search as string,
        mode: "insensitive",
      },
    },
    include: {
      purchases: {
        where: {
          purchaseStatus: "COMPLETED",
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  // Calculate vendor metrics
  const vendorsWithMetrics = await Promise.all(
    vendors.map(async (vendor) => {
      // Get total orders
      const totalOrders = await prismaDB.purchase.count({
        where: {
          vendorId: vendor.id,
          purchaseStatus: "COMPLETED",
        },
      });

      // Calculate average rating (you might need to add a rating system to your schema)
      const rating = 4.5; // Placeholder - implement actual rating logic

      return {
        id: vendor.id,
        name: vendor.name,
        category: "Missing", // You might want to add category to your vendor schema
        contact: "Missing", // Add to schema if needed
        phone: "Missing", // Add to schema if needed
        email: "Missing", // Add to schema if needed
        totalOrders,
        lastOrder:
          vendor.purchases[0]?.createdAt.toISOString().split("T")[0] || null,
        rating,
        status: "ACTIVE", // Add status field to schema if needed
        createdAt: vendor.createdAt,
        updatedAt: vendor.updatedAt,
      };
    })
  );

  res.json({
    success: true,
    data: {
      stats: {
        totalVendors,
        activeOrders,
        avgResponseTime: Number(avgResponseTime.toFixed(1)),
        monthlySpend: monthlySpend._sum.totalAmount || 0,
      },
      purchaseHistory: formattedHistory,
      vendors: vendorsWithMetrics,
    },
  });
};

export const getPOSDashboardStats = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const totalRawMaterials = await prismaDB.rawMaterial.count({
    where: {
      restaurantId: outletId,
      currentStock: {
        gt: 0,
      },
    },
  });

  const totalCategories = await prismaDB.rawMaterialCategory.count({
    where: {
      restaurantId: outletId,
    },
  });

  const totalSales = await prismaDB.order.aggregate({
    where: {
      restaurantId: outletId,
      orderStatus: "COMPLETED",
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lt: new Date(new Date().setHours(23, 59, 59, 999)),
      },
    },
    _sum: {
      totalAmount: true,
    },
  });

  const yesterdaySales = await prismaDB.order.aggregate({
    where: {
      restaurantId: outletId,
      orderStatus: "COMPLETED",
      createdAt: {
        gte: subDays(new Date(), 1),
        lt: new Date(),
      },
    },
    _sum: {
      totalAmount: true,
    },
  });

  const recentStockPurchases = await prismaDB.purchase.findMany({
    where: {
      restaurantId: outletId,
      purchaseStatus: "COMPLETED",
      createdAt: {
        gte: subDays(new Date(), 1),
        lte: new Date(),
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  res.json({
    success: true,
    data: {
      inventory: {
        totalRawMaterials,
        totalCategories,
      },
      sales: {
        totalSales: totalSales._sum.totalAmount || 0,
        yesterdayChange: calculatePercentageChange(
          yesterdaySales._sum.totalAmount || 0,
          totalSales._sum.totalAmount || 0
        ),
        yesterdaySales: yesterdaySales._sum.totalAmount || 0,
      },
      stock: {
        recentStockPurchases: recentStockPurchases.length,
        lastUpdateTime: recentStockPurchases[0]?.updatedAt.toISOString(),
      },
    },
  });
};

export const orderAndStockDeduction = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const page = parseInt((req.query.page as string) || "0");
  const pageSize = parseInt((req.query.pageSize as string) || "3");
  const skip = page * pageSize;

  // Get orders with their items and recipes
  const orders = await prismaDB.order.findMany({
    where: {
      restaurantId: outletId,
      active: true,
    },
    select: {
      id: true,
      generatedOrderId: true,
      createdAt: true,
      totalAmount: true,
      orderItems: {
        select: {
          id: true,
          quantity: true,
          menuItem: {
            select: {
              name: true,
              itemRecipe: {
                select: {
                  ingredients: {
                    select: {
                      quantity: true,
                      rawMaterial: {
                        select: {
                          name: true,
                          currentStock: true,
                          consumptionUnit: {
                            select: {
                              name: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: pageSize,
    skip: skip,
  });

  // Transform the data to include stock deductions
  const stockDeductions = orders.map((order) => ({
    id: order.id,
    orderId: order.generatedOrderId,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    items: order.orderItems.map((item) => ({
      name: item.menuItem.name,
      quantity: item.quantity,
      ingredients:
        item.menuItem.itemRecipe?.ingredients.map((ingredient) => ({
          name: ingredient.rawMaterial.name,
          deductedAmount: ingredient.quantity * item.quantity,
          currentStock: ingredient.rawMaterial.currentStock,
          unit: ingredient.rawMaterial.consumptionUnit.name,
        })) || [],
    })),
  }));

  // Get total count for pagination
  const totalCount = await prismaDB.order.count({
    where: {
      restaurantId: outletId,
      active: true,
    },
  });

  res.json({
    items: stockDeductions,
    pagination: {
      total: totalCount,
      pageSize,
      page,
    },
  });
};
