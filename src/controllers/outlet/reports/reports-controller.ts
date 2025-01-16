import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import ejs from "ejs";
import path from "path";
import puppeteer from "puppeteer";
import { Parser } from "json2csv";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import axios from "axios";
import { ReportFormat, ReportType } from "@prisma/client";
import { z } from "zod";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { PUPPETEER_EXECUTABLE_PATH } from "../../../secrets";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const formSchema = z.object({
  reportType: z.enum(["SALES", "INVENTORY", "FINANCIAL", "STAFF"]),
  format: z.enum(["PDF", "CSV"]),
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
    const reportUrl = await generatePdfReport(
      data,
      validateFields?.dateRange?.from,
      validateFields?.dateRange?.to,
      validateFields?.reportType,
      outlet?.name
    );
    await saveReportToDatabase(
      validateFields?.reportType,
      validateFields?.format,
      reportUrl,
      outletId
    );
    return res.json({
      success: true,
      message: "PDF report generated",
      reportUrl,
    });
  } else if (validateFields?.format === "CSV") {
    const reportUrl = await generateCsvReport(
      data,
      validateFields?.reportType,
      outlet.name
    );
    await saveReportToDatabase(
      validateFields?.reportType,
      validateFields?.format,
      reportUrl,
      outletId
    );
    return res.json({
      success: true,
      message: "CSV report generated",
      reportUrl,
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

  switch (reportType) {
    case "SALES":
      return prismaDB.order.findMany({ where, include: { orderItems: true } });
    case "INVENTORY":
      return prismaDB.purchase.findMany({
        where,
        include: { purchaseItems: true },
      });
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

async function generatePdfReport(
  data: any,
  startDate: string,
  endDate: string,
  reportType: ReportType,
  restaurantName: string
) {
  const templatePath = path.join(
    process.cwd(),
    `templates/${reportType.toLowerCase()}.ejs`
  );
  const template = await fs.readFile(templatePath, "utf-8");

  const renderedHtml = await ejs.renderFile(templatePath, {
    data,
    startDate,
    endDate,
    restaurantName,
  });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: PUPPETEER_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(renderedHtml, { waitUntil: "networkidle0" });
  const pdfBuffer = Buffer.from(
    await page.pdf({
      // Convert Uint8Array to Buffer
      format: "A4",
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
    })
  );
  await browser.close();

  return uploadToS3(
    pdfBuffer,
    `${restaurantName}/reports/${reportType}_${Date.now()}.pdf`
  );
}

async function generateCsvReport(
  data: any,
  reportType: ReportType,
  restaurantName: string
) {
  const fields = Object.keys(data[0] || {});
  const parser = new Parser({ fields });
  const csv = parser.parse(data);

  const buffer = Buffer.from(csv, "utf-8");

  return uploadToS3(
    buffer,
    `${restaurantName}/reports/${reportType}_${Date.now()}.csv`
  );
}

async function uploadToS3(buffer: Buffer, key: string) {
  const putObjectCommand = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: key,
    Body: buffer,
    ContentType: key.endsWith(".pdf") ? "application/pdf" : "text/csv",
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

async function saveReportToDatabase(
  reportType: ReportType,
  reportFormat: ReportFormat,
  fileUrl: string,
  restaurantId: string
) {
  await prismaDB.report.create({
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
}
