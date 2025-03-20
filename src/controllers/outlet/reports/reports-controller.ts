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
  // Adjust date ranges to start at 00:00:00 for the start date and 23:59:59 for the end date (IST)
  const startDateWithTime = new Date(startDate);
  startDateWithTime.setHours(0, 0, 0, 0);

  const endDateWithTime = new Date(endDate);
  endDateWithTime.setHours(23, 59, 59, 999);

  const where = {
    restaurantId,
    createdAt: {
      gte: startDateWithTime,
      lte: endDateWithTime,
    },
  };

  const dateRange = {
    from: startDateWithTime.toISOString(),
    to: endDateWithTime.toISOString(),
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
  const [orders, outlet] = await Promise.all([
    prismaDB.order.findMany({
      where,
      include: {
        orderSession: {
          select: {
            billId: true,
            paymentMethod: true,
            isPaid: true,
            splitPayments: true,
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
  const formattedOrders = orders.map((order) => ({
    billId: order.orderSession.billId || order.id,
    orderType: order.orderType,
    paidStatus: order.orderSession.isPaid ? "Paid" : "Unpaid",
    totalAmount: Number(order.totalAmount),
    paymentMethod: order.orderSession.paymentMethod,
    time: order.createdAt.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
    date: order.createdAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
  }));

  const standardizedPayments: Record<StandardizedPaymentMethod, number> = {
    CASH: 0,
    UPI: 0,
    CARD: 0,
    OTHER: 0,
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
      standardizedPayments["OTHER"] += orderAmount;
    }
  });

  // Remove any payment methods with zero amounts
  const paymentMethods = Object.fromEntries(
    Object.entries(standardizedPayments).filter(([_, amount]) => amount > 0)
  );

  // Calculate total revenue
  const totalRevenue = orders.reduce(
    (acc, order) => acc + Number(order.totalAmount),
    0
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
    ordersData: {
      formattedOrders,
      totalRevenue,
      paymentMethods,
    },
  };
}

// Define a type for the standardized payment methods
type StandardizedPaymentMethod = "CASH" | "UPI" | "CARD" | "OTHER";

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
      return "OTHER";
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

  let dateFilter = {};

  // Apply the proper time range if dateRange is provided
  if (dateRange) {
    const startDateWithTime = new Date(dateRange.from);
    startDateWithTime.setHours(0, 0, 0, 0);

    const endDateWithTime = new Date(dateRange.to);
    endDateWithTime.setHours(23, 59, 59, 999);

    dateFilter = {
      createdAt: {
        gte: startDateWithTime,
        lte: endDateWithTime,
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
    "Amount",
    "Date",
    "Time",
  ]);

  data.ordersData.formattedOrders.forEach((order) => {
    worksheet.addRow([
      order.billId,
      order.orderType,
      order.paidStatus,
      formatCurrencyForExcel(order.totalAmount),
      order.date,
      order.time,
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
      time: string;
      date: string;
      paymentMethod: string;
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
