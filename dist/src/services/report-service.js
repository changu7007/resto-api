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
exports.ReportService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const puppeteer_1 = __importDefault(require("puppeteer"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const axios_1 = __importDefault(require("axios"));
const date_fns_1 = require("date-fns");
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});
class ReportService {
    generateReport({ templateName, data, dateRange, restaurantId, reportType, }) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fileUrl = yield this.generatePDF(templateName, { data, dateRange }, restaurantId, reportType);
                return { fileUrl };
            }
            catch (error) {
                console.error("Error in report generation:", error);
                throw new Error(`Failed to generate ${reportType} report: ${error.message}`);
            }
        });
    }
    generatePDF(templateName, templateData, restaurantId, reportType) {
        return __awaiter(this, void 0, void 0, function* () {
            const templatePath = path_1.default.join(process.cwd(), `templates/${templateName}.ejs`);
            const template = yield promises_1.default.readFile(templatePath, "utf-8");
            const renderedHtml = yield ejs_1.default.render(template, templateData);
            const browser = yield puppeteer_1.default.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });
            const page = yield browser.newPage();
            yield page.setContent(renderedHtml, { waitUntil: "networkidle0" });
            const pdfBuffer = yield page.pdf({
                format: "A4",
                margin: {
                    top: "1cm",
                    right: "1cm",
                    bottom: "1cm",
                    left: "1cm",
                },
            });
            yield browser.close();
            const key = `${restaurantId}/${reportType}-${(0, date_fns_1.format)(new Date(), "yyyy-MM-dd-HH-mm-ss")}.pdf`;
            const putObjectCommand = new client_s3_1.PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: key,
                Body: pdfBuffer,
                ContentType: "application/pdf",
            });
            const signedUrl = yield (0, s3_request_presigner_1.getSignedUrl)(s3Client, putObjectCommand, {
                expiresIn: 3600, // URL expires in 1 hour
            });
            yield axios_1.default.put(signedUrl, pdfBuffer, {
                headers: {
                    "Content-Type": "application/pdf",
                },
            });
            return signedUrl.split("?")[0];
        });
    }
}
exports.ReportService = ReportService;
