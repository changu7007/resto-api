import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import puppeteer from "puppeteer";
import ejs from "ejs";
import path from "path";
import fs from "fs/promises";
import axios from "axios";
import { format } from "date-fns";

interface ReportGenerationOptions {
  templateName: string;
  data: any;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  restaurantId: string;
  reportType: "SALES" | "INVENTORY" | "FINANCIAL" | "STAFF";
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export class ReportService {
  async generateReport({
    templateName,
    data,
    dateRange,
    restaurantId,
    reportType,
  }: ReportGenerationOptions) {
    try {
      const fileUrl = await this.generatePDF(
        templateName,
        { data, dateRange },
        restaurantId,
        reportType
      );
      return { fileUrl };
    } catch (error: any) {
      console.error("Error in report generation:", error);
      throw new Error(
        `Failed to generate ${reportType} report: ${error.message}`
      );
    }
  }

  private async generatePDF(
    templateName: string,
    templateData: any,
    restaurantId: string,
    reportType: string
  ): Promise<string> {
    const templatePath = path.join(
      process.cwd(),
      `templates/${templateName}.ejs`
    );
    const template = await fs.readFile(templatePath, "utf-8");

    const renderedHtml = await ejs.render(template, templateData);

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(renderedHtml, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: {
        top: "1cm",
        right: "1cm",
        bottom: "1cm",
        left: "1cm",
      },
    });

    await browser.close();
    const key = `${restaurantId}/${reportType}-${format(
      new Date(),
      "yyyy-MM-dd-HH-mm-ss"
    )}.pdf`;

    const putObjectCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    });

    const signedUrl = await getSignedUrl(s3Client, putObjectCommand, {
      expiresIn: 3600, // URL expires in 1 hour
    });

    await axios.put(signedUrl, pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
      },
    });

    return signedUrl.split("?")[0];
  }
}
