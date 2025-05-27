import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import ExcelJS from "exceljs";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import axios from "axios";
import {
  CashTransactionType,
  PaymentMethod,
  ReportType,
  TransactionSource,
} from "@prisma/client";
import { z } from "zod";
import { BadRequestsException } from "../../../exceptions/bad-request";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
} from "../../../schema/staff";
import { format } from "date-fns";
import { calculateInOut } from "../../../lib/utils";

// Add timezone utility functions
function convertToIST(date: Date): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function setISTTime(
  date: Date,
  hours: number,
  minutes: number,
  seconds: number,
  milliseconds: number
): Date {
  const istDate = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  istDate.setHours(hours, minutes, seconds, milliseconds);
  return istDate;
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const formSchema = z.object({
  reportType: z.enum([
    "DAYREPORT",
    "SALES",
    "INVENTORY",
    "FINANCIAL",
    "STAFF",
    "CASHREGISTER",
  ]),
  format: z.enum(["PDF", "EXCEL"]),
  dateRange: z.object({
    from: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "Invalid 'from' date",
    }),
    to: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "Invalid 'to' date",
    }),
  }),
});

export const createReport = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { data: validateFields, error } = formSchema.safeParse(req.body);
  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  console.log("Validate fields", validateFields);
  const outlet = await getOutletById(outletId);

  // @ts-ignore
  const userId = req.user?.id;

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const data = await fetchReportData(
    validateFields?.reportType,
    validateFields?.dateRange?.from,
    validateFields?.dateRange?.to,
    outletId
  );

  if (validateFields?.format === "PDF") {
    await prismaDB.report.create({
      data: {
        restaurantId: outletId,
        userId,
        reportType: validateFields?.reportType,
        format: validateFields?.format,
        generatedBy: outlet.users?.name || "System",
        status: "COMPLETED",
        reportData: data,
        dateRange: {
          create: {
            startDate: new Date(validateFields?.dateRange?.from),
            endDate: new Date(validateFields?.dateRange?.to),
          },
        },
      },
    });
    return res.json({
      success: true,
      message: "PDF report generated",
      reportData: data,
    });
  } else if (validateFields?.format === "EXCEL") {
    const fileUrl = await generateExcel(
      data,
      validateFields?.reportType,
      outlet.name
    );
    await prismaDB.report.create({
      data: {
        restaurantId: outletId,
        userId,
        reportType: validateFields?.reportType,
        format: validateFields?.format,
        generatedBy: outlet.users?.name || "System",
        status: "COMPLETED",
        fileUrl: fileUrl,
        dateRange: {
          create: {
            startDate: new Date(validateFields?.dateRange?.from),
            endDate: new Date(validateFields?.dateRange?.to),
          },
        },
      },
    });

    return res.json({
      success: true,
      message: "Excel report generated",
    });
  }
};

const posformSchema = z.object({
  reportType: z.enum(["DAYREPORT", "SALES"]),

  format: z.enum(["PDF", "EXCEL"]),
  dateRange: z.object({
    from: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "Invalid 'from' date",
    }),
    to: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "Invalid 'to' date",
    }),
  }),
});

export const posGenerateReport = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { data: validateFields, error } = posformSchema.safeParse(req.body);

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  console.log("Validate fields", validateFields);
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const data = await fetchReportData(
    validateFields?.reportType,
    validateFields?.dateRange?.from,
    validateFields?.dateRange?.to,
    outletId
  );

  if (validateFields?.format === "PDF") {
    return res.json({
      success: true,
      message: "PDF report generated",
      reportType: validateFields?.reportType,
      reportData: data,
    });
  } else if (validateFields?.format === "EXCEL") {
    const fileUrl = await generateExcel(
      data,
      validateFields?.reportType,
      outlet.name
    );

    return res.json({
      success: true,
      reportData: data,
      message: "Excel report generated",
      reportType: validateFields?.reportType,
      fileUrl: fileUrl,
    });
  }
};

async function fetchReportData(
  reportType: string,
  startDate: string,
  endDate: string,
  restaurantId: string
) {
  // Adjust date ranges to start at 00:00:00 for the start date and 23:59:59 for the end date (IST)
  const startDateWithTime = new Date(startDate);
  const endDateWithTime = new Date(endDate);

  // Convert to IST and set appropriate times
  const istStartDate = setISTTime(startDateWithTime, 0, 0, 0, 0);
  const istEndDate = setISTTime(endDateWithTime, 23, 59, 59, 999);

  const where = {
    restaurantId,
    updatedAt: {
      gte: istStartDate,
      lte: istEndDate,
    },
  };

  const dateRange = {
    from: istStartDate.toISOString(),
    to: istEndDate.toISOString(),
  };

  switch (reportType) {
    case "DAYREPORT":
      return formatDayReport(dateRange, restaurantId);
    case "SALES":
      return formatSalesData(dateRange, restaurantId);
    case "INVENTORY":
      return formatInventoryData(dateRange, restaurantId);
    case "CASHREGISTER":
      return formatCashRegisterData(dateRange, restaurantId);
    case "FINANCIAL":
      const [orders, expenses] = await Promise.all([
        prismaDB.order.findMany({
          where,
          select: { totalAmount: true, gstPrice: true },
        }),
        prismaDB.expenses.findMany({ where }),
      ]);
      return { orders, expenses };
    case "STAFF":
      return prismaDB.payroll.findMany({ where, include: { staff: true } });
    default:
      throw new Error("Invalid reportType");
  }
}

async function formatDayReport(
  dateRange: { from: string; to: string },
  restaurantId: string
) {
  const [restaurant, orders, expenses, cashRegister, staffActivities] =
    await Promise.all([
      prismaDB.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          name: true,
          address: true,
          phoneNo: true,
          email: true,
          imageUrl: true,
        },
      }),
      prismaDB.order.findMany({
        where: {
          restaurantId,
          updatedAt: {
            gte: new Date(dateRange.from),
            lte: new Date(dateRange.to),
          },
        },
        include: {
          orderSession: {
            select: {
              billId: true,
              paymentMethod: true,
              isPaid: true,
              splitPayments: true,
              sessionStatus: true,
            },
          },
        },
      }),
      prismaDB.expenses.findMany({
        where: {
          restaurantId,
          updatedAt: {
            gte: new Date(dateRange.from),
            lte: new Date(dateRange.to),
          },
        },
      }),
      prismaDB.cashRegister.findMany({
        where: {
          restaurantId,
          createdAt: {
            gte: new Date(dateRange.from),
            lte: new Date(dateRange.to),
          },
        },
        include: {
          transactions: true,
        },
      }),
      prismaDB.order.groupBy({
        by: ["createdBy"],
        where: {
          restaurantId,
          updatedAt: {
            gte: new Date(dateRange.from),
            lte: new Date(dateRange.to),
          },
        },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
    ]);

  const formattedOrders = orders.map((order) => ({
    billId: order.orderSession?.billId || order.id,
    orderType: order.orderType,
    paidStatus: order.orderSession?.isPaid ? "Paid" : "Unpaid",
    totalAmount: Number(order.totalAmount),
    paymentMethod: order.orderSession?.paymentMethod,
    status: order.orderSession?.sessionStatus,
    createdAt: order.updatedAt,
    createdBy: order.createdBy,
  }));

  const paymentTotals: Record<string, number> = {
    CASH: 0,
    UPI: 0,
    CARD: 0,
    NOTPAID: 0,
  };

  for (const order of orders) {
    if (
      order.orderSession.sessionStatus === "COMPLETED" ||
      order.orderSession.sessionStatus === "ONPROGRESS"
    ) {
      const method = order.orderSession?.paymentMethod || "NOTPAID";
      if (method === "SPLIT") {
        order.orderSession.splitPayments?.forEach((sp) => {
          paymentTotals[sp.method] =
            (paymentTotals[sp.method] || 0) + sp.amount;
        });
      } else {
        paymentTotals[method] =
          (paymentTotals[method] || 0) + Number(order.totalAmount);
      }
    }
  }

  const totalRevenue = orders
    .filter((o) => o.orderSession?.sessionStatus === "COMPLETED")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const unpaidRevenue = orders
    .filter((o) => o.orderSession?.sessionStatus === "ONPROGRESS")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const cancelledRevenue = orders
    .filter((o) => o.orderSession?.sessionStatus === "CANCELLED")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const topItems = await prismaDB.orderItem.groupBy({
    by: ["name"],
    where: {
      order: {
        restaurantId,
        orderSession: {
          sessionStatus: {
            in: ["ONPROGRESS", "COMPLETED"],
          },
        },
        updatedAt: {
          gte: new Date(dateRange.from),
          lte: new Date(dateRange.to),
        },
      },
    },
    _sum: { quantity: true, totalPrice: true },
    orderBy: { _sum: { quantity: "desc" } },
  });

  return {
    restaurant: {
      ...restaurant,
      phone: restaurant?.phoneNo,
      dateRange: {
        from: new Date(dateRange.from).toLocaleString(),
        to: new Date(dateRange.to).toLocaleString(),
      },
    },
    summary: {
      orders: {
        total: orders.length,
        completed: orders.filter(
          (o) => o.orderSession?.sessionStatus === "COMPLETED"
        ).length,
        onProgress: orders.filter(
          (o) => o.orderSession?.sessionStatus === "ONPROGRESS"
        ).length,
        cancelled: orders.filter(
          (o) => o.orderSession?.sessionStatus === "CANCELLED"
        ).length,
        totalRevenue,
        unpaidRevenue,
        cancelledRevenue,
        paymentTotals,
      },
      cashRegister: cashRegister
        ? {
            openingCash: cashRegister.reduce(
              (sum, tx) => sum + tx.openingBalance,
              0
            ),
            cashIn: cashRegister?.reduce(
              (sum, cash) =>
                sum +
                calculateInOut(
                  cash?.transactions?.filter((tx) => tx.type === "CASH_IN")
                ),
              0
            ),
            cashOut: cashRegister?.reduce(
              (sum, cash) =>
                sum +
                calculateInOut(
                  cash?.transactions?.filter((tx) => tx.type === "CASH_OUT")
                ),
              0
            ),
            closingCash: cashRegister.reduce(
              (sum, tx) => sum + Number(tx.closingBalance || 0),
              0
            ),
          }
        : null,
      expenses: expenses.map((e) => ({
        category: e.category,
        description: e.description,
        amount: e.amount,
        paymentMethod: e.paymentMethod,
      })),
      topItems: topItems.map((i) => ({
        itemName: i.name,
        quantitySold: i._sum.quantity,
        totalSales: i._sum.totalPrice,
      })),
      staffPerformance: staffActivities.map((s) => ({
        staffId: s.createdBy,
        ordersHandled: s._count._all,
        revenueGenerated: s._sum.totalAmount,
      })),
    },
  };
}

async function formatCashRegisterData(
  dateRange: { from: string; to: string },
  restaurantId: string
) {
  const where = {
    restaurantId: restaurantId,
    updatedAt: {
      gt: new Date(dateRange.from),
      lt: new Date(dateRange.to),
    },
  };

  // Fetch all required data in parallel
  const [cashRegister, outlet] = await Promise.all([
    prismaDB.cashRegister.findMany({
      where,
      include: {
        denominations: true,
        transactions: true,
        staff: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    }),
    prismaDB.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        name: true,
        address: true,
        phoneNo: true,
        email: true,
        imageUrl: true,
      },
    }),
  ]);

  const cashIn = cashRegister.reduce(
    (sum, tx) =>
      sum +
      calculateInOut(
        tx.transactions.filter((trans) => trans.type === "CASH_IN")
      ),
    0
  );
  const cashOut = cashRegister.reduce(
    (sum, tx) =>
      sum +
      calculateInOut(
        tx.transactions.filter((trans) => trans.type === "CASH_OUT")
      ),
    0
  );

  const paymentBreakDown = (
    paymentMethod: PaymentMethod,
    cashTransactionType: CashTransactionType
  ) => {
    return cashRegister.reduce(
      (sum, tx) =>
        sum +
        calculateInOut(
          tx.transactions.filter(
            (trans) =>
              trans.type === cashTransactionType &&
              trans.paymentMethod === paymentMethod
          )
        ),
      0
    );
  };

  const formattedTransactions = cashRegister.flatMap((register) =>
    register.transactions.map((transaction) => ({
      id: transaction.id,
      date: transaction.createdAt,
      transactionType: transaction.type,
      description: transaction.description,
      amount: transaction.amount,
      source: transaction.source,
      paymentMethod: transaction.paymentMethod,
      registerId: register.id,
      performedBy: register?.staff?.name || register?.user?.name,
    }))
  );

  return {
    restaurant: {
      name: outlet?.name || "",
      address: outlet?.address || "",
      phone: outlet?.phoneNo || "",
      email: outlet?.email || "",
      logo: outlet?.imageUrl || "",
      dateRange: {
        from: new Date(dateRange.from).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        to: new Date(dateRange.to).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    },
    summary: {
      totalOpenedRegister: cashRegister?.length,
      openingBalance: cashRegister.reduce(
        (balance, tx) => balance + tx.openingBalance,
        0
      ),
      totalCashIn: cashIn,
      totalCashOut: cashOut,
      netPosition: cashIn - cashOut,
      expectedClosingBalance: cashRegister.reduce(
        (balance, tx) => balance + Number(tx.actualBalance),
        0
      ),
      actualClosingBlance: cashRegister.reduce(
        (balance, tx) => balance + Number(tx.closingBalance),
        0
      ),
      discrepancy: cashRegister.reduce(
        (total, tx) =>
          total +
          (Number(tx.actualBalance || 0) - Number(tx.closingBalance || 0)),
        0
      ),
      paymentDistribution: {
        cashIn: {
          cash: paymentBreakDown("CASH", "CASH_IN"),
          upi: paymentBreakDown("UPI", "CASH_IN"),
          card: paymentBreakDown("DEBIT", "CASH_IN"),
          total: cashIn,
        },
        cashOut: {
          cash: paymentBreakDown("CASH", "CASH_OUT"),
          upi: paymentBreakDown("UPI", "CASH_OUT"),
          card: paymentBreakDown("DEBIT", "CASH_OUT"),
          total: cashOut,
        },
      },
      formattedTransactions: formattedTransactions,
    },
  };
}

async function formatSalesData(
  dateRange: { from: string; to: string },
  outletId: string
) {
  // const where = ;

  // Fetch all required data in parallel
  const [orders, outlet] = await Promise.all([
    prismaDB.order.findMany({
      where: {
        restaurantId: outletId,
        orderSession: {
          sessionStatus: {
            in: ["COMPLETED", "ONPROGRESS"],
          },
        },
        updatedAt: {
          gt: new Date(dateRange.from),
          lt: new Date(dateRange.to),
        },
      },
      include: {
        orderSession: {
          select: {
            billId: true,
            paymentMethod: true,
            isPaid: true,
            splitPayments: true,
            sessionStatus: true,
          },
        },
      },
    }),
    prismaDB.restaurant.findUnique({
      where: { id: outletId },
      select: {
        name: true,
        address: true,
        phoneNo: true,
        email: true,
        imageUrl: true,
      },
    }),
  ]);

  // Format the orders for table display
  const formattedOrders = orders.map((order) => {
    return {
      billId: order.orderSession.billId || order.id,
      orderType: order.orderType,
      paidStatus: order.orderSession.isPaid ? "Paid" : "Unpaid",
      totalAmount: Number(order.totalAmount),
      paymentMethod: order.orderSession.paymentMethod,
      status: order?.orderSession?.sessionStatus,
      createdAt: order?.updatedAt,
      createdBy: order.createdBy,
    };
  });

  const standardizedPayments: Record<StandardizedPaymentMethod, number> = {
    CASH: 0,
    UPI: 0,
    CARD: 0,
    NOTPAID: 0,
  };

  // Process all orders to calculate payment method distribution
  orders.forEach((order) => {
    const paymentMethod = order.orderSession.paymentMethod as PaymentMethod;
    const orderAmount = Number(order.totalAmount);

    // Handle regular (non-split) payments
    if (paymentMethod !== "SPLIT") {
      const standardMethod = mapPaymentMethod(paymentMethod);
      standardizedPayments[standardMethod] += orderAmount;
    }
    // Handle split payments by distributing amounts across standardized categories
    else if (
      order.paymentMethod === "SPLIT" &&
      order.orderSession.splitPayments &&
      order.orderSession.splitPayments.length > 0
    ) {
      order.orderSession.splitPayments.forEach((splitPayment) => {
        const standardMethod = mapPaymentMethod(
          splitPayment.method as PaymentMethod
        );
        standardizedPayments[standardMethod] += splitPayment.amount;
      });
    }
    // If it's marked as SPLIT but no split details available, put it in OTHER
    else {
      standardizedPayments["NOTPAID"] += orderAmount;
    }
  });

  // Remove any payment methods with zero amounts
  const paymentMethods = Object.fromEntries(
    Object.entries(standardizedPayments).filter(([_, amount]) => amount > 0)
  );

  // Calculate total revenue
  const totalRevenue = orders
    .filter((o) => o.orderSession.sessionStatus === "COMPLETED")
    .reduce((acc, order) => acc + Number(order.totalAmount), 0);

  const unpaidRevenue = orders
    .filter((o) => o.orderSession.sessionStatus === "ONPROGRESS")
    .reduce((acc, order) => acc + Number(order.totalAmount), 0);

  return {
    restaurant: {
      name: outlet?.name || "",
      address: outlet?.address || "",
      phone: outlet?.phoneNo || "",
      email: outlet?.email || "",
      logo: outlet?.imageUrl || "",
      dateRange: {
        from: new Date(dateRange.from).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        to: new Date(dateRange.to).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    },
    ordersData: {
      formattedOrders,
      totalRevenue,
      paymentMethods,
    },
  };
}

// Define a type for the standardized payment methods
type StandardizedPaymentMethod = "CASH" | "UPI" | "CARD" | "NOTPAID";

// Function to standardize payment methods
function mapPaymentMethod(method: PaymentMethod): StandardizedPaymentMethod {
  // Map payment methods to standardized categories: CASH, UPI, CARD
  switch (method) {
    case "CASH":
      return "CASH";
    case "UPI":
      return "UPI";
    case "CREDIT":
    case "DEBIT":
      return "CARD"; // Map both CREDIT and DEBIT to CARD
    default:
      return "NOTPAID";
  }
}

async function formatInventoryData(
  dateRange: { from: string; to: string },
  outletId: string
) {
  const where = {
    restaurantId: outletId,
    createdAt: {
      gte: new Date(dateRange.from),
      lte: new Date(dateRange.to),
    },
  };

  // Fetch all required data in parallel
  const [rawMaterials, categories, purchases, vendors, outlet] =
    await Promise.all([
      prismaDB.rawMaterial.findMany({
        where: { restaurantId: outletId },
        include: {
          rawMaterialCategory: true,
          consumptionUnit: true,
          minimumStockUnit: true,
        },
      }),
      prismaDB.rawMaterialCategory.count({
        where: { restaurantId: outletId },
      }),
      prismaDB.purchase.findMany({
        where,
        include: {
          vendor: true,
          purchaseItems: {
            include: {
              rawMaterial: {
                include: {
                  rawMaterialCategory: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prismaDB.vendor.findMany({
        where: { restaurantId: outletId },
        include: {
          purchases: {
            where,
            include: {
              purchaseItems: true,
            },
          },
        },
      }),
      prismaDB.restaurant.findUnique({
        where: { id: outletId },
        select: {
          name: true,
          address: true,
          phoneNo: true,
          email: true,
          imageUrl: true,
        },
      }),
    ]);

  // Calculate total purchase amount
  const totalPurchaseAmount = purchases.reduce(
    (sum, purchase) => sum + (purchase.totalAmount || 0),
    0
  );

  // Format raw materials by category
  const rawMaterialsByCategory = rawMaterials.reduce((acc, material) => {
    const categoryName = material.rawMaterialCategory.name;
    if (!acc[categoryName]) {
      acc[categoryName] = {
        count: 0,
        totalValue: 0,
        items: [],
      };
    }

    const value =
      (material.currentStock || 0) * (material.lastPurchasedPrice || 0);
    acc[categoryName].count++;
    acc[categoryName].totalValue += value;
    acc[categoryName].items.push({
      name: material.name,
      currentStock: material.currentStock || 0,
      minimumStock: material.minimumStockLevel || 0,
      unit: material.consumptionUnit.name,
      value: value,
      lastPurchasePrice: material.lastPurchasedPrice || 0,
    });

    return acc;
  }, {} as Record<string, any>);

  // Calculate stock status
  const stockStatus = rawMaterials.reduce(
    (acc, material) => {
      if (!material.currentStock || material.currentStock === 0) {
        acc.outOfStock++;
      } else if (material.currentStock <= (material.minimumStockLevel || 0)) {
        acc.low++;
      } else {
        acc.optimal++;
      }
      return acc;
    },
    { optimal: 0, low: 0, outOfStock: 0 }
  );

  // Format recent purchases
  const recentPurchases = purchases.slice(0, 5).map((purchase) => ({
    invoiceNo: purchase.invoiceNo,
    vendorName: purchase.vendor.name,
    date: purchase.createdAt.toISOString().split("T")[0],
    amount: purchase.totalAmount || 0,
    status: purchase.purchaseStatus,
    items: purchase.purchaseItems.length,
  }));

  // Format vendor analysis
  const vendorAnalysis = vendors.map((vendor) => {
    const vendorPurchases = vendor.purchases;
    const totalAmount = vendorPurchases.reduce(
      (sum, purchase) => sum + (purchase.totalAmount || 0),
      0
    );

    return {
      name: vendor.name,
      totalPurchases: vendorPurchases.length,
      totalAmount,
      lastPurchaseDate:
        vendorPurchases[0]?.createdAt.toISOString().split("T")[0] || "",
    };
  });

  // Calculate purchase history
  const purchaseHistory = {
    monthly: purchases.reduce((acc, purchase) => {
      const month = purchase.createdAt.toLocaleString("default", {
        month: "short",
      });
      const year = purchase.createdAt.getFullYear();
      const key = `${month} ${year}`;
      acc[key] = (acc[key] || 0) + (purchase.totalAmount || 0);
      return acc;
    }, {} as Record<string, number>),
    categoryWise: purchases.reduce((acc, purchase) => {
      purchase.purchaseItems.forEach((item) => {
        const category = item.rawMaterial.rawMaterialCategory.name;
        acc[category] = (acc[category] || 0) + (item.purchasePrice || 0);
      });
      return acc;
    }, {} as Record<string, number>),
    vendorWise: purchases.reduce((acc, purchase) => {
      const vendorName = purchase.vendor.name;
      acc[vendorName] = (acc[vendorName] || 0) + (purchase.totalAmount || 0);
      return acc;
    }, {} as Record<string, number>),
  };

  return {
    restaurant: {
      name: outlet?.name || "",
      address: outlet?.address || "",
      phone: outlet?.phoneNo || "",
      email: outlet?.email || "",
      website: "",
      logo: outlet?.imageUrl || "",
    },
    inventoryData: {
      stats: {
        totalRawMaterials: rawMaterials.length,
        totalCategories: categories,
        totalPurchaseOrders: purchases.length,
        totalVendors: vendors.length,
        totalPurchaseAmount,
        lowStockItems: stockStatus.low + stockStatus.outOfStock,
      },
      rawMaterialsByCategory,
      recentPurchases,
      stockStatus,
      vendorAnalysis,
      purchaseHistory,
    },
  };
}

async function generateExcel(
  data: any,
  reportType: ReportType,
  outletName: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook();

  switch (reportType) {
    case "DAYREPORT":
      formatDailyReportWorkbook(workbook, data);
      break;
    case "SALES":
      formatSalesWorkbook(workbook, data);
      break;
    case "INVENTORY":
      formatInventoryWorkbook(workbook, data);
      break;
    case "CASHREGISTER":
      formatCashRegisterWorkbook(workbook, data);
      break;
    // Add other report types...
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const nodeBuffer = Buffer.from(buffer);
  return uploadToS3(
    nodeBuffer,
    `${outletName}/reports/${reportType}_${Date.now()}.xlsx`
  );
}

async function uploadToS3(buffer: Buffer, key: string) {
  const putObjectCommand = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: key.endsWith(".pdf")
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const signedUrl = await getSignedUrl(s3Client, putObjectCommand, {
    expiresIn: 60,
  });
  // Perform the PUT request to the signed URL
  await axios.put(signedUrl, buffer, {
    headers: {
      "Content-Type": putObjectCommand.input.ContentType!, // Use the ContentType from the input object
    },
  });

  return signedUrl.split("?")[0];
}

export const getReportsForTable = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const search: string = req.body.search;
  const sorting: ColumnSort[] = req.body.sorting || [];

  const filters: ColumnFilters[] = req.body.filters || [];
  const dateRange: { from: string; to: string } | undefined =
    req.body.dateRange;

  // Build orderBy for Prisma query
  const orderBy =
    sorting?.length > 0
      ? sorting.map((sort) => ({
          [sort.id]: sort.desc ? "desc" : "asc",
        }))
      : [{ createdAt: "desc" }];

  const pagination: PaginationState = req.body.pagination || {
    pageIndex: 0,
    pageSize: 8,
  };

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Calculate pagination parameters
  const take = pagination.pageSize || 8;
  const skip = pagination.pageIndex * take;

  // Build filters dynamically
  const filterConditions = filters.map((filter) => ({
    [filter.id]: { in: filter.value },
  }));

  let dateFilter = {};

  // Apply the proper time range if dateRange is provided
  if (dateRange) {
    const startDateWithTime = new Date(dateRange.from);
    const endDateWithTime = new Date(dateRange.to);

    // Convert to IST and set appropriate times
    const istStartDate = setISTTime(startDateWithTime, 0, 0, 0, 0);
    const istEndDate = setISTTime(endDateWithTime, 23, 59, 59, 999);

    dateFilter = {
      createdAt: {
        gte: istStartDate,
        lte: istEndDate,
      },
    };
  }

  // Fetch total count for the given query
  const totalCount = await prismaDB.report.count({
    where: {
      restaurantId: outletId,
      OR: [{ generatedBy: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
      ...dateFilter,
    },
  });

  const reports = await prismaDB.report.findMany({
    take,
    skip,
    where: {
      restaurantId: outletId,
      OR: [{ generatedBy: { contains: (search as string) ?? "" } }],
      AND: filterConditions, // Apply filters dynamically
      ...dateFilter,
    },
    select: {
      id: true,
      reportType: true,
      format: true,
      status: true,
      dateRange: true,
      reportData: true,
      generatedBy: true,
      createdAt: true,
      fileUrl: true,
    },
    orderBy,
  });

  const data = {
    totalCount: totalCount,
    reports,
  };

  return res.json({
    success: true,
    reports: data,
    message: "Fetched ✅",
  });
};

// Helper Functions
function formatCurrencyForExcel(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);
}

function styleWorksheet(worksheet: ExcelJS.Worksheet) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });
  });
}

// Sales Report Formatting
function formatSalesWorkbook(workbook: ExcelJS.Workbook, data: SalesData) {
  const worksheet = workbook.addWorksheet("Order Sales Report");

  // Title
  worksheet.mergeCells("A1:D1");
  worksheet.getCell("A1").value = "Order Sales Report";
  worksheet.getCell("A1").font = {
    size: 16,
    bold: true,
    color: { argb: "2563EB" },
  };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  // Restaurant Information
  worksheet.addRow([""]);
  worksheet.addRow(["Restaurant Information"]);
  worksheet.addRow(["Name", data.restaurant.name]);
  worksheet.addRow(["Address", data.restaurant.address]);
  worksheet.addRow(["Phone", data.restaurant.phone]);
  worksheet.addRow(["Email", data.restaurant.email]);

  // Summary
  worksheet.addRow([""]);
  worksheet.addRow(["Summary"]);
  worksheet.addRow([
    "Total Revenue",
    formatCurrencyForExcel(data.ordersData.totalRevenue),
  ]);
  worksheet.addRow(["Total Orders", data.ordersData.formattedOrders.length]);

  // Payment Methods
  worksheet.addRow([""]);
  worksheet.addRow(["Payment Methods"]);
  worksheet.addRow(["Method", "Amount"]);
  Object.entries(data.ordersData.paymentMethods).forEach(([method, amount]) => {
    worksheet.addRow([method, formatCurrencyForExcel(amount)]);
  });

  // Orders Table
  worksheet.addRow([""]);
  worksheet.addRow(["Order Details"]);
  worksheet.addRow([
    "Bill ID",
    "Order Type",
    "Status",
    "Method",
    "Amount",
    "Time",
    "Created By",
  ]);

  data.ordersData.formattedOrders.forEach((order) => {
    worksheet.addRow([
      order.billId,
      order.orderType,
      order.paidStatus,
      order.paymentMethod,
      formatCurrencyForExcel(order.totalAmount),
      format(new Date(order.createdAt), "hh:mm a"),
      order.createdBy,
    ]);
  });

  applySalesStyles(worksheet);
}

/**
 * Helper function to format payment method for display
 * @param method Payment method code
 * @returns Human-readable payment method name
 */
function formatPaymentMethod(method: StandardizedPaymentMethod): string {
  switch (method) {
    case "CASH":
      return "Cash";
    case "UPI":
      return "UPI";
    case "CARD":
      return "Card";
    case "NOTPAID":
      return "Not Paid";
    default:
      return method;
  }
}

/**
 * Applies standard styles to a worksheet
 * @param worksheet The worksheet to style
 */
function applyDailyReportStyles(worksheet: ExcelJS.Worksheet): void {
  // Style header cells without merging (merging is done during creation)
  ["A1", "A3", "A12", "A21", "A31", "A39", "A47"].forEach((cellRef) => {
    const cell = worksheet.getCell(cellRef);
    cell.font = { bold: true, size: 12, color: { argb: "2563EB" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "DBEAFE" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "B9D9F7" } },
    };
  });

  // Style section headers
  [3, 12, 21, 31, 39, 47].forEach((row) => {
    worksheet.getRow(row).height = 20;
    worksheet.getRow(row).alignment = { vertical: "middle" };
  });

  // Style table headers
  [22, 32, 40, 48].forEach((row) => {
    const headerRow = worksheet.getRow(row);
    headerRow.font = { bold: true, size: 10 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "EFF6FF" },
    };
    headerRow.height = 18;
    headerRow.alignment = { vertical: "middle" };
  });

  // Add borders dynamically to table header rows based on content
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    // Apply styling to table header rows that contain column headers
    if ([22, 32, 40, 48, 61, 74].indexOf(rowNumber) !== -1) {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }
  });

  // Set column widths
  worksheet.columns.forEach((column, index) => {
    switch (index) {
      case 0: // Column A
        column.width = 15;
        break;
      case 1: // Column B
        column.width = 25;
        break;
      case 2: // Column C
      case 3: // Column D
        column.width = 15;
        break;
      default:
        column.width = 12;
    }
  });
}

/**
 * Formats a DailyReportResponse into an Excel workbook
 * @param workbook ExcelJS Workbook to add the worksheet to
 * @param data DailyReportResponse data to format
 */
export function formatDailyReportWorkbook(
  workbook: ExcelJS.Workbook,
  data: DailyReportResponse
): void {
  const worksheet = workbook.addWorksheet("Daily Operations Report");

  // Title
  worksheet.mergeCells("A1:G1");
  worksheet.getCell("A1").value = "Daily Operations Report";
  worksheet.getCell("A1").font = {
    size: 16,
    bold: true,
    color: { argb: "2563EB" },
  };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  // Restaurant Information
  worksheet.addRow([""]);
  worksheet.mergeCells("A3:G3");
  worksheet.getCell("A3").value = "Restaurant Information";
  worksheet.getCell("A3").font = { bold: true };

  worksheet.addRow(["Name", data.restaurant.name]);
  worksheet.addRow(["Address", data.restaurant.address]);
  worksheet.addRow(["Phone", data.restaurant.phoneNo || ""]); // Handle potential field name difference
  worksheet.addRow(["Email", data.restaurant.email]);
  worksheet.addRow([
    "Report Date Range",
    `${data.restaurant.dateRange.from} - ${data.restaurant.dateRange.to}`,
  ]);

  // Key Metrics
  worksheet.addRow([""]);
  worksheet.addRow([""]);
  worksheet.mergeCells("A12:G12");
  worksheet.getCell("A12").value = "Key Metrics";
  worksheet.getCell("A12").font = { bold: true };

  const totalRevenue = data.summary.orders.totalRevenue || 0;
  const totalExpenses = data.summary.expenses.reduce(
    (acc, exp) => acc + exp.amount,
    0
  );
  const netProfit = totalRevenue - totalExpenses;

  worksheet.addRow(["Total Revenue", formatCurrencyForExcel(totalRevenue)]);
  worksheet.addRow(["Total Expenses", formatCurrencyForExcel(totalExpenses)]);
  worksheet.addRow(["Net Profit", formatCurrencyForExcel(netProfit)]);
  const profitCell = worksheet.getCell("B15");
  profitCell.font = {
    color: { argb: netProfit >= 0 ? "10B981" : "EF4444" },
    bold: true,
  };

  // Orders Summary
  worksheet.addRow([""]);
  worksheet.addRow([""]);
  worksheet.mergeCells("A21:G21");
  worksheet.getCell("A21").value = "Order Summary";
  worksheet.getCell("A21").font = { bold: true };

  worksheet.addRow([
    "Category",
    "Total",
    "Completed",
    "In Progress",
    "Cancelled",
    "Total Revenue",
    "Unpaid Revenue",
    "Cancelled Revenue",
  ]);

  worksheet.addRow([
    "Orders",
    data.summary.orders.total || 0,
    data.summary.orders.completed || 0,
    data.summary.orders.onProgress || 0,
    data.summary.orders.cancelled || 0,
    formatCurrencyForExcel(data.summary.orders.totalRevenue || 0),
    formatCurrencyForExcel(data.summary.orders.unpaidRevenue || 0),
    formatCurrencyForExcel(data.summary.orders.cancelledRevenue || 0),
  ]);

  // Payment Breakdown
  worksheet.addRow([""]);
  worksheet.addRow([""]);

  const paymentRow = worksheet.rowCount;
  worksheet.mergeCells(`A${paymentRow}:G${paymentRow}`);
  worksheet.getCell(`A${paymentRow}`).value = "Payment Breakdown";
  worksheet.getCell(`A${paymentRow}`).font = { bold: true };

  worksheet.addRow(["Payment Method", "Amount", "Percentage"]);

  const paymentMethods: StandardizedPaymentMethod[] = [
    "CASH",
    "UPI",
    "CARD",
    "NOTPAID",
  ];
  const paymentTotals = data.summary.orders.paymentTotals || {};
  const totalPayments = Object.values(paymentTotals).reduce(
    (sum, val) => sum + (val || 0),
    0
  );

  paymentMethods.forEach((method) => {
    const amount = paymentTotals[method] || 0;
    const percentage =
      totalPayments > 0
        ? ((amount / totalPayments) * 100).toFixed(2) + "%"
        : "0%";
    worksheet.addRow([
      formatPaymentMethod(method),
      formatCurrencyForExcel(amount),
      percentage,
    ]);
  });

  worksheet.addRow(["Total", formatCurrencyForExcel(totalPayments), "100%"]);
  const totalRow = worksheet.getRow(worksheet.rowCount);
  totalRow.font = { bold: true };

  // Cash Register
  worksheet.addRow([""]);
  worksheet.addRow([""]);

  const cashRow = worksheet.rowCount;
  worksheet.mergeCells(`A${cashRow}:G${cashRow}`);
  worksheet.getCell(`A${cashRow}`).value = "Cash Register";
  worksheet.getCell(`A${cashRow}`).font = { bold: true };

  worksheet.addRow(["Category", "Amount", ""]);

  if (data.summary.cashRegister) {
    worksheet.addRow([
      "Opening Cash",
      formatCurrencyForExcel(data.summary.cashRegister.openingCash),
      "",
    ]);
    worksheet.addRow([
      "Cash In",
      formatCurrencyForExcel(data.summary.cashRegister.cashIn),
      "",
    ]);
    worksheet.addRow([
      "Cash Out",
      formatCurrencyForExcel(data.summary.cashRegister.cashOut),
      "",
    ]);
    worksheet.addRow([
      "Closing Cash",
      formatCurrencyForExcel(data.summary.cashRegister.closingCash),
      "",
    ]);

    // Calculate balance
    const balance = Object.values(data.summary.cashRegister).reduce(
      (sum, val) => sum + (val || 0),
      0
    );
    worksheet.addRow(["Balance", formatCurrencyForExcel(balance), ""]);
    const balanceRow = worksheet.getRow(worksheet.rowCount);
    balanceRow.font = { bold: true };
  } else {
    worksheet.addRow(["No cash register data available", "", ""]);
  }

  // Top Items
  worksheet.addRow([""]);
  worksheet.addRow([""]);

  const topItemsRow = worksheet.rowCount;
  worksheet.mergeCells(`A${topItemsRow}:G${topItemsRow}`);
  worksheet.getCell(`A${topItemsRow}`).value = "Top Items Sold";
  worksheet.getCell(`A${topItemsRow}`).font = { bold: true };

  worksheet.addRow(["Item Name", "Quantity Sold", "Total Sales"]);

  if (data.summary.topItems && data.summary.topItems.length > 0) {
    data.summary.topItems.forEach((item) => {
      worksheet.addRow([
        item.itemName,
        item.quantitySold,
        formatCurrencyForExcel(item.totalSales),
      ]);
    });
  } else {
    worksheet.addRow(["No top items data available", "", ""]);
  }

  // Expenses
  worksheet.addRow([""]);
  worksheet.addRow([""]);

  const expenseRow = worksheet.rowCount;
  worksheet.mergeCells(`A${expenseRow}:G${expenseRow}`);
  worksheet.getCell(`A${expenseRow}`).value = "Expenses";
  worksheet.getCell(`A${expenseRow}`).font = { bold: true };

  worksheet.addRow(["Category", "Amount", ""]);

  if (data.summary.expenses && data.summary.expenses.length > 0) {
    data.summary.expenses.forEach((expense) => {
      worksheet.addRow([
        expense.category,
        formatCurrencyForExcel(expense.amount),
        "",
      ]);
    });

    // Total expenses
    worksheet.addRow(["Total", formatCurrencyForExcel(totalExpenses), ""]);
    const totalExpRow = worksheet.getRow(worksheet.rowCount);
    totalExpRow.font = { bold: true };
  } else {
    worksheet.addRow(["No expense data available", "", ""]);
  }

  // Staff Performance
  worksheet.addRow([""]);
  worksheet.addRow([""]);

  const staffRow = worksheet.rowCount;
  worksheet.mergeCells(`A${staffRow}:G${staffRow}`);
  worksheet.getCell(`A${staffRow}`).value = "Staff Performance";
  worksheet.getCell(`A${staffRow}`).font = { bold: true };

  worksheet.addRow(["Staff ID", "Orders Handled", "Revenue Generated"]);

  if (
    data.summary.staffPerformance &&
    data.summary.staffPerformance.length > 0
  ) {
    data.summary.staffPerformance.forEach((staff) => {
      worksheet.addRow([
        staff.staffId,
        staff.ordersHandled,
        formatCurrencyForExcel(staff.revenueGenerated),
      ]);
    });
  } else {
    worksheet.addRow(["No staff performance data available", "", ""]);
  }

  // Apply styles
  applyDailyReportStyles(worksheet);

  return;
}

//cash register formatting
function formatCashRegisterWorkbook(
  workbook: ExcelJS.Workbook,
  data: CashRegisterReport
) {
  const worksheet = workbook.addWorksheet("Cash Register Report");

  // Title
  worksheet.mergeCells("A1:E1");
  worksheet.getCell("A1").value = "Cash Register Report";
  worksheet.getCell("A1").font = {
    size: 16,
    bold: true,
    color: { argb: "2563EB" },
  };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  // Restaurant Information
  worksheet.addRow([""]);
  worksheet.addRow(["Restaurant Information"]);
  worksheet.addRow(["Name", data.restaurant.name]);
  worksheet.addRow(["Address", data.restaurant.address]);
  worksheet.addRow(["Phone", data.restaurant.phone]);
  worksheet.addRow(["Email", data.restaurant.email]);
  worksheet.addRow([
    "Report Date Range",
    `${data.restaurant.dateRange.from} - ${data.restaurant.dateRange.to}`,
  ]);

  // Summary Section
  worksheet.addRow([""]);
  worksheet.addRow(["Summary"]);
  worksheet.addRow([
    "Total Opened Registers",
    data.summary.totalOpenedRegister,
  ]);
  worksheet.addRow([
    "Opening Balance",
    formatCurrencyForExcel(data.summary.openingBalance),
  ]);
  worksheet.addRow([
    "Total Cash In",
    formatCurrencyForExcel(data.summary.totalCashIn),
  ]);
  worksheet.addRow([
    "Total Cash Out",
    formatCurrencyForExcel(data.summary.totalCashOut),
  ]);
  worksheet.addRow([
    "Net Position",
    formatCurrencyForExcel(data.summary.netPosition),
  ]);
  worksheet.addRow([
    "Expected Closing Balance",
    formatCurrencyForExcel(data.summary.expectedClosingBalance),
  ]);
  worksheet.addRow([
    "Actual Closing Balance",
    formatCurrencyForExcel(data.summary.actualClosingBlance),
  ]);
  worksheet.addRow([
    "Discrepancy",
    formatCurrencyForExcel(data.summary.discrepancy),
  ]);

  // Payment Distribution
  worksheet.addRow([""]);
  worksheet.addRow(["Payment Distribution - CASH IN"]);
  worksheet.addRow([
    "Cash",
    formatCurrencyForExcel(data.summary.paymentDistribution.cashIn.cash),
  ]);
  worksheet.addRow([
    "UPI",
    formatCurrencyForExcel(data.summary.paymentDistribution.cashIn.upi),
  ]);
  worksheet.addRow([
    "Card",
    formatCurrencyForExcel(data.summary.paymentDistribution.cashIn.card),
  ]);
  worksheet.addRow([
    "Total",
    formatCurrencyForExcel(data.summary.paymentDistribution.cashIn.total),
  ]);

  worksheet.addRow([""]);
  worksheet.addRow(["Payment Distribution - CASH OUT"]);
  worksheet.addRow([
    "Cash",
    formatCurrencyForExcel(data.summary.paymentDistribution.cashOut.cash),
  ]);
  worksheet.addRow([
    "UPI",
    formatCurrencyForExcel(data.summary.paymentDistribution.cashOut.upi),
  ]);
  worksheet.addRow([
    "Card",
    formatCurrencyForExcel(data.summary.paymentDistribution.cashOut.card),
  ]);
  worksheet.addRow([
    "Total",
    formatCurrencyForExcel(data.summary.paymentDistribution.cashOut.total),
  ]);

  // Transactions Table
  worksheet.addRow([""]);
  worksheet.addRow(["Transactions"]);
  worksheet.addRow([
    "Date",
    "Description",
    "Transaction Type",
    "Amount",
    "Source",
    "Payment Method",
    "Performed By",
  ]);

  data.summary.formattedTransactions.forEach((tx) => {
    worksheet.addRow([
      format(new Date(tx.date), "dd MMM yyyy, hh:mm a"),
      tx.description,
      tx.transactionType,
      formatCurrencyForExcel(tx.amount),
      tx.source,
      tx.paymentMethod,
      tx.performedBy,
    ]);
  });

  applySalesStyles(worksheet);
}

export interface DailyReportResponse {
  restaurant: {
    name: string;
    address: string;
    phoneNo: string;
    email: string;
    imageUrl?: string;
    dateRange: {
      from: string; // formatted
      to: string; // formatted
    };
  };
  summary: {
    orders: {
      total: number;
      completed: number;
      onProgress: number;
      cancelled: number;
      totalRevenue: number;
      unpaidRevenue: number;
      cancelledRevenue: number;
      paymentTotals: Record<StandardizedPaymentMethod, number>;
    };
    cashRegister: {
      openingCash: number;
      cashIn: number;
      cashOut: number;
      closingCash: number;
    } | null;
    expenses: {
      category: string;
      amount: number;
    }[];
    topItems: {
      itemName: string;
      quantitySold: number;
      totalSales: number;
    }[];
    staffPerformance: {
      staffId: string;
      ordersHandled: number;
      revenueGenerated: number;
    }[];
  };
}

export interface SalesData {
  restaurant: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo: string;
    dateRange: {
      from: string;
      to: string;
    };
  };
  ordersData: {
    formattedOrders: {
      billId: string;
      orderType: string;
      paidStatus: string;
      totalAmount: number;
      paymentMethod: string;
      createdAt: string;
      createdBy: string;
    }[];
    totalRevenue: number;
    paymentMethods: Record<string, number>;
  };
}

export interface InventoryData {
  restaurant: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    logo: string;
  };
  inventoryData: {
    stats: {
      totalRawMaterials: number;
      totalCategories: number;
      totalPurchaseOrders: number;
      totalVendors: number;
      totalPurchaseAmount: number;
      lowStockItems: number;
    };
    rawMaterialsByCategory: Record<
      string,
      {
        count: number;
        totalValue: number;
        items: {
          name: string;
          currentStock: number;
          minimumStock: number;
          unit: string;
          value: number;
          lastPurchasePrice: number;
        }[];
      }
    >;
    recentPurchases: {
      invoiceNo: string;
      vendorName: string;
      date: string;
      amount: number;
      status: string;
      items: number;
    }[];
    stockStatus: {
      optimal: number;
      low: number;
      outOfStock: number;
    };
    vendorAnalysis: {
      name: string;
      totalPurchases: number;
      totalAmount: number;
      lastPurchaseDate: string;
    }[];
    purchaseHistory: {
      monthly: Record<string, number>;
      categoryWise: Record<string, number>;
      vendorWise: Record<string, number>;
    };
  };
}

export interface CashRegisterReport {
  restaurant: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo: string;
    dateRange: {
      from: string; // Formatted date string
      to: string; // Formatted date string
    };
  };
  summary: {
    totalOpenedRegister: number;
    openingBalance: number;
    totalCashIn: number;
    totalCashOut: number;
    netPosition: number;
    expectedClosingBalance: number;
    actualClosingBlance: number;
    discrepancy: number;
    paymentDistribution: {
      cashIn: {
        cash: number;
        upi: number;
        card: number;
        total: number;
      };
      cashOut: {
        cash: number;
        upi: number;
        card: number;
        total: number;
      };
    };
    formattedTransactions: FormattedTransaction[];
  };
}

export interface FormattedTransaction {
  id: string;
  date: string; // ISO string
  transactionType: CashTransactionType;
  description: string;
  amount: number;
  source: TransactionSource;
  paymentMethod: PaymentMethod;
  performedBy: string;
  registerId: string;
}

function formatInventoryWorkbook(
  workbook: ExcelJS.Workbook,
  data: InventoryData
) {
  console.log(data);
  const worksheet = workbook.addWorksheet("Inventory Report");

  // Title
  worksheet.mergeCells("A1:D1");
  worksheet.getCell("A1").value = "Inventory Report";
  worksheet.getCell("A1").font = {
    size: 16,
    bold: true,
    color: { argb: "2563EB" },
  };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  // Key Stats
  worksheet.addRow([""]);
  worksheet.addRow(["Key Metrics", "Value"]);
  worksheet.addRow([
    "Total Raw Materials",
    data.inventoryData.stats.totalRawMaterials,
  ]);
  worksheet.addRow([
    "Total Categories",
    data.inventoryData.stats.totalCategories,
  ]);
  worksheet.addRow([
    "Total Purchase Orders",
    data.inventoryData.stats.totalPurchaseOrders,
  ]);
  worksheet.addRow(["Total Vendors", data.inventoryData.stats.totalVendors]);
  worksheet.addRow([
    "Total Purchase Amount",
    formatCurrencyForExcel(data.inventoryData.stats.totalPurchaseAmount),
  ]);
  worksheet.addRow(["Low Stock Items", data.inventoryData.stats.lowStockItems]);

  // Raw Materials by Category
  worksheet.addRow([""]);
  worksheet.addRow(["Raw Materials by Category"]);
  worksheet.addRow(["Category", "Count", "Total Value"]);
  Object.entries(data.inventoryData.rawMaterialsByCategory).forEach(
    ([category, info]) => {
      worksheet.addRow([
        category,
        info.count,
        formatCurrencyForExcel(info.totalValue),
      ]);
    }
  );

  // Recent Purchases
  worksheet.addRow([""]);
  worksheet.addRow(["Recent Purchases"]);
  worksheet.addRow([
    "Invoice No",
    "Vendor",
    "Date",
    "Amount",
    "Status",
    "Items",
  ]);
  data.inventoryData.recentPurchases.forEach((purchase) => {
    worksheet.addRow([
      purchase.invoiceNo,
      purchase.vendorName,
      purchase.date,
      formatCurrencyForExcel(purchase.amount),
      purchase.status,
      purchase.items,
    ]);
  });

  // Stock Status
  worksheet.addRow([""]);
  worksheet.addRow(["Stock Status"]);
  worksheet.addRow(["Status", "Count"]);
  Object.entries(data.inventoryData.stockStatus).forEach(([status, count]) => {
    worksheet.addRow([status, count]);
  });

  // Vendor Analysis
  worksheet.addRow([""]);
  worksheet.addRow(["Vendor Analysis"]);
  worksheet.addRow([
    "Vendor",
    "Total Purchases",
    "Total Amount",
    "Last Purchase Date",
  ]);
  data.inventoryData.vendorAnalysis.forEach((vendor) => {
    worksheet.addRow([
      vendor.name,
      vendor.totalPurchases,
      formatCurrencyForExcel(vendor.totalAmount),
      vendor.lastPurchaseDate,
    ]);
  });

  applyInventoryStyles(worksheet);
}

// Simplified styling functions
function applySalesStyles(worksheet: ExcelJS.Worksheet) {
  worksheet.getColumn(1).width = 25;
  worksheet.getColumn(2).width = 20;
  worksheet.getColumn(3).width = 20;

  applyCommonStyles(worksheet);
}

function applyInventoryStyles(worksheet: ExcelJS.Worksheet) {
  worksheet.getColumn(1).width = 25;
  worksheet.getColumn(2).width = 20;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 20;

  applyCommonStyles(worksheet);
}

function applyCommonStyles(worksheet: ExcelJS.Worksheet) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });

    // Style section headers
    if (
      row.getCell(1).value &&
      typeof row.getCell(1).value === "string" &&
      !row.getCell(2).value
    ) {
      row.getCell(1).font = { bold: true, size: 12, color: { argb: "2563EB" } };
    }
  });
}
