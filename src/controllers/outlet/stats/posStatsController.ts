import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { endOfDay, set, startOfDay, subDays } from "date-fns";
import { DateTime } from "luxon";

// Helper function to calculate percentage change
const calculatePercentageChange = (
  current: number,
  previous: number
): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
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
  const todayStart = DateTime.now().setZone(timeZone).startOf("day").toJSDate();
  const todayEnd = DateTime.now().setZone(timeZone).endOf("day").toJSDate();

  const currentRevenue = await prismaDB.order.aggregate({
    where: {
      restaurantId: outletId,
      staffId: staffId,
      orderStatus: "COMPLETED",
      updatedAt: {
        gte: lastMonth,
        lte: today,
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
    const ordersByHour = await Promise.all(
      operatingHours.map(async (hour) => {
        const hourStart = set(todayStart, { hours: hour });
        const hourEnd = set(todayStart, { hours: hour + 1 });

        const orders = await prismaDB.order.groupBy({
          by: ["orderType"],
          where: {
            restaurantId: outletId,
            orderStatus: "COMPLETED",
            updatedAt: {
              gte: hourStart,
              lt: hourEnd,
            },
          },
          _count: true,
        });

        return {
          hour: `${hour.toString().padStart(2, "0")}:00`,
          dineIn: orders?.find((s) => s?.orderType === "DINEIN")?._count ?? 0,
          takeaway:
            orders?.find((s) => s?.orderType === "TAKEAWAY")?._count ?? 0,
          delivery:
            orders?.find((s) => s?.orderType === "DELIVERY")?._count ?? 0,
          express: orders?.find((s) => s?.orderType === "EXPRESS")?._count ?? 0,
          total: orders?.reduce((acc, o) => acc + o._count, 0) ?? 0,
        };
      })
    );

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
            orderStatus: { $eq: "COMPLETED" },
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
            orderStatus: "COMPLETED",
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
        updatedAt: {
          gte: startOfDay(new Date()),
        },
      },
      _count: true,
    });

    const yesterday = await prismaDB.order.groupBy({
      by: ["orderType"],
      where: {
        restaurantId: outletId,
        updatedAt: {
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

  res.json({
    success: true,
    data: {
      totalSalesRevenue: {
        amount: currentRevenue._sum.totalAmount || 0,
        percentageChange: calculatePercentageChange(
          currentRevenue._sum.totalAmount || 0,
          previousRevenue._sum.totalAmount || 0
        ),
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
        growth,
        todays: todayOrdersByHour,
        daily: dailyStats,
        weekly: weeklyStats,
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
