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
exports.createReport = void 0;
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const client_s3_1 = require("@aws-sdk/client-s3");
const promises_1 = __importDefault(require("fs/promises"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const json2csv_1 = require("json2csv");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const axios_1 = __importDefault(require("axios"));
const zod_1 = require("zod");
const bad_request_1 = require("../../../exceptions/bad-request");
const secrets_1 = require("../../../secrets");
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const formSchema = zod_1.z.object({
    reportType: zod_1.z.enum(["SALES", "INVENTORY", "FINANCIAL", "STAFF"]),
    format: zod_1.z.enum(["PDF", "CSV"]),
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
    var _a, _b, _c, _d;
    const { outletId } = req.params;
    const { data: validateFields, error } = formSchema.safeParse(req.body);
    if (error) {
        throw new bad_request_1.BadRequestsException(error.errors[0].message, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    console.log("Validate fields", validateFields);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const data = yield fetchReportData(validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType, (_a = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _a === void 0 ? void 0 : _a.from, (_b = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _b === void 0 ? void 0 : _b.to, outletId);
    if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.format) === "PDF") {
        const reportUrl = yield generatePdfReport(data, (_c = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _c === void 0 ? void 0 : _c.from, (_d = validateFields === null || validateFields === void 0 ? void 0 : validateFields.dateRange) === null || _d === void 0 ? void 0 : _d.to, validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType, outlet === null || outlet === void 0 ? void 0 : outlet.name);
        yield saveReportToDatabase(validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType, validateFields === null || validateFields === void 0 ? void 0 : validateFields.format, reportUrl, outletId);
        return res.json({
            success: true,
            message: "PDF report generated",
            reportUrl,
        });
    }
    else if ((validateFields === null || validateFields === void 0 ? void 0 : validateFields.format) === "CSV") {
        const reportUrl = yield generateCsvReport(data, validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType, outlet.name);
        yield saveReportToDatabase(validateFields === null || validateFields === void 0 ? void 0 : validateFields.reportType, validateFields === null || validateFields === void 0 ? void 0 : validateFields.format, reportUrl, outletId);
        return res.json({
            success: true,
            message: "CSV report generated",
            reportUrl,
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
        switch (reportType) {
            case "SALES":
                return __1.prismaDB.order.findMany({ where, include: { orderItems: true } });
            case "INVENTORY":
                return __1.prismaDB.purchase.findMany({
                    where,
                    include: { purchaseItems: true },
                });
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
function generatePdfReport(data, startDate, endDate, reportType, restaurantName) {
    return __awaiter(this, void 0, void 0, function* () {
        const templatePath = path_1.default.join(process.cwd(), `templates/${reportType.toLowerCase()}.ejs`);
        const template = yield promises_1.default.readFile(templatePath, "utf-8");
        const renderedHtml = yield ejs_1.default.renderFile(templatePath, {
            data,
            startDate,
            endDate,
            restaurantName,
        });
        const browser = yield puppeteer_1.default.launch({
            headless: true,
            executablePath: secrets_1.PUPPETEER_EXECUTABLE_PATH,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = yield browser.newPage();
        yield page.setContent(renderedHtml, { waitUntil: "networkidle0" });
        const pdfBuffer = Buffer.from(yield page.pdf({
            // Convert Uint8Array to Buffer
            format: "A4",
            margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
        }));
        yield browser.close();
        return uploadToS3(pdfBuffer, `${restaurantName}/reports/${reportType}_${Date.now()}.pdf`);
    });
}
function generateCsvReport(data, reportType, restaurantName) {
    return __awaiter(this, void 0, void 0, function* () {
        const fields = Object.keys(data[0] || {});
        const parser = new json2csv_1.Parser({ fields });
        const csv = parser.parse(data);
        const buffer = Buffer.from(csv, "utf-8");
        return uploadToS3(buffer, `${restaurantName}/reports/${reportType}_${Date.now()}.csv`);
    });
}
function uploadToS3(buffer, key) {
    return __awaiter(this, void 0, void 0, function* () {
        const putObjectCommand = new client_s3_1.PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: key.endsWith(".pdf") ? "application/pdf" : "text/csv",
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
function saveReportToDatabase(reportType, reportFormat, fileUrl, restaurantId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield __1.prismaDB.report.create({
            data: {
                restaurantId,
                reportType,
                format: reportFormat,
                fileUrl,
                userId: "not-defined",
                generatedBy: "admin", // Replace with actual user ID
                status: "COMPLETED",
            },
        });
    });
}
