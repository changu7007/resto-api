import { Request, Response } from "express";
import { getOrderSessionById, getOutletById } from "../../../../lib/outlet";
import { NotFoundException } from "../../../../exceptions/not-found";
import { ErrorCode } from "../../../../exceptions/root";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { BadRequestsException } from "../../../../exceptions/bad-request";
import { prismaDB } from "../../../..";
import { redis } from "../../../../services/redis";
import { websocketManager } from "../../../../services/ws";
import fs from "fs/promises";
import path from "path";
import ejs from "ejs";
import puppeteer from "puppeteer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import axios from "axios";
import { PUPPETEER_EXECUTABLE_PATH } from "../../../../secrets";
import { billQueueProducer } from "../../../../services/bullmq/producer";
import { z } from "zod";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Define the split payment type
interface SplitPayments {
  method: string;
  amount: number;
}

const splitPaymentSchema = z
  .object({
    subTotal: z.number({
      required_error: "Subtotal is required",
    }),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    cashRegisterId: z.string({
      required_error: "Cash register ID is required / Cash Register Not Opened",
    }),
    isSplitPayment: z.boolean().optional(),
    splitPayments: z
      .array(
        z.object({
          method: z.nativeEnum(PaymentMethod),
          amount: z.number(),
        })
      )
      .optional(),
    discount: z.coerce.number().optional(),
    discountAmount: z.coerce.number().optional(),
    receivedAmount: z.coerce.number().optional(),
  })
  .refine(
    (data) => {
      // If it's not a split payment, paymentMethod is required
      if (!data.isSplitPayment && !data.paymentMethod) {
        return false;
      }
      // If it is a split payment, splitPayments is required
      if (
        data.isSplitPayment &&
        (!data.splitPayments || data.splitPayments.length === 0)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "Either paymentMethod (for single payment) or splitPayments (for split payment) must be provided",
      path: ["paymentMethod"], // This will show the error on the paymentMethod field
    }
  );

export const billingOrderSession = async (req: Request, res: Response) => {
  const { orderSessionId, outletId } = req.params;
  // @ts-ignore
  const { id, role } = req.user;

  const { data, error } = splitPaymentSchema.safeParse(req.body);

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const {
    subTotal,
    paymentMethod,
    cashRegisterId,
    isSplitPayment,
    splitPayments,
    discount,
    discountAmount,
    receivedAmount,
  } = data;

  // Validate the request based on whether it's a split payment or not
  if (isSplitPayment) {
    // Validate split payments
    if (!Array.isArray(splitPayments) || splitPayments.length === 0) {
      throw new BadRequestsException(
        "Split payments are required for split payment mode",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    // Validate each split payment
    for (const payment of splitPayments) {
      if (
        !payment.method ||
        !Object.values(PaymentMethod).includes(payment.method)
      ) {
        throw new BadRequestsException(
          "Invalid payment method in split payments",
          ErrorCode.UNPROCESSABLE_ENTITY
        );
      }

      if (typeof payment.amount !== "number" || payment.amount <= 0) {
        throw new BadRequestsException(
          "Invalid amount in split payments",
          ErrorCode.UNPROCESSABLE_ENTITY
        );
      }
    }

    // Validate total amount matches subTotal
    const totalPaid = splitPayments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );
    if (Math.abs(totalPaid - subTotal) > 0.01) {
      throw new BadRequestsException(
        "Total split payment amount must equal the bill total",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  } else {
    // Regular payment validation
    if (
      typeof subTotal !== "number" ||
      !Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)
    ) {
      throw new BadRequestsException(
        "Invalid total or Choose Payment method",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  }

  if (!cashRegisterId) {
    throw new BadRequestsException(
      "Cash Register ID Not Found",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const orderSession = await getOrderSessionById(outlet?.id, orderSessionId);

  if (!orderSession?.id) {
    throw new NotFoundException("Order Session not Found", ErrorCode.NOT_FOUND);
  }

  if (orderSession?.sessionStatus === "COMPLETED") {
    throw new BadRequestsException(
      "Payment and Bill Already Completed",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }

  const cashRegister = await prismaDB.cashRegister.findFirst({
    where: {
      id: cashRegisterId,
      restaurantId: outlet.id,
      status: "OPEN",
    },
  });

  if (!cashRegister?.id) {
    throw new BadRequestsException(
      "Cash Register Not Found",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }

  const result = await prismaDB?.$transaction(async (prisma) => {
    const updatedOrderSession = await prismaDB.orderSession.update({
      where: {
        id: orderSession.id,
        restaurantId: outlet.id,
      },
      data: {
        active: false,
        isPaid: true,
        paymentMethod: isSplitPayment ? "SPLIT" : paymentMethod,
        subTotal: subTotal,
        discount: discount,
        discountAmount: discountAmount,
        isSplitPayment: isSplitPayment,
        splitPayments:
          isSplitPayment && splitPayments
            ? {
                create: splitPayments.map((payment) => ({
                  method: payment.method,
                  amount: payment.amount,
                })),
              }
            : undefined,
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

    if (updatedOrderSession.orderType === "DINEIN") {
      const table = await prisma.table.findFirst({
        where: {
          restaurantId: outlet.id,
          currentOrderSessionId: orderSession.id,
        },
      });

      if (!table) {
        throw new BadRequestsException(
          "Could not find the table bill you are looking for",
          ErrorCode.INTERNAL_EXCEPTION
        );
      }

      await prisma.table.update({
        where: {
          id: table.id,
          restaurantId: outlet.id,
        },
        data: {
          occupied: false,
          currentOrderSessionId: null,
          customerId: null,
        },
      });
    }

    // Create cash transactions for the order
    if (isSplitPayment && splitPayments) {
      // Create multiple transactions for split payments
      for (const payment of splitPayments) {
        await prismaDB.cashTransaction.create({
          data: {
            registerId: cashRegister?.id,
            amount: payment.amount,
            type: "CASH_IN",
            source: "ORDER",
            description: `Split Payment - ${payment.method} - #${
              orderSession.billId
            } - ${orderSession.orderType} - ${
              updatedOrderSession?.orders?.filter(
                (order) => order?.orderStatus === "COMPLETED"
              ).length
            } x Items`,
            paymentMethod: payment.method as PaymentMethod,
            performedBy: id,
          },
        });
      }
    } else {
      // Create a single transaction for regular payment
      await prismaDB.cashTransaction.create({
        data: {
          registerId: cashRegister?.id,
          amount: paymentMethod === "CASH" ? receivedAmount! : subTotal,
          type: "CASH_IN",
          source: "ORDER",
          description: `Order Sales - #${orderSession.billId} - ${
            orderSession.orderType
          } - ${
            updatedOrderSession?.orders?.filter(
              (order) => order?.orderStatus === "COMPLETED"
            ).length
          } x Items`,
          paymentMethod: paymentMethod as PaymentMethod,
          performedBy: id,
        },
      });
    }

    return updatedOrderSession;
  });

  const formattedOrders = result?.orders?.map((order) => ({
    totalAmount: order?.totalAmount,
    gstPrice: order?.gstPrice!,
    totalNetPrice: order?.totalNetPrice!,
    orderStatus: order?.orderStatus,
  }));

  const { cgst, roundedDifference, roundedTotal, sgst, subtotal } =
    calculateTotals(formattedOrders);

  // Parse split payment details if available
  let parsedSplitPayments = [];
  if (result.isSplitPayment && (result as any).splitPaymentDetails) {
    try {
      parsedSplitPayments = JSON.parse((result as any).splitPaymentDetails);
    } catch (error) {
      console.error("Error parsing split payment details:", error);
    }
  }

  const invoiceData = {
    restaurantName: outlet.restaurantName,
    address: `${outlet.address},${outlet.city}-${outlet.pincode}`,
    gst: outlet.GSTIN,
    invoiceNo: result?.billId,
    fssai: outlet.GSTIN,
    invoiceDate: new Date().toLocaleTimeString(),
    customerName: result?.username,
    customerNo: result?.phoneNo ?? "NA",
    paymentMethod: isSplitPayment ? "SPLIT" : paymentMethod,
    isSplitPayment: result.isSplitPayment,
    splitPayments: parsedSplitPayments,
    customerAddress: "NA",
    orderSessionId: result?.id,
    orderItems: result?.orders
      ?.filter((order) => order?.orderStatus === "COMPLETED")
      .flatMap((orderItem) =>
        orderItem.orderItems.map((item, idx) => ({
          id: idx + 1,
          name: item.menuItem.name,
          quantity: item.quantity,
          price: item.originalRate,
          totalPrice: item.totalPrice,
        }))
      ),
    discount: 0,
    subtotal: subtotal,
    sgst: sgst,
    cgst: cgst,
    rounded: roundedDifference,
    total: roundedTotal,
  };

  billQueueProducer.addJob(
    {
      invoiceData,
      outletId: outlet.id,
      phoneNumber: result?.phoneNo ?? undefined,
      whatsappData: {
        billId: result?.billId!,
        items: invoiceData.orderItems.map((item) => ({
          id: item.id.toString(),
          name: item.name,
          quantity: item.quantity,
          price: item.price!,
        })),
        subtotal: invoiceData.subtotal,
        tax: invoiceData.sgst + invoiceData.cgst,
        discount: 0,
        totalAmount: invoiceData.total,
        paymentStatus: "PAID",
        restaurantName: outlet?.restaurantName!,
        orderType: orderSession?.orderType,
        isSplitPayment: invoiceData.isSplitPayment,
        splitPayments: invoiceData.splitPayments,
      },
      ownerPhone: outlet?.users?.phoneNo!,
      paymentData: {
        amount: invoiceData.total,
        billId: result?.billId!,
        paymentMode: isSplitPayment ? "SPLIT" : paymentMethod,
        isSplitPayment: invoiceData.isSplitPayment,
        splitPayments: invoiceData.splitPayments,
      },
    },
    `bill-${result.id}`
  );

  await Promise.all([
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
    redis.del(`all-order-staff-${outletId}`),
  ]);

  // if (outlet?.fcmToken) {
  //   await NotificationService.sendNotification(
  //     outlet?.fcmToken!,
  //     "Bill Recieved",
  //     `${subTotal}`
  //   );
  // }
  await redis.publish("orderUpdated", JSON.stringify({ outletId }));
  websocketManager.notifyClients(outlet?.id, "BILL_UPDATED");

  return res.json({
    success: true,
    message: "Bill Recieved & Saved Success ✅",
  });
};

export const generatePdfInvoiceInBackground = async (
  invoiceData: any,
  outletId: string
) => {
  try {
    const { invoiceUrl } = await generatePdfInvoice(invoiceData);

    // Update the database with the generated invoice URL
    await prismaDB.orderSession.update({
      where: {
        id: invoiceData.orderSessionId,
      },
      data: {
        invoiceUrl,
      },
    });

    console.log("Invoice Generated");
    // Notify WebSocket clients about the updated invoice
    // websocketManager.notifyClients(invoiceData.restaurantName, "INVOICE_GENERATED");
  } catch (error) {
    console.error("Error generating PDF in background:", error);
  }
};

export const generatePdfInvoice = async (invoiceData: any) => {
  // Read the EJS template
  const isDevelopment = process.env.NODE_ENV === "development";
  const templatePath = path.join(process.cwd(), "templates/invoice.ejs");
  const template = await fs.readFile(templatePath, "utf-8");

  try {
    const renderedHtml = await ejs.renderFile(templatePath, {
      invoiceData,
    });

    // Configure Puppeteer based on environment
    const puppeteerConfig = isDevelopment
      ? {
          // Development (Windows) configuration
          headless: "new", // Use new headless mode
          product: "chrome",
        }
      : {
          // Production (Linux) configuration
          headless: true,
          executablePath: PUPPETEER_EXECUTABLE_PATH,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        };

    const browser = await puppeteer.launch(puppeteerConfig as any);

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
  totalAmount: number;
  gstPrice: number;
  totalNetPrice: number;
  orderStatus: OrderStatus;
};

export const calculateTotals = (orders: Orders[]) => {
  const subtotal = orders
    ?.filter((o) => o?.orderStatus !== "CANCELLED")
    ?.reduce((acc, order) => acc + order?.totalNetPrice, 0);
  const gstPrice = orders
    ?.filter((o) => o?.orderStatus !== "CANCELLED")
    ?.reduce((acc, order) => acc + order?.gstPrice, 0);
  const sgst = gstPrice / 2;
  const cgst = gstPrice / 2;
  const total = parseFloat((subtotal + gstPrice).toFixed(2));
  const roundedTotal = Math.floor(total); // Rounded down total
  const roundedDifference = parseFloat((total - roundedTotal).toFixed(2)); // Difference between total and roundedTotal

  return { subtotal, sgst, cgst, total, roundedTotal, roundedDifference };
};

// export const calculateTotals = (orders: Orders[]) => {
//   const subtotal = orders
//     ?.filter((o) => o?.orderStatus !== "CANCELLED")
//     ?.reduce((acc, order) => acc + parseFloat(order?.totalAmount), 0);

//   const sgst = subtotal * 0.025;
//   const cgst = subtotal * 0.025;
//   const total = subtotal + sgst + cgst;
//   const roundedTotal = Math.floor(total); // Rounded down total
//   const roundedDifference = parseFloat((total - roundedTotal).toFixed(2)); // Difference between total and roundedTotal

//   return { subtotal, sgst, cgst, total, roundedTotal, roundedDifference };
// };

export interface CartItems {
  menuId: string;
  quantity: number;
  originalPrice: number;
  price: number;
  sizeVariantsId: string | null;
  addOnSelected: {
    id: string | undefined;
    selectedVariantsId: {
      id: string;
    }[];
  }[];
}

export const calculateTotalsForTakewayAndDelivery = (orders: CartItems[]) => {
  const subtotal = orders?.reduce((acc, order) => acc + order?.price, 0);
  const sgst = subtotal * 0.025;
  const cgst = subtotal * 0.025;
  const total = subtotal + sgst + cgst;
  const tax = cgst + sgst;
  const roundedTotal = Math.floor(total); // Rounded down total
  const roundedDifference = parseFloat((total - roundedTotal).toFixed(2)); // Difference between total and roundedTotal

  return { subtotal, sgst, cgst, total, tax, roundedTotal, roundedDifference };
};
