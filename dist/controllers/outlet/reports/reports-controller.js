"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReportsForTable = exports.createReport = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const client_s3_1 = require("@aws-sdk/client-s3");
const exceljs_1 = __importDefault(require("exceljs"));
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const axios_1 = __importDefault(require("axios"));
const zod_1 = require("zod");
const bad_request_1 = require("../../../exceptions/bad-request");
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const formSchema = zod_1.z.object({
    reportType: zod_1.z.enum(["SALES", "INVENTORY", "FINANCIAL", "STAFF"]),
    format: zod_1.z.enum(["PDF", "EXCEL"]),
    dateRange: zod_1.z.object({
        from: zod_1.z.string().refine((date) => !isNaN(Date.parse(date)), {
            message: "Invalid 'from' date",
        }),
        to: zod_1.z.string().refine((date) => !isNaN(Date.parse(date)), {
            message: "Invalid 'to' date",
        }),
    }),
});
const createReport = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const { outletId } = req.params;
    const { data: validateFields, error } = formSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    console.log("Validate fields", validateFields);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    // @ts-ignore
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const data = yield fetchReportData(validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType, (_b = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _b === void 0 ? void 0 : _b.from, (_c = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _c === void 0 ? void 0 : _c.to, outletId);
    if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.format) === "PDF") {
        yield __1.prismaDB.report.create({
            data: {
                restaurantId: outletId,
                userId,
                reportType: validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType,
                format: validateFields === null || validateFields === void 0 ? void 0 : validateFields.format,
                generatedBy: ((_d = outlet.users) === null || _d === void 0 ? void 0 : _d.name) || "System",
                status: "COMPLETED",
                reportData: data,
                dateRange: {
                    create: {
                        startDate: new Date((_e = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _e === void 0 ? void 0 : _e.from),
                        endDate: new Date((_f = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _f === void 0 ? void 0 : _f.to),
                    },
                },
            },
        });
        return res.json({
            success: true,
            message: "PDF report generated",
            reportData: data,
        });
    }
    else if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.format) === "EXCEL") {
        const fileUrl = yield generateExcel(data, validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType, outlet.name);
        yield __1.prismaDB.report.create({
            data: {
                restaurantId: outletId,
                userId,
                reportType: validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType,
                format: validateFields === null || validateFields === void 0 ? void 0 : validateFields.format,
                generatedBy: ((_g = outlet.users) === null || _g === void 0 ? void 0 : _g.name) || "System",
                status: "COMPLETED",
                fileUrl: fileUrl,
                dateRange: {
                    create: {
                        startDate: new Date((_h = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _h === void 0 ? void 0 : _h.from),
                        endDate: new Date((_j = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _j === void 0 ? void 0 : _j.to),
                    },
                },
            },
        });
        return res.json({
            success: true,
            message: "Excel report generated",
        });
    }
});
exports.createReport = createReport;
function fetchReportData(reportType, startDate, endDate, restaurantId) {
    return __awaiter(this, void 0, void 0, function* () {
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
                const [orders, expenses] = yield Promise.all([
                    __1.prismaDB.order.findMany({
                        where,
                        select: { totalAmount: true, gstPrice: true },
                    }),
                    __1.prismaDB.expenses.findMany({ where }),
                ]);
                return { orders, expenses };
            case "STAFF":
                return __1.prismaDB.payroll.findMany({ where, include: { staff: true } });
            default:
                throw new Error("Invalid reportType");
        }
    });
}
function formatSalesData(dateRange, outletId) {
    return __awaiter(this, void 0, void 0, function* () {
        const where = {
            restaurantId: outletId,
            createdAt: {
                gt: new Date(dateRange.from),
                lt: new Date(dateRange.to),
            },
        };
        // Fetch all required data in parallel
        const [orders, outlet, customerStats, topItems] = yield Promise.all([
            __1.prismaDB.order.findMany({
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
            __1.prismaDB.restaurant.findUnique({
                where: { id: outletId },
                select: {
                    name: true,
                    address: true,
                    phoneNo: true,
                    email: true,
                    imageUrl: true,
                },
            }),
            __1.prismaDB.customerRestaurantAccess.groupBy({
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
            __1.prismaDB.orderItem.groupBy({
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
        }, {});
        // Calculate payment methods distribution
        const paymentMethods = orders.reduce((acc, order) => {
            const method = order.orderSession.paymentMethod;
            acc[method] = (acc[method] || 0) + Number(order.totalAmount);
            return acc;
        }, {});
        // Calculate category sales
        const categorySales = orders.reduce((acc, order) => {
            order.orderItems.forEach((item) => {
                acc[item.menuItem.category.name] =
                    (acc[item.menuItem.category.name] || 0) +
                        Number(item.totalPrice) * Number(item.quantity);
            });
            return acc;
        }, {});
        // Calculate time analysis
        const timeAnalysis = {
            peakHours: calculatePeakHours(orders),
            weekdayDistribution: calculateWeekdayDistribution(orders),
        };
        // Format customer analytics
        const customerAnalytics = {
            newCustomers: customerStats.filter((c) => c._count === 1).length,
            repeatCustomers: customerStats.filter((c) => c._count > 1).length,
            averageOrderValue: orders.reduce((acc, order) => acc + Number(order.totalAmount), 0) /
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
            totalRevenue: orders.reduce((acc, order) => acc + Number(order.totalAmount), 0),
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
    });
}
function formatInventoryData(dateRange, outletId) {
    return __awaiter(this, void 0, void 0, function* () {
        const where = {
            restaurantId: outletId,
            createdAt: {
                gte: new Date(dateRange.from),
                lte: new Date(dateRange.to),
            },
        };
        // Fetch all required data in parallel
        const [rawMaterials, categories, purchases, vendors, outlet] = yield Promise.all([
            __1.prismaDB.rawMaterial.findMany({
                where: { restaurantId: outletId },
                include: {
                    rawMaterialCategory: true,
                    consumptionUnit: true,
                    minimumStockUnit: true,
                },
            }),
            __1.prismaDB.rawMaterialCategory.count({
                where: { restaurantId: outletId },
            }),
            __1.prismaDB.purchase.findMany({
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
            __1.prismaDB.vendor.findMany({
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
            __1.prismaDB.restaurant.findUnique({
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
        const totalPurchaseAmount = purchases.reduce((sum, purchase) => sum + (purchase.totalAmount || 0), 0);
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
            const value = (material.currentStock || 0) * (material.lastPurchasedPrice || 0);
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
        }, {});
        // Calculate stock status
        const stockStatus = rawMaterials.reduce((acc, material) => {
            if (!material.currentStock || material.currentStock === 0) {
                acc.outOfStock++;
            }
            else if (material.currentStock <= (material.minimumStockLevel || 0)) {
                acc.low++;
            }
            else {
                acc.optimal++;
            }
            return acc;
        }, { optimal: 0, low: 0, outOfStock: 0 });
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
            var _a;
            const vendorPurchases = vendor.purchases;
            const totalAmount = vendorPurchases.reduce((sum, purchase) => sum + (purchase.totalAmount || 0), 0);
            return {
                name: vendor.name,
                totalPurchases: vendorPurchases.length,
                totalAmount,
                lastPurchaseDate: ((_a = vendorPurchases[0]) === null || _a === void 0 ? void 0 : _a.createdAt.toISOString().split("T")[0]) || "",
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
            }, {}),
            categoryWise: purchases.reduce((acc, purchase) => {
                purchase.purchaseItems.forEach((item) => {
                    const category = item.rawMaterial.rawMaterialCategory.name;
                    acc[category] = (acc[category] || 0) + (item.purchasePrice || 0);
                });
                return acc;
            }, {}),
            vendorWise: purchases.reduce((acc, purchase) => {
                const vendorName = purchase.vendor.name;
                acc[vendorName] = (acc[vendorName] || 0) + (purchase.totalAmount || 0);
                return acc;
            }, {}),
        };
        return {
            restaurant: {
                name: (outlet === null || outlet === void 0 ? void 0 : outlet.name) || "",
                address: (outlet === null || outlet === void 0 ? void 0 : outlet.address) || "",
                phone: (outlet === null || outlet === void 0 ? void 0 : outlet.phoneNo) || "",
                email: (outlet === null || outlet === void 0 ? void 0 : outlet.email) || "",
                website: "",
                logo: (outlet === null || outlet === void 0 ? void 0 : outlet.imageUrl) || "",
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
    });
}
// Helper functions
function calculatePeakHours(orders) {
    return orders.reduce((acc, order) => {
        const hour = new Date(order.createdAt).getHours();
        const timeSlot = `${hour}-${hour + 2}`;
        acc[timeSlot] = (acc[timeSlot] || 0) + 1;
        return acc;
    }, {});
}
function calculateWeekdayDistribution(orders) {
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
function calculateAverageServingTime(orders) {
    const servingTimes = orders
        .filter((order) => order.completedAt && order.createdAt)
        .map((order) => {
        const diff = new Date(order.completedAt).getTime() -
            new Date(order.createdAt).getTime();
        return diff / (1000 * 60); // Convert to minutes
    });
    return servingTimes.length > 0
        ? servingTimes.reduce((acc, time) => acc + time, 0) / servingTimes.length
        : 0;
}
function calculateTotalProfit(orders) {
    return orders.reduce((acc, order) => {
        const profit = order.orderItems.reduce((itemAcc, item) => {
            return itemAcc + (item.price - (item.costPrice || 0)) * item.quantity;
        }, 0);
        return acc + profit;
    }, 0);
}
function generateExcel(data, reportType, outletName) {
    return __awaiter(this, void 0, void 0, function* () {
        const workbook = new exceljs_1.default.Workbook();
        switch (reportType) {
            case "SALES":
                formatSalesWorkbook(workbook, data);
                break;
            case "INVENTORY":
                formatInventoryWorkbook(workbook, data);
                break;
            // Add other report types...
        }
        const buffer = yield workbook.xlsx.writeBuffer();
        const nodeBuffer = Buffer.from(buffer);
        return uploadToS3(nodeBuffer, `${outletName}/reports/${reportType}_${Date.now()}.xlsx`);
    });
}
function uploadToS3(buffer, key) {
    return __awaiter(this, void 0, void 0, function* () {
        const putObjectCommand = new client_s3_1.PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: key.endsWith(".pdf")
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const signedUrl = yield (0, s3_request_presigner_1.getSignedUrl)(s3Client, putObjectCommand, {
            expiresIn: 60,
        });
        // Perform the PUT request to the signed URL
        yield axios_1.default.put(signedUrl, buffer, {
            headers: {
                "Content-Type": putObjectCommand.input.ContentType, // Use the ContentType from the input object
            },
        });
        return signedUrl.split("?")[0];
    });
}
const getReportsForTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _k;
    const { outletId } = req.params;
    const search = req.body.search;
    const sorting = req.body.sorting || [];
    const filters = req.body.filters || [];
    const dateRange = req.body.dateRange;
    // Build orderBy for Prisma query
    const orderBy = (sorting === null || sorting === void 0 ? void 0 : sorting.length) > 0
        ? sorting.map((sort) => ({
            [sort.id]: sort.desc ? "desc" : "asc",
        }))
        : [{ createdAt: "desc" }];
    const pagination = req.body.pagination || {
        pageIndex: 0,
        pageSize: 8,
    };
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Calculate pagination parameters
    const take = pagination.pageSize || 8;
    const skip = pagination.pageIndex * take;
    // Build filters dynamically
    const filterConditions = filters.map((filter) => ({
        [filter.id]: { in: filter.value },
    }));
    // Fetch total count for the given query
    const totalCount = yield __1.prismaDB.report.count({
        where: Object.assign({ restaurantId: outletId, OR: [{ generatedBy: { contains: search, mode: "insensitive" } }], AND: filterConditions }, (dateRange && {
            createdAt: {
                gt: new Date(dateRange.from),
                lt: new Date(dateRange.to),
            },
        })),
    });
    const reports = yield __1.prismaDB.report.findMany({
        take,
        skip,
        where: Object.assign({ restaurantId: outletId, OR: [{ generatedBy: { contains: (_k = search) !== null && _k !== void 0 ? _k : "" } }], AND: filterConditions }, (dateRange && {
            createdAt: {
                gt: new Date(dateRange.from),
                lt: new Date(dateRange.to),
            },
        })),
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
});
exports.getReportsForTable = getReportsForTable;
// Helper Functions
function formatCurrencyForExcel(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
    }).format(value);
}
function styleWorksheet(worksheet) {
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.font = { name: "Arial", size: 10 };
            cell.alignment = { vertical: "middle", horizontal: "left" };
        });
    });
}
// Sales Report Formatting
function formatSalesWorkbook(workbook, data) {
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
    Object.entries(data.ordersData.categorySales).forEach(([category, amount]) => {
        worksheet.addRow([category, formatCurrencyForExcel(amount)]);
    });
    // Time Analysis
    worksheet.addRow([""]);
    worksheet.addRow(["Peak Hours"]);
    worksheet.addRow(["Hour", "Orders"]);
    Object.entries(data.ordersData.timeAnalysis.peakHours).forEach(([hour, count]) => {
        worksheet.addRow([hour, count]);
    });
    worksheet.addRow([""]);
    worksheet.addRow(["Weekday Distribution"]);
    worksheet.addRow(["Day", "Orders"]);
    Object.entries(data.ordersData.timeAnalysis.weekdayDistribution).forEach(([day, count]) => {
        worksheet.addRow([day, count]);
    });
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
function formatInventoryWorkbook(workbook, data) {
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
    Object.entries(data.inventoryData.rawMaterialsByCategory).forEach(([category, info]) => {
        worksheet.addRow([
            category,
            info.count,
            formatCurrencyForExcel(info.totalValue),
        ]);
    });
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
function applySalesStyles(worksheet) {
    worksheet.getColumn(1).width = 25;
    worksheet.getColumn(2).width = 20;
    worksheet.getColumn(3).width = 20;
    applyCommonStyles(worksheet);
}
function applyInventoryStyles(worksheet) {
    worksheet.getColumn(1).width = 25;
    worksheet.getColumn(2).width = 20;
    worksheet.getColumn(3).width = 20;
    worksheet.getColumn(4).width = 20;
    applyCommonStyles(worksheet);
}
function applyCommonStyles(worksheet) {
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.font = { name: "Arial", size: 10 };
            cell.alignment = { vertical: "middle", horizontal: "left" };
        });
        // Style section headers
        if (row.getCell(1).value &&
            typeof row.getCell(1).value === "string" &&
            !row.getCell(2).value) {
            row.getCell(1).font = { bold: true, size: 12, color: { argb: "2563EB" } };
        }
    });
}
