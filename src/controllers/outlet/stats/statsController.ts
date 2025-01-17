import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { getPeriodDates } from "../../../lib/utils";
import { getStaffById } from "../../../lib/get-users";
import { subMonths, format, parse } from "date-fns";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { UnauthorizedException } from "../../../exceptions/unauthorized";
import { DateTime } from "luxon";

interface Metrics {
  totalRevenue: number;
  totalOrders: number;
  avgOrderTime: number;
  totalGrossProfit: number;
}

interface GrowthRate {
  percentage: number;
  delta: number;
  trend: "up" | "down" | "stable";
}

interface DashboardMetrics {
  revenue: { totalRevenue: number; revenueGrowth: string };
  grossProfit: { totalGrossProfit: number; grossProfitGrowth: string };
  expenses: { totalExpenses: number; expenseGrowth: string };
  netProfit: { totalNetProfit: number; percentage: number };
  orders: { totalOrders: number; orderGrowth: string };
  orderTime: { avgOrderTime: string; avgOrderTimeGrowth: string };
  customers: { totalCustomers: number; customerGrowth: string };
  profitMargin: { totalProfitPercentage: number; percentage: number };
}

const getPreviousPeriodDates = (period: string) => {
  const { startDate, endDate } = getPeriodDates(period);

  switch (period) {
    case "today":
      return {
        startDate: new Date(startDate.getTime() - 24 * 60 * 60 * 1000),
        endDate: new Date(endDate.getTime() - 24 * 60 * 60 * 1000),
      };
    case "week":
      return {
        startDate: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000),
      };
    case "month":
      return {
        startDate: new Date(startDate.setMonth(startDate.getMonth() - 1)),
        endDate: new Date(endDate.setMonth(endDate.getMonth() - 1)),
      };
    case "year":
      return {
        startDate: new Date(startDate.setFullYear(startDate.getFullYear() - 1)),
        endDate: new Date(endDate.setFullYear(endDate.getFullYear() - 1)),
      };
    default:
      return { startDate, endDate };
  }
};

const calculateMetrics = (orders: any[]): Metrics => ({
  totalRevenue: orders.reduce(
    (sum, order) => sum + parseFloat(order.totalAmount || "0"),
    0
  ),
  totalGrossProfit: orders.reduce(
    (sum, order) => sum + parseFloat(order.totalGrossProfit || "0"),
    0
  ),
  totalOrders: orders.length,
  avgOrderTime: orders.length
    ? orders.reduce(
        (sum, order) =>
          sum +
          (new Date(order.updatedAt).getTime() -
            new Date(order.createdAt).getTime()),
        0
      ) /
      orders.length /
      60000
    : 0,
});

const calculateExpMetrics = (orders: any[]) => ({
  totalExpenses: orders?.reduce(
    (sum, expense) => sum + parseFloat(expense?.amount || "0"),
    0
  ),
});

const calculateGrowthRate = (current: number, previous: number): GrowthRate => {
  const delta = current - previous;
  const percentage =
    previous === 0 ? (current > 0 ? 100 : 0) : (delta / previous) * 100;

  return {
    percentage,
    delta,
    trend: percentage > 0 ? "up" : percentage < 0 ? "down" : "stable",
  };
};

const formatGrowthMessage = (
  growth: GrowthRate,
  periodLabel: string
): string => {
  const sign = growth.delta >= 0 ? "+" : "";
  return `${sign}${growth.delta.toFixed(2)} (${growth.percentage.toFixed(
    1
  )}%) from ${periodLabel}`;
};

const getPeriodLabel = (period: string): string => {
  const labels: Record<string, string> = {
    today: "yesterday",
    week: "last week",
    month: "last month",
    year: "last year",
  };
  return labels[period] || "the previous period";
};

export const getDashboardMetrics = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { period } = req.query as { period: string };

  const outlet = await getOutletById(outletId);
  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const { startDate, endDate } = getPeriodDates(period);
  const { startDate: prevStartDate, endDate: prevEndDate } =
    getPreviousPeriodDates(period);

  const [
    currentOrders,
    prevOrders,
    currentCustomers,
    prevCustomers,
    currentExpenses,
    prevExpenses,
  ] = await Promise.all([
    prismaDB.order.findMany({
      where: {
        restaurantId: outlet.id,
        createdAt: { gte: startDate, lte: endDate },
        orderStatus: "COMPLETED",
        orderSession: { sessionStatus: "COMPLETED" },
      },
      select: {
        totalAmount: true,
        totalGrossProfit: true,
        createdAt: true,
        updatedAt: true,
        orderType: true,
      },
    }),
    prismaDB.order.findMany({
      where: {
        restaurantId: outlet.id,
        createdAt: { gte: prevStartDate, lte: prevEndDate },
        orderStatus: "COMPLETED",
        orderSession: { sessionStatus: "COMPLETED" },
      },
      select: {
        totalAmount: true,
        totalGrossProfit: true,
        createdAt: true,
        updatedAt: true,
        orderType: true,
      },
    }),
    prismaDB.customer.count({
      where: {
        restaurantId: outlet.id,
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prismaDB.customer.count({
      where: {
        restaurantId: outlet.id,
        createdAt: { gte: prevStartDate, lte: prevEndDate },
      },
    }),
    prismaDB.expenses.findMany({
      where: {
        restaurantId: outlet.id,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        amount: true,
      },
    }),
    prismaDB.expenses.findMany({
      where: {
        restaurantId: outlet.id,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        amount: true,
      },
    }),
  ]);

  const currentMetrics = calculateMetrics(currentOrders);
  const prevMetrics = calculateMetrics(prevOrders);
  const currentExpMetrics = calculateExpMetrics(currentExpenses);
  const prevExpMetrics = calculateExpMetrics(prevExpenses);

  const growthRates = {
    revenue: calculateGrowthRate(
      currentMetrics.totalRevenue,
      prevMetrics.totalRevenue
    ),
    grossProfit: calculateGrowthRate(
      currentMetrics.totalGrossProfit,
      prevMetrics.totalGrossProfit
    ),
    orders: calculateGrowthRate(
      currentMetrics.totalOrders,
      prevMetrics.totalOrders
    ),
    expenses: calculateGrowthRate(
      currentExpMetrics.totalExpenses,
      prevExpMetrics.totalExpenses
    ),
    avgOrderTime: calculateGrowthRate(
      currentMetrics.avgOrderTime,
      prevMetrics.avgOrderTime
    ),
    customers: calculateGrowthRate(currentCustomers, prevCustomers),
  };

  const periodLabel = getPeriodLabel(period);

  const metrics: DashboardMetrics = {
    revenue: {
      totalRevenue: parseFloat(currentMetrics.totalRevenue.toFixed(2)),
      revenueGrowth: formatGrowthMessage(growthRates.revenue, periodLabel),
    },
    grossProfit: {
      totalGrossProfit: parseFloat(currentMetrics.totalGrossProfit.toFixed(2)),
      grossProfitGrowth: formatGrowthMessage(
        growthRates.grossProfit,
        periodLabel
      ),
    },
    netProfit: {
      totalNetProfit:
        parseFloat(currentMetrics.totalGrossProfit.toFixed(2)) -
        currentExpMetrics.totalExpenses.toFixed(2),
      percentage:
        (parseFloat(currentMetrics.totalGrossProfit.toFixed(2)) -
          currentExpMetrics.totalExpenses.toFixed(2)) /
        100,
    },
    profitMargin: {
      totalProfitPercentage:
        ((parseFloat(currentMetrics.totalGrossProfit.toFixed(2)) -
          currentExpMetrics.totalExpenses.toFixed(2)) /
          parseFloat(currentMetrics.totalRevenue.toFixed(2))) *
          100 || 0,
      percentage:
        ((parseFloat(currentMetrics.totalGrossProfit.toFixed(2)) -
          currentExpMetrics.totalExpenses.toFixed(2)) /
          parseFloat(currentMetrics.totalRevenue.toFixed(2))) *
          100 || 0,
    },
    expenses: {
      totalExpenses: parseFloat(currentExpMetrics.totalExpenses.toFixed(2)),
      expenseGrowth: formatGrowthMessage(growthRates.expenses, periodLabel),
    },
    orders: {
      totalOrders: currentMetrics.totalOrders,
      orderGrowth: formatGrowthMessage(growthRates.orders, periodLabel),
    },
    orderTime: {
      avgOrderTime: currentMetrics.avgOrderTime.toFixed(2),
      avgOrderTimeGrowth: formatGrowthMessage(
        growthRates.avgOrderTime,
        periodLabel
      ),
    },
    customers: {
      totalCustomers: currentCustomers,
      customerGrowth: formatGrowthMessage(growthRates.customers, periodLabel),
    },
  };

  return res.json({
    success: true,
    metrics,
    message: "Dashboard Metrics Calculated",
  });
};

export const getRevenueAndExpenses = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const sixMonthsAgo = subMonths(new Date(), 6);

  // Fetch orders for revenue
  const orders = await prismaDB.order.findMany({
    where: {
      restaurantId: outlet.id,
      createdAt: {
        gte: sixMonthsAgo,
      },
    },
    select: {
      totalAmount: true,
      createdAt: true,
    },
  });

  // Fetch purchases for expenses
  const purchases = await prismaDB.purchase.findMany({
    where: {
      restaurantId: outlet.id,
      createdAt: {
        gte: sixMonthsAgo,
      },
    },
    select: {
      totalAmount: true,
      createdAt: true,
    },
  });

  // Fetch  expenses
  const expenses = await prismaDB.expenses.findMany({
    where: {
      restaurantId: outlet.id,
      date: {
        gte: sixMonthsAgo,
      },
    },
    select: {
      amount: true,
      date: true,
    },
  });

  // Fetch payroll costs
  const payrolls = await prismaDB.payroll.findMany({
    where: {
      staff: {
        restaurantId: outlet.id,
      },
      payDate: {
        gte: sixMonthsAgo,
      },
    },
    select: {
      amountPaid: true,
      payDate: true,
    },
  });

  // Initialize an object to accumulate data
  const monthlyData: Record<string, { revenue: number; expenses: number }> = {};

  // Aggregate revenue by month
  orders.forEach((order) => {
    const month = format(order.createdAt, "MMMM");
    if (!monthlyData[month]) {
      monthlyData[month] = { revenue: 0, expenses: 0 };
    }
    monthlyData[month].revenue += parseFloat(order.totalAmount || "0");
  });

  // Aggregate purchase expenses by month
  purchases.forEach((purchase) => {
    const month = format(purchase.createdAt, "MMMM");
    if (!monthlyData[month]) {
      monthlyData[month] = { revenue: 0, expenses: 0 };
    }
    monthlyData[month].expenses += Number(purchase.totalAmount || "0");
  });

  // Aggregate purchase expenses by month
  expenses.forEach((expense) => {
    const month = format(expense.date, "MMMM");
    if (!monthlyData[month]) {
      monthlyData[month] = { revenue: 0, expenses: 0 };
    }
    monthlyData[month].expenses += Number(expense.amount || "0");
  });

  // Aggregate payroll expenses by month
  payrolls.forEach((payroll) => {
    const month = format(payroll.payDate, "MMMM");
    if (!monthlyData[month]) {
      monthlyData[month] = { revenue: 0, expenses: 0 };
    }
    monthlyData[month].expenses += Number(payroll.amountPaid || "0");
  });

  // Format the data for the chart
  const chartData = Array.from({ length: 6 })
    .map((_, index) => {
      const month = format(subMonths(new Date(), index), "MMMM");
      return {
        month,
        revenue: monthlyData[month]?.revenue || 0,
        expenses: monthlyData[month]?.expenses || 0,
      };
    })
    .reverse();

  return res.json({
    success: true,
    monthStats: chartData,
    message: "Revenue and Expenses Data Retrieved",
  });
};

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
      isPaid: true,
      orderStatus: true,
      totalAmount: true,
      orderType: true,
      orderItems: {
        select: {
          menuItem: {
            select: {
              price: true,
              isVariants: true,
              grossProfit: true,
              menuItemVariants: {
                select: {
                  grossProfit: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Initialize totals for all types and the "All" category
  const totals = {
    all: { revenue: 0, orders: 0, grossProfit: 0 },
    express: { revenue: 0, orders: 0, grossProfit: 0 },
    dineIn: { revenue: 0, orders: 0, grossProfit: 0 },
    delivery: { revenue: 0, orders: 0, grossProfit: 0 },
    takeaway: { revenue: 0, orders: 0, grossProfit: 0 },
  };

  // Calculate revenue, orders, and gross profit
  orders
    .filter((o) => o.isPaid === true)
    ?.forEach((order) => {
      const amount = parseFloat(order.totalAmount);

      // Calculate gross profit for this order
      let orderGrossProfit = 0;
      order.orderItems.forEach((item) => {
        if (item.menuItem.isVariants) {
          // Use gross profit from menuItemVariants if available
          orderGrossProfit += item.menuItem.menuItemVariants.reduce(
            (acc, variant) => acc + (variant.grossProfit || 0),
            0
          );
        } else {
          // Use gross profit from menuItem directly
          orderGrossProfit += item.menuItem.grossProfit || 0;
        }
      });

      // Sum for all orders
      totals.all.revenue += amount;
      totals.all.orders++;
      totals.all.grossProfit += orderGrossProfit;

      // Sum for each orderType
      switch (order.orderType) {
        case "EXPRESS":
          totals.express.revenue += amount;
          totals.express.orders++;
          totals.express.grossProfit += orderGrossProfit;
          break;
        case "DINEIN":
          totals.dineIn.revenue += amount;
          totals.dineIn.orders++;
          totals.dineIn.grossProfit += orderGrossProfit;
          break;
        case "DELIVERY":
          totals.delivery.revenue += amount;
          totals.delivery.orders++;
          totals.delivery.grossProfit += orderGrossProfit;
          break;
        case "TAKEAWAY":
          totals.takeaway.revenue += amount;
          totals.takeaway.orders++;
          totals.takeaway.grossProfit += orderGrossProfit;
          break;
      }
    });

  // Format the stats (this is just an example, you can adjust the format)
  const expressFormattedStats = {
    totalRevenue: totals.all.revenue,
    totalOrders: totals.all.orders,
    grossProfit: totals.all.grossProfit,
    stats: [
      {
        type: "EXPRESS",
        revenue: totals.express.revenue,
        orders: totals.express.orders,
        grossProfit: totals.express.grossProfit,
      },
      {
        type: "DELIVERY",
        revenue: totals.delivery.revenue,
        orders: totals.delivery.orders,
        grossProfit: totals.delivery.grossProfit,
      },
      {
        type: "TAKEAWAY",
        revenue: totals.takeaway.revenue,
        orders: totals.takeaway.orders,
        grossProfit: totals.takeaway.grossProfit,
      },
    ],
  };

  const formattedStats = {
    totalRevenue: totals.all.revenue,
    totalOrders: totals.all.orders,
    grossProfit: totals.all.grossProfit,
    stats: [
      {
        type: "DINEIN",
        revenue: totals.dineIn.revenue,
        orders: totals.dineIn.orders,
        grossProfit: totals.dineIn.grossProfit,
      },
      {
        type: "DELIVERY",
        revenue: totals.delivery.revenue,
        orders: totals.delivery.orders,
        grossProfit: totals.delivery.grossProfit,
      },
      {
        type: "TAKEAWAY",
        revenue: totals.takeaway.revenue,
        orders: totals.takeaway.orders,
        grossProfit: totals.takeaway.grossProfit,
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
  grossProfit: number;
  imageUrl: string | null; // Assuming you have an image URL for the food item
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
        orderStatus: "COMPLETED",
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

  topItems?.forEach((item, i) => {
    const foodId = item.menuItem.id;
    if (!aggregated[foodId]) {
      aggregated[foodId] = {
        id: foodId,
        name: item.name,
        category: item.menuItem.category.name,
        orders: 0,
        grossProfit: 0,
        revenue: 0,
        imageUrl:
          item.menuItem.images.length > 0 ? item.menuItem.images[0].url : null, // Adjust as needed
      };
    }
    aggregated[foodId].orders += Number(item.quantity);
    aggregated[foodId].revenue += Number(item.totalPrice);
    aggregated[foodId].grossProfit +=
      Number(item.grossProfit) * Number(item.quantity);
  });

  // Convert the aggregated object to an array and sort by orders
  const sortedTopItems = Object.values(aggregated)
    .sort((a, b) => b.orders - a.orders)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  // .slice(0, 5); // Top 5 items

  const stats = {
    itemsTotal: sortedTopItems?.length,
    totalRevenue: sortedTopItems?.reduce((accu, order) => {
      return (accu += order.revenue);
    }, 0),
    totalGrossProfit: sortedTopItems?.reduce((accu, order) => {
      return (accu += order.grossProfit);
    }, 0),
  };

  return res.json({
    success: true,
    topItems: { stats: stats, sortedTopItems: sortedTopItems },
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

export const cashFlowStats = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { period } = req.query;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const { startDate, endDate } = getPeriodDates(period as string);

  const cashFlowOrderSession = await prismaDB.orderSession.findMany({
    where: {
      restaurantId: outlet.id,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },

    select: {
      isPaid: true,
      sessionStatus: true,
      paymentMethod: true,
      subTotal: true,
    },
  });

  const paymentTotals = {
    UPI: { revenue: 0, transactions: 0 },
    CASH: { revenue: 0, transactions: 0 },
    DEBIT: { revenue: 0, transactions: 0 },
    CREDIT: { revenue: 0, transactions: 0 },
  };

  cashFlowOrderSession
    ?.filter((o) => o.isPaid === true)
    ?.forEach((session) => {
      const amount = session?.subTotal || 0;

      switch (session.paymentMethod) {
        case "UPI":
          paymentTotals.UPI.revenue += amount;
          paymentTotals.UPI.transactions++;
          break;
        case "CASH":
          paymentTotals.CASH.revenue += amount;
          paymentTotals.CASH.transactions++;
          break;
        case "DEBIT":
          paymentTotals.DEBIT.revenue += amount;
          paymentTotals.DEBIT.transactions++;
          break;
        case "CREDIT":
          paymentTotals.CREDIT.revenue += amount;
          paymentTotals.CREDIT.transactions++;
          break;
      }
    });
  // Aggregate total revenue and transactions
  const totalRevenue =
    paymentTotals.UPI.revenue +
    paymentTotals.CASH.revenue +
    paymentTotals.DEBIT.revenue +
    paymentTotals.CREDIT.revenue;

  const totalTransactions =
    paymentTotals.UPI.transactions +
    paymentTotals.CASH.transactions +
    paymentTotals.DEBIT.transactions +
    paymentTotals.CREDIT.transactions;

  // Format the response
  const formattedStats = {
    totalRevenue,
    totalTransactions,
    breakdown: [
      {
        method: "UPI",
        revenue: paymentTotals.UPI.revenue,
        transactions: paymentTotals.UPI.transactions,
      },
      {
        method: "CASH",
        revenue: paymentTotals.CASH.revenue,
        transactions: paymentTotals.CASH.transactions,
      },
      {
        method: "DEBIT",
        revenue: paymentTotals.DEBIT.revenue,
        transactions: paymentTotals.DEBIT.transactions,
      },
      {
        method: "CREDIT",
        revenue: paymentTotals.CREDIT.revenue,
        transactions: paymentTotals.CREDIT.transactions,
      },
    ],
  };

  return res.json({
    success: true,
    stats: formattedStats,
    message: "Cashflow statistics retrieved successfully",
  });
};

export const totalInventory = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  // Fetch raw materials
  const rawMaterials = await prismaDB.rawMaterial.findMany({
    where: {
      restaurantId: outlet.id,
    },
    include: {
      consumptionUnit: true,
    },
  });

  // Fetch purchases
  const purchase = await prismaDB.purchase.findMany({
    where: {
      restaurantId: outlet.id,
      purchaseStatus: {
        in: ["PROCESSED", "REQUESTED", "ACCEPTED", "SETTLEMENT"],
      },
    },
  });

  // Fetch yesterday's purchase count
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayPurchases = await prismaDB.purchase.count({
    where: {
      restaurantId: outlet.id,
      purchaseStatus: {
        in: ["PROCESSED", "REQUESTED"],
      },
      createdAt: {
        gte: new Date(yesterday.setHours(0, 0, 0, 0)),
        lt: new Date(yesterday.setHours(23, 59, 59, 999)),
      },
    },
  });

  const todayPurchases = purchase.length;
  const purchaseDifference = todayPurchases - yesterdayPurchases;

  // Calculate total inventory stats and inventory turnover
  const totalInventoryStats = rawMaterials.reduce(
    (acc, material) => {
      const stock = material.currentStock || 0;
      const totalValue =
        Number(stock) * Number(material?.purchasedPricePerItem);

      if (Number(stock) < Number(material?.minimumStockLevel)) {
        acc.lowStockItems += 1;
      }

      acc.totalValue += totalValue;
      acc.totalStock += Number(stock);

      return acc;
    },
    { totalValue: 0, lowStockItems: 0, totalStock: 0 }
  );

  // Calculate inventory turnover: Cost of Goods Sold (COGS) / Average Inventory
  const cogs = await prismaDB.purchase.aggregate({
    where: {
      restaurantId: outlet.id,
      purchaseStatus: "PROCESSED",
    },
    _sum: {
      totalAmount: true,
    },
  });

  // Step 1: Calculate COGS for each raw material
  const rawMaterialCOGS = await Promise.all(
    rawMaterials.map(async (material) => {
      // Step 2: Fetch all orders that consumed this raw material
      const ordersWithMaterial = await prismaDB.orderItem.findMany({
        where: {
          order: {
            restaurantId: outletId,
            orderStatus: "COMPLETED", // Only consider completed orders
          },
          menuItem: {
            chooseProfit: "itemRecipe",
            itemRecipe: {
              ingredients: {
                some: {
                  rawMaterialId: material.id,
                },
              },
            },
          },
        },
        include: {
          menuItem: {
            include: {
              itemRecipe: {
                include: {
                  ingredients: true,
                },
              },
            },
          },
        },
      });

      // Step 3: Calculate the total consumed stock from these orders
      const consumedStock = ordersWithMaterial.reduce((total, orderItem) => {
        const recipeIngredients =
          orderItem.menuItem?.itemRecipe?.ingredients || [];
        const ingredientForMaterial = recipeIngredients.find(
          (ingredient) => ingredient.rawMaterialId === material.id
        );

        if (ingredientForMaterial) {
          const quantityUsedPerOrder = ingredientForMaterial.quantity;
          total += quantityUsedPerOrder * Number(orderItem.quantity);
        }

        return total;
      }, 0);

      // Step 4: Calculate COGS for the raw material
      const cogs = consumedStock / Number(material.purchasedPricePerItem || 0);

      return {
        rawMaterialId: material.id,
        name: material.name,
        purchasedStock: material.purchasedStock,
        consumedStock: `${consumedStock.toFixed(2)} - ${
          material?.consumptionUnit?.name
        }`,
        cogs: cogs.toFixed(2),
      };
    })
  );

  const inventoryTurnover =
    cogs._sum.totalAmount && totalInventoryStats.totalValue > 0
      ? cogs._sum.totalAmount / totalInventoryStats.totalValue
      : 0;

  // Format the result
  const formatted = {
    totalRawMaterials: rawMaterials.length,
    totalInventoryValue: totalInventoryStats.totalValue,
    lowStockLevels: totalInventoryStats.lowStockItems,
    pendingPurchase: purchase.length,
    purchaseDifference:
      purchaseDifference >= 0
        ? `+${purchaseDifference}`
        : `${purchaseDifference}`,
    inventoryTurnover: inventoryTurnover.toFixed(2),
    rawMaterialCOGS,
  };

  return res.json({
    success: true,
    formattedInventoryStats: formatted,
  });
};

export const getFinancialMetrics = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const { period } = req.query;

  // Get outlet details
  const outlet = await getOutletById(outletId);
  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  // Define date range based on the period (daily, monthly, etc.)
  const { startDate, endDate } = getPeriodDates(period as string);

  // Fetch total revenue from completed orders
  const orders = await prismaDB.order.findMany({
    where: {
      restaurantId: outlet.id,
      createdAt: { gte: startDate, lte: endDate },
      orderStatus: "COMPLETED",
    },
    select: {
      totalAmount: true,
      totalGrossProfit: true,
    },
  });

  const totalRevenue = orders.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0
  );

  const totalGrossProfit = orders.reduce(
    (sum, order) => sum + Number(order.totalGrossProfit || 0),
    0
  );

  // Fetch expenses from purchases
  const purchases = await prismaDB.purchase.findMany({
    where: {
      restaurantId: outlet.id,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      totalAmount: true,
    },
  });

  const totalPurchaseCost = purchases.reduce(
    (sum, purchase) => sum + Number(purchase.totalAmount || "0"),
    0
  );

  // Fetch  expenses
  const expenses = await prismaDB.expenses.findMany({
    where: {
      restaurantId: outlet.id,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      amount: true,
      date: true,
    },
  });

  const totalExpensesCost = expenses.reduce(
    (sum, purchase) => sum + Number(purchase.amount || "0"),
    0
  );

  // Fetch labour costs from payroll
  const payrolls = await prismaDB.payroll.findMany({
    where: {
      staff: { restaurantId: outlet.id },
      payDate: { gte: startDate, lte: endDate },
    },
    select: {
      amountPaid: true,
    },
  });

  const totalLabourCost = payrolls.reduce(
    (sum, payroll) => sum + Number(payroll.amountPaid || "0"),
    0
  );

  // Calculate total expenses
  const totalExpenses = totalPurchaseCost + totalLabourCost + totalExpensesCost;

  // Calculate net profit
  const netProfit = totalGrossProfit - totalExpenses;

  // Calculate profit margin
  const profitMargin = (netProfit / totalRevenue) * 100;

  // Calculate cash flow metrics
  const cashIn = totalRevenue; // Revenue is the cash coming in
  const cashOut = totalExpensesCost; // Total expenses are the cash going out
  const netCashFlow = cashIn - cashOut; // Net cash flow is the difference

  // Return financial metrics
  return res.json({
    success: true,
    metrics: {
      totalRevenue: totalRevenue.toFixed(2),
      totalGrossProfit: totalGrossProfit.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      netProfit: netProfit.toFixed(2),
      profitMargin: `${profitMargin.toFixed(2)}%`,
      cashIn: cashIn.toFixed(2),
      cashOut: cashOut.toFixed(2),
      netCashFlow: netCashFlow.toFixed(2),
    },
    message: "Financial metrics calculated successfully",
  });
};

function formatDateForPrisma(dateString: string): Date {
  const parsedDate = parse(dateString, "dd-MM-yyyy", new Date());
  if (isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid date format: ${dateString}`);
  }
  return parsedDate;
}

export const expenseMetrics = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { startDate, endDate, prevStartDate, prevEndDate } = req.query;

  if (!startDate || !endDate || !prevStartDate || !prevEndDate) {
    throw new BadRequestsException(
      "Missing required date parameters",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const formatDateRangeForPrisma = (dateString: string, isEnd = false) => {
    const [day, month, year] = dateString.split("-").map(Number);
    if (!day || !month || !year) {
      throw new BadRequestsException(
        "Invalid date format",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    const date = new Date(year, month - 1, day);
    if (isEnd) {
      date.setHours(23, 59, 59, 999); // End of the day
    } else {
      date.setHours(0, 0, 0, 0); // Start of the day
    }
    return date;
  };

  const parsedStartDate = formatDateRangeForPrisma(startDate as string);
  const parsedEndDate = formatDateRangeForPrisma(endDate as string, true);
  const parsedPrevStartDate = formatDateRangeForPrisma(prevStartDate as string);
  const parsedPrevEndDate = formatDateRangeForPrisma(
    prevEndDate as string,
    true
  );

  const outlet = await getOutletById(outletId);
  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const [currExpenses, prevExpenses, ordersCashIn, expensesCashOut] =
    await Promise.all([
      prismaDB.expenses.findMany({
        where: {
          restaurantId: outletId,
          createdAt: {
            gte: parsedStartDate,
            lte: parsedEndDate,
          },
        },
        select: {
          amount: true,
        },
      }),
      prismaDB.expenses.findMany({
        where: {
          restaurantId: outletId,
          createdAt: {
            gte: parsedPrevStartDate,
            lte: parsedPrevEndDate,
          },
        },
        select: {
          amount: true,
        },
      }),
      prismaDB.order.findMany({
        where: {
          restaurantId: outletId,
          createdAt: {
            gte: parsedStartDate,
            lte: parsedEndDate,
          },
          orderStatus: "COMPLETED",
        },
        select: {
          totalAmount: true,
        },
      }),
      prismaDB.expenses.findMany({
        where: {
          restaurantId: outletId,
          createdAt: {
            gte: parsedStartDate,
            lte: parsedEndDate,
          },
          category: {
            in: [
              "Ingredients",
              "Salaries",
              "Utilities",
              "Marketing",
              "Rent",
              "Miscellaneous",
            ],
          },
        },
        select: {
          amount: true,
        },
      }),
    ]);

  const totalCurrExpenses = currExpenses.reduce(
    (sum, expense) => sum + (expense.amount || 0),
    0
  );
  const totalPrevExpenses = prevExpenses.reduce(
    (sum, expense) => sum + (expense.amount || 0),
    0
  );
  const totalCashIn = ordersCashIn.reduce(
    (sum, order) => sum + parseFloat(order?.totalAmount),
    0
  );
  const totalCashOut = expensesCashOut.reduce(
    (sum, expense) => sum + (expense.amount || 0),
    0
  );

  const percentageChange = totalPrevExpenses
    ? ((totalCurrExpenses - totalPrevExpenses) / totalPrevExpenses) * 100
    : 0;

  const metrics = {
    expenses: {
      totalExpenses: totalCurrExpenses,
      growth: `${percentageChange.toFixed(2)}% vs Previous Period`,
    },
    cashFlow: {
      totalCashIn,
      cashInPercentage: (
        (totalCashIn / (totalCashIn + totalCashOut)) *
        100
      ).toFixed(2),
      totalCashOut,
      cashOutPercentage: (
        (totalCashOut / (totalCashIn + totalCashOut)) *
        100
      ).toFixed(2),
      netCash: totalCashIn - totalCashOut,
    },
  };

  return res.json({ success: true, metrics });
};

export const getOrderHourWise = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);
  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const timeZone = "Asia/Kolkata"; // Default to a specific time zone

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

  // Generate data for all 24 hours in the outlet's time zone
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const formattedData = hours.map((hour) => {
    const ordersAtHour = orders.filter((order) => {
      const orderHour = DateTime.fromJSDate(order.createdAt, {
        zone: timeZone,
      }).hour;
      return orderHour === hour;
    });

    const count = ordersAtHour.reduce((sum, order) => sum + order._count.id, 0);

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

    return {
      hour,
      count,
      status: statuses,
    };
  });

  return res.json({
    success: true,
    data: formattedData,
  });
};

const generateVibrantColor = (): string => {
  const randomColor = Math.floor(Math.random() * 16777215).toString(16);
  return `#${randomColor.padStart(6, "0")}`;
};

export const getCategoryContributionStats = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);
  // @ts-ignore
  let userId = req.user?.id;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (userId !== outlet.adminId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  // Fetch orders and related category data
  const orderItems = await prismaDB.orderItem.findMany({
    where: {
      order: {
        orderStatus: {
          in: ["COMPLETED", "DELIVERED"],
        },
        restaurantId: outletId,
      },
    },
    include: {
      menuItem: {
        include: {
          category: true,
        },
      },
    },
  });

  // Aggregate amounts by category
  const categoryTotals: Record<string, number> = orderItems.reduce(
    (acc, item) => {
      const categoryName = item.menuItem.category.name;
      acc[categoryName] = (acc[categoryName] || 0) + item.totalPrice;
      return acc;
    },
    {} as Record<string, number>
  );

  // Calculate total revenue from all categories
  const totalRevenue = Object.values(categoryTotals).reduce(
    (sum, amount) => sum + amount,
    0
  );

  // Map categories to stats with percentage contribution and vibrant colors
  const stats = Object.entries(categoryTotals).map(([category, amount]) => ({
    name: category,
    amount: parseFloat(amount.toFixed(2)),
    percentage: parseFloat(((amount / totalRevenue) * 100).toFixed(2)),
    color: generateVibrantColor(), // Assign a random vibrant color
  }));

  return res.json({
    success: true,
    categoryContributionStats: stats,
  });
};
