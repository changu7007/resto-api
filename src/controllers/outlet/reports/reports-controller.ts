import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import ExcelJS from "exceljs";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import axios from "axios";
import { PaymentMethod, ReportType } from "@prisma/client";
import { z } from "zod";
import { BadRequestsException } from "../../../exceptions/bad-request";
import {
  ColumnFilters,
  ColumnSort,
  PaginationState,
} from "../../../schema/staff";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const formSchema = z.object({
  reportType: z.enum(["SALES", "INVENTORY", "FINANCIAL", "STAFF"]),
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

async function fetchReportData(
  reportType: string,
  startDate: string,
  endDate: string,
  restaurantId: string
) {
  const where = {
    restaurantId,
    createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
  };

  const dateRange = {
    from: startDate,
    to: endDate,
  };

  switch (reportType) {
    case "SALES":
      return formatSalesData(dateRange, restaurantId);
    case "INVENTORY":
      return formatInventoryData(dateRange, restaurantId);
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

async function formatSalesData(
  dateRange: { from: string; to: string },
  outletId: string
) {
  const where = {
    restaurantId: outletId,
    createdAt: {
      gt: new Date(dateRange.from),
      lt: new Date(dateRange.to),
    },
  };

  // Fetch all required data in parallel
  const [orders, outlet, customerStats, topItems] = await Promise.all([
    prismaDB.order.findMany({
      where,
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: {
                category: true,
              },
            },
          },
        },
        orderSession: {
          select: {
            paymentMethod: true,
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
    prismaDB.customerRestaurantAccess.groupBy({
      by: ["id"],
      where: {
        orderSession: {
          some: {
            orders: {
              every: where,
            },
          },
        },
      },
      _count: true,
    }),
    prismaDB.orderItem.groupBy({
      by: ["name"],
      where: {
        order: where,
      },
      _sum: {
        quantity: true,
        totalPrice: true,
      },
    }),
  ]);

  // Calculate order types distribution
  const ordersType = orders.reduce((acc, order) => {
    const type = order.orderType;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate payment methods distribution
  const paymentMethods = orders.reduce((acc, order) => {
    const method = order.orderSession.paymentMethod as PaymentMethod;
    acc[method] = (acc[method] || 0) + Number(order.totalAmount);
    return acc;
  }, {} as Record<PaymentMethod, number>);

  // Calculate category sales
  const categorySales = orders.reduce((acc, order) => {
    order.orderItems.forEach((item) => {
      acc[item.menuItem.category.name] =
        (acc[item.menuItem.category.name] || 0) +
        Number(item.totalPrice) * Number(item.quantity);
    });
    return acc;
  }, {} as Record<string, number>);

  // Calculate time analysis
  const timeAnalysis = {
    peakHours: calculatePeakHours(orders),
    weekdayDistribution: calculateWeekdayDistribution(orders),
  };

  // Format customer analytics
  const customerAnalytics = {
    newCustomers: customerStats.filter((c) => c._count === 1).length,
    repeatCustomers: customerStats.filter((c) => c._count > 1).length,
    averageOrderValue:
      orders.reduce((acc, order) => acc + Number(order.totalAmount), 0) /
      orders.length,
    avgServingTime: calculateAverageServingTime(orders),
  };

  // Format top items
  const formattedTopItems = topItems
    .map((item) => ({
      name: item.name,
      quantity: Number(item._sum.quantity) || 0,
      revenue: Number(item._sum.totalPrice) || 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

    .slice(0, 5);

  // Calculate total stats
  const stats = {
    totalItems: orders.reduce((acc, order) => acc + order.orderItems.length, 0),
    totalRevenue: orders.reduce(
      (acc, order) => acc + Number(order.totalAmount),
      0
    ),
    totalOrders: orders.length,
    totalProfit: calculateTotalProfit(orders),
    totalCustomers: customerStats.length,
    totalTax: orders.reduce((acc, order) => acc + (order.gstPrice || 0), 0),
  };

  return {
    restaurant: outlet,
    ordersData: {
      stats,
      ordersType,
      paymentMethods,
      categorySales,
      timeAnalysis,
      customerAnalytics,
      topItems: formattedTopItems,
    },
  };
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
        acc[category] = (acc[category] || 0) + (item.totalPrice || 0);
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

// Helper functions
function calculatePeakHours(orders: any[]): Record<string, number> {
  return orders.reduce((acc, order) => {
    const hour = new Date(order.createdAt).getHours();
    const timeSlot = `${hour}-${hour + 2}`;
    acc[timeSlot] = (acc[timeSlot] || 0) + 1;
    return acc;
  }, {});
}

function calculateWeekdayDistribution(orders: any[]): Record<string, number> {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return orders.reduce((acc, order) => {
    const day = days[new Date(order.createdAt).getDay()];
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});
}

function calculateAverageServingTime(orders: any[]): number {
  const servingTimes = orders
    .filter((order) => order.completedAt && order.createdAt)
    .map((order) => {
      const diff =
        new Date(order.completedAt).getTime() -
        new Date(order.createdAt).getTime();
      return diff / (1000 * 60); // Convert to minutes
    });

  return servingTimes.length > 0
    ? servingTimes.reduce((acc, time) => acc + time, 0) / servingTimes.length
    : 0;
}

function calculateTotalProfit(orders: any[]): number {
  return orders.reduce((acc, order) => {
    const profit = order.orderItems.reduce((itemAcc: number, item: any) => {
      return itemAcc + (item.price - (item.costPrice || 0)) * item.quantity;
    }, 0);
    return acc + profit;
  }, 0);
}

async function generateExcel(
  data: any,
  reportType: ReportType,
  outletName: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook();

  switch (reportType) {
    case "SALES":
      formatSalesWorkbook(workbook, data);
      break;
    case "INVENTORY":
      formatInventoryWorkbook(workbook, data);
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

  // Fetch total count for the given query
  const totalCount = await prismaDB.report.count({
    where: {
      restaurantId: outletId,
      OR: [{ generatedBy: { contains: search, mode: "insensitive" } }],
      AND: filterConditions,
      ...(dateRange && {
        createdAt: {
          gt: new Date(dateRange.from),
          lt: new Date(dateRange.to),
        },
      }),
    },
  });

  const reports = await prismaDB.report.findMany({
    take,
    skip,
    where: {
      restaurantId: outletId,
      OR: [{ generatedBy: { contains: (search as string) ?? "" } }],
      AND: filterConditions, // Apply filters dynamically
      ...(dateRange && {
        createdAt: {
          gt: new Date(dateRange.from),
          lt: new Date(dateRange.to),
        },
      }),
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
  const worksheet = workbook.addWorksheet("Sales Report");

  // Title
  worksheet.mergeCells("A1:D1");
  worksheet.getCell("A1").value = "Sales Report";
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
    "Total Revenue",
    formatCurrencyForExcel(data.ordersData.stats.totalRevenue),
  ]);
  worksheet.addRow(["Total Orders", data.ordersData.stats.totalOrders]);
  worksheet.addRow(["Total Items", data.ordersData.stats.totalItems]);
  worksheet.addRow([
    "Total Profit",
    formatCurrencyForExcel(data.ordersData.stats.totalProfit),
  ]);
  worksheet.addRow(["Total Customers", data.ordersData.stats.totalCustomers]);
  worksheet.addRow([
    "Total Tax",
    formatCurrencyForExcel(data.ordersData.stats.totalTax),
  ]);

  // Order Types
  worksheet.addRow([""]);
  worksheet.addRow(["Order Types"]);
  worksheet.addRow(["Type", "Count"]);
  Object.entries(data.ordersData.ordersType).forEach(([type, count]) => {
    worksheet.addRow([type, count]);
  });

  // Payment Methods
  worksheet.addRow([""]);
  worksheet.addRow(["Payment Methods"]);
  worksheet.addRow(["Method", "Amount"]);
  Object.entries(data.ordersData.paymentMethods).forEach(([method, amount]) => {
    worksheet.addRow([method, formatCurrencyForExcel(amount)]);
  });

  // Category Sales
  worksheet.addRow([""]);
  worksheet.addRow(["Category Sales"]);
  worksheet.addRow(["Category", "Amount"]);
  Object.entries(data.ordersData.categorySales).forEach(
    ([category, amount]) => {
      worksheet.addRow([category, formatCurrencyForExcel(amount)]);
    }
  );

  // Time Analysis
  worksheet.addRow([""]);
  worksheet.addRow(["Peak Hours"]);
  worksheet.addRow(["Hour", "Orders"]);
  Object.entries(data.ordersData.timeAnalysis.peakHours).forEach(
    ([hour, count]) => {
      worksheet.addRow([hour, count]);
    }
  );

  worksheet.addRow([""]);
  worksheet.addRow(["Weekday Distribution"]);
  worksheet.addRow(["Day", "Orders"]);
  Object.entries(data.ordersData.timeAnalysis.weekdayDistribution).forEach(
    ([day, count]) => {
      worksheet.addRow([day, count]);
    }
  );

  // Customer Analytics
  worksheet.addRow([""]);
  worksheet.addRow(["Customer Analytics"]);
  worksheet.addRow(["Metric", "Value"]);
  worksheet.addRow([
    "New Customers",
    data.ordersData.customerAnalytics.newCustomers,
  ]);
  worksheet.addRow([
    "Repeat Customers",
    data.ordersData.customerAnalytics.repeatCustomers,
  ]);
  worksheet.addRow([
    "Average Order Value",
    formatCurrencyForExcel(data.ordersData.customerAnalytics.averageOrderValue),
  ]);
  worksheet.addRow([
    "Average Serving Time",
    `${data.ordersData.customerAnalytics.avgServingTime} mins`,
  ]);

  // Top Items
  worksheet.addRow([""]);
  worksheet.addRow(["Top Selling Items"]);
  worksheet.addRow(["Item Name", "Quantity", "Revenue"]);
  data.ordersData.topItems.forEach((item) => {
    worksheet.addRow([
      item.name,
      item.quantity,
      formatCurrencyForExcel(item.revenue),
    ]);
  });

  applySalesStyles(worksheet);
}

export interface SalesData {
  restaurant: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    logo: string;
  };
  ordersData: {
    stats: {
      totalItems: number;
      totalRevenue: number;
      totalOrders: number;
      totalProfit: number;
      totalCustomers: number;
      totalTax: number;
    };
    ordersType: Record<string, number>;
    paymentMethods: Record<string, number>;
    categorySales: Record<string, number>;
    timeAnalysis: {
      peakHours: Record<string, number>;
      weekdayDistribution: Record<string, number>;
    };
    customerAnalytics: {
      newCustomers: number;
      repeatCustomers: number;
      averageOrderValue: number;
      avgServingTime: number;
    };
    topItems: {
      name: string;
      quantity: number;
      revenue: number;
    }[];
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

function formatInventoryWorkbook(
  workbook: ExcelJS.Workbook,
  data: InventoryData
) {
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
