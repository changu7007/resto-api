import { Request, Response } from "express";
import { getOrderSessionById, getOutletById } from "../../../../lib/outlet";
import { NotFoundException } from "../../../../exceptions/not-found";
import { ErrorCode } from "../../../../exceptions/root";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { BadRequestsException } from "../../../../exceptions/bad-request";
import { prismaDB } from "../../../..";
import { redis } from "../../../../services/redis";
import { websocketManager } from "../../../../services/ws";
import {
  getFetchActiveOrderSessionToRedis,
  getFetchAllOrderSessionToRedis,
  getFetchAllOrdersToRedis,
  getFetchLiveOrderToRedis,
} from "../../../../lib/outlet/get-order";
import {
  getFetchAllAreastoRedis,
  getFetchAllTablesToRedis,
} from "../../../../lib/outlet/get-tables";
import { NotificationService } from "../../../../services/firebase";
import fs from "fs/promises";
import path from "path";
import ejs from "ejs";
import puppeteer from "puppeteer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import axios from "axios";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const billingOrderSession = async (req: Request, res: Response) => {
  const { orderSessionId, outletId } = req.params;

  const { subTotal, paymentMethod } = req.body;

  if (
    typeof subTotal !== "number" ||
    !Object.values(PaymentMethod).includes(paymentMethod)
  ) {
    throw new BadRequestsException(
      "Invalid total or Choose Payment method",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const orderSession = await getOrderSessionById(outlet.id, orderSessionId);

  if (!orderSession?.id) {
    throw new NotFoundException("Order Session not Found", ErrorCode.NOT_FOUND);
  }

  const updatedOrderSession = await prismaDB.orderSession.update({
    where: {
      id: orderSession.id,
      restaurantId: outlet.id,
    },
    data: {
      active: false,
      isPaid: true,
      paymentMethod: paymentMethod,
      subTotal: String(subTotal),
      sessionStatus: "COMPLETED",
      orders: {
        updateMany: {
          where: {
            orderStatus: "SERVED",
          },
          data: {
            active: false,
            isPaid: true,
            orderStatus: "COMPLETED",
          },
        },
      },
    },
    include: {
      orders: {
        include: {
          orderItems: {
            include: {
              menuItem: {
                include: {
                  menuItemVariants: true,
                  menuGroupAddOns: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!updatedOrderSession) {
    throw new BadRequestsException(
      "Something went wrong while recieveing the bill",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }

  const { cgst, roundedDifference, roundedTotal, sgst, subtotal } =
    calculateTotals(updatedOrderSession.orders);

  const invoiceData = {
    restaurantName: outlet.restaurantName,
    address: `${outlet.address},${outlet.city}-${outlet.pincode}`,
    gst: outlet.GSTIN,
    invoiceNo: updatedOrderSession.billId,
    fssai: outlet.GSTIN,
    invoiceDate: new Date().toLocaleTimeString(),
    customerName: updatedOrderSession.username,
    customerNo: updatedOrderSession.phoneNo ?? "NA",
    paymentMethod: paymentMethod,
    customerAddress: "NA",
    orderSessionId: updatedOrderSession.id,
    orderItems: updatedOrderSession.orders
      .filter((order) => order.orderStatus === "COMPLETED")
      .flatMap((orderItem) =>
        orderItem.orderItems.map((item, idx) => ({
          id: idx + 1,
          name: item.menuItem.name,
          quantity: item.quantity,
          price: item.menuItem.isVariants
            ? item.menuItem.menuItemVariants.find(
                (menu) => menu.id === item.sizeVariantsId
              )?.price
            : item.menuItem.price,
          totalPrice: item.price,
        }))
      ),
    discount: 0,
    subtotal: subtotal,
    sgst: sgst,
    cgst: cgst,
    rounded: roundedDifference,
    total: roundedTotal,
  };

  console.log("Invoice Data", invoiceData.orderItems);

  const { invoiceUrl } = await generatePdfInvoice(invoiceData);

  await prismaDB.orderSession.update({
    where: {
      restaurantId: outlet.id,
      id: updatedOrderSession?.id,
    },
    data: {
      invoiceUrl: invoiceUrl,
    },
  });

  if (updatedOrderSession.orderType === "DINEIN") {
    const findTable = await prismaDB.table.findFirst({
      where: {
        restaurantId: outlet.id,
        currentOrderSessionId: orderSession.id,
      },
    });

    if (!findTable) {
      throw new BadRequestsException(
        "Could not find the table bill your looking for",
        ErrorCode.INTERNAL_EXCEPTION
      );
    }

    const updateTable = await prismaDB.table.update({
      where: {
        id: findTable?.id,
        restaurantId: outlet.id,
      },
      data: {
        occupied: false,
        currentOrderSessionId: null,
        customerId: null,
      },
    });

    if (!updateTable) {
      throw new BadRequestsException(
        "Could not remove the table session",
        ErrorCode.INTERNAL_EXCEPTION
      );
    }
    await getFetchLiveOrderToRedis(outletId);
    await getFetchAllTablesToRedis(outletId);
    await getFetchAllAreastoRedis(outletId);
  }

  await Promise.all([
    getFetchActiveOrderSessionToRedis(outletId),
    getFetchAllOrderSessionToRedis(outletId),
    getFetchAllOrdersToRedis(outletId),
    getFetchLiveOrderToRedis(outletId),
    getFetchAllTablesToRedis(outletId),
    getFetchAllAreastoRedis(outletId),
    redis.del(`all-order-staff-${outletId}`),
  ]);

  await NotificationService.sendNotification(
    outlet?.fcmToken!,
    "Bill Recieved",
    `${subTotal}`
  );

  websocketManager.notifyClients(
    JSON.stringify({
      type: "BILL_UPDATED",
    })
  );

  return res.json({
    success: true,
    message: "Bill Recieved & Saved Success ✅",
  });
};

export const generatePdfInvoice = async (invoiceData: any) => {
  // Read the EJS template
  const templatePath = path.join(process.cwd(), "src/templates/invoice.ejs");
  const template = await fs.readFile(templatePath, "utf-8");

  try {
    const renderedHtml = await ejs.renderFile(templatePath, {
      invoiceData,
    });

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

    const key = `${invoiceData.restaurantName}/${invoiceData.invoiceNo}.pdf`; // File path in S3

    const putObjectCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    });

    const signedUrl = await getSignedUrl(s3Client, putObjectCommand, {
      expiresIn: 60,
    });

    // Upload the PDF using the signed URL
    await axios.put(signedUrl, pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
      },
    });

    // Return the public URL of the uploaded file
    const invoiceUrl = signedUrl.split("?")[0];
    return { invoiceUrl };
    //perform upload to signedurl
  } catch (error) {
    console.error(error);
    throw new Error("Error generating and uploading invoice");
  }
};

type Orders = {
  totalAmount: string;
  orderStatus: OrderStatus;
};

export const calculateTotals = (orders: Orders[]) => {
  const subtotal = orders
    ?.filter((o) => o?.orderStatus !== "CANCELLED")
    ?.reduce((acc, order) => acc + parseFloat(order?.totalAmount), 0);

  const sgst = subtotal * 0.025;
  const cgst = subtotal * 0.025;
  const total = subtotal + sgst + cgst;
  const roundedTotal = Math.floor(total); // Rounded down total
  const roundedDifference = parseFloat((total - roundedTotal).toFixed(2)); // Difference between total and roundedTotal

  return { subtotal, sgst, cgst, total, roundedTotal, roundedDifference };
};
