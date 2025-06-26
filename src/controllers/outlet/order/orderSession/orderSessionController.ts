import { Request, Response } from "express";
import { getOrderSessionById, getOutletById } from "../../../../lib/outlet";
import { NotFoundException } from "../../../../exceptions/not-found";
import { ErrorCode } from "../../../../exceptions/root";
import {
  CashRegister,
  OrderStatus,
  PaymentMethod,
  PaymentMode,
  Platform,
} from "@prisma/client";
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
import { FoodMenu } from "../../items/itemsController";

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
    cashRegisterId: z
      .string({
        message: "Cash Register not opened, please open to complete the bill",
      })
      .optional(),
    paymentId: z.string().optional(),
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
    loyaltyRedeemDiscount: z.coerce.number().optional(),
    platform: z.nativeEnum(Platform, { message: "Platform is Required" }),
    paymentMode: z.nativeEnum(PaymentMode).optional(),
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
  )
  .refine(
    (data) => {
      // Validate cashRegisterId only when platform is POS or ADMIN
      if (
        (data.platform === "POS" || data.platform === "ADMIN") &&
        !data.cashRegisterId
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Cash register ID is required / Cash Register Not Opened",
      path: ["cashRegisterId"],
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
    loyaltyRedeemDiscount,
    splitPayments,
    discount,
    discountAmount,
    receivedAmount,
    platform,
    paymentMode,
    paymentId,
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

  if (!cashRegisterId && (platform === "POS" || platform === "ADMIN")) {
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

  let cashRegister: CashRegister | null;

  if (platform === "ADMIN" || platform === "POS") {
    cashRegister = await prismaDB.cashRegister.findFirst({
      where: {
        id: cashRegisterId,
        restaurantId: outlet.id,
        status: "OPEN",
      },
    });
  }

  const result = await prismaDB?.$transaction(async (prisma) => {
    const updatedOrderSession = await prismaDB.orderSession.update({
      where: {
        id: orderSession.id,
        restaurantId: outlet.id,
      },
      data: {
        active: platform == "ONLINE" ? true : false,
        isPaid: true,
        paymentMethod: isSplitPayment ? "SPLIT" : paymentMethod,
        paymentMode: paymentMode,
        transactionId: paymentId,
        subTotal: subTotal,
        discount: discount,
        loyaltRedeemPoints: loyaltyRedeemDiscount,
        discountAmount: discountAmount,
        isSplitPayment: isSplitPayment,
        amountReceived: receivedAmount,
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
              orderStatus: {
                in: ["SERVED", "INCOMMING", "PREPARING", "FOODREADY"],
              },
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

    if (platform === "ADMIN" || platform === "POS") {
      if (!cashRegister?.id) {
        throw new BadRequestsException(
          "Cash Register Not Found",
          ErrorCode.INTERNAL_EXCEPTION
        );
      }
      if (isSplitPayment && splitPayments) {
        // Create multiple transactions for split payments
        for (const payment of splitPayments) {
          await prismaDB.cashTransaction.create({
            data: {
              registerId: cashRegister?.id,
              amount: payment.amount,
              type: "CASH_IN",
              source: "ORDER",
              orderId: orderSession?.id,
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
            orderId: orderSession?.id,
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
    }

    // Get all orders in this order session
    const orders = await prisma.order.findMany({
      where: {
        orderSessionId: orderSession.id,
        restaurantId: outlet.id,
      },
      select: {
        id: true,
      },
    });

    // Delete all alerts linked to any order in this order session
    if (orders.length > 0) {
      const orderIds = orders.map((order) => order.id);
      await prisma.alert.deleteMany({
        where: {
          restaurantId: outlet.id,
          orderId: {
            in: orderIds,
          },
          status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
        },
      });
    }

    if (orderSession?.customerId) {
      const getCustomerLoyalty = await prismaDB.customerLoyalty.findFirst({
        where: {
          restaurantCustomerId: orderSession?.customerId,
        },
        include: {
          loyaltyProgram: true,
          currentTier: true,
        },
      });

      if (getCustomerLoyalty) {
        const { loyaltyProgram, currentTier } = getCustomerLoyalty;
        let pointsToAdd = 0;
        let visitsToAdd = 0;
        let cashbackAmount = 0;

        // Calculate rewards based on program type
        switch (loyaltyProgram.loyaltyProgramType) {
          case "POINT_BASED":
            if (loyaltyProgram.pointsRatio) {
              pointsToAdd = subTotal / loyaltyProgram.pointsRatio;
            }
            break;
          case "VISIT_BASED":
            visitsToAdd = 1;
            break;
          case "SPEND_BASED_TIERS":
            // Update tier based on lifetime spend
            const newLifetimeSpend =
              getCustomerLoyalty.lifeTimeSpend + subTotal;
            const nextTier = await prismaDB.tier.findFirst({
              where: {
                programId: loyaltyProgram.id,
                threshold: {
                  lte: newLifetimeSpend,
                },
              },
              orderBy: {
                threshold: "desc",
              },
            });
            if (
              nextTier &&
              (!currentTier || nextTier.threshold > currentTier.threshold)
            ) {
              await prismaDB.customerLoyalty.update({
                where: { id: getCustomerLoyalty.id },
                data: { currentTierId: nextTier.id },
              });
            }
            break;
          case "CASHBACK_WALLET_BASED":
            if (
              loyaltyProgram.cashBackPercentage &&
              loyaltyProgram.minSpendForCashback &&
              subTotal >= loyaltyProgram.minSpendForCashback
            ) {
              cashbackAmount =
                subTotal * (loyaltyProgram.cashBackPercentage / 100);
            }
            break;
        }

        // Update customer loyalty data
        const updated = await prismaDB.customerLoyalty.update({
          where: { id: getCustomerLoyalty.id },
          data: {
            points: { increment: pointsToAdd },
            visits: { increment: visitsToAdd },
            walletBalance: { increment: cashbackAmount },
            lifeTimePoints: { increment: pointsToAdd },
            lifeTimeSpend: { increment: subTotal },
            lastVisitDate: new Date(),
          },
        });

        console.log(`Updated loyalty ${updated}`);

        // Create loyalty transaction records
        if (pointsToAdd > 0) {
          await prismaDB.loyaltyTransaction.create({
            data: {
              restaurantId: outlet.id,
              restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
              programId: loyaltyProgram.id,
              type: "POINTS_EARNED",
              points: pointsToAdd,
              description: `Points earned from order #${orderSession.billId}`,
            },
          });
        }

        if (visitsToAdd > 0) {
          await prismaDB.loyaltyTransaction.create({
            data: {
              restaurantId: outlet.id,
              restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
              programId: loyaltyProgram.id,
              type: "VISIT_RECORDED",
              visits: visitsToAdd,
              description: `Visit recorded for order #${orderSession.billId}`,
            },
          });
        }

        if (cashbackAmount > 0) {
          await prismaDB.loyaltyTransaction.create({
            data: {
              restaurantId: outlet.id,
              restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
              programId: loyaltyProgram.id,
              type: "CASHBACK_EARNED",
              amount: cashbackAmount,
              description: `Cashback earned from order #${orderSession.billId}`,
            },
          });
        }

        if (loyaltyRedeemDiscount) {
          await prismaDB.customerLoyalty.update({
            where: { id: getCustomerLoyalty.id },
            data: {
              points: { decrement: loyaltyRedeemDiscount },
            },
          });
          await prismaDB.loyaltyTransaction.create({
            data: {
              restaurantId: outlet.id,
              restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
              programId: loyaltyProgram.id,
              type: "POINTS_REDEEMED",
              points: loyaltyRedeemDiscount,
              description: `Points redeemed from order #${orderSession.billId}`,
            },
          });
        }
      }
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

export const completebillingOrderSession = async (
  req: Request,
  res: Response
) => {
  const { orderSessionId, outletId } = req.params;
  // @ts-ignore
  const { id, role } = req.user;

  const { cashRegisterId } = req.body;

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

  if (
    orderSession?.platform == "ONLINE" ||
    orderSession?.platform === "SWIGGY" ||
    orderSession?.platform === "ZOMATO"
  ) {
    if (!cashRegisterId) {
      throw new BadRequestsException(
        "Cash Register ID Not Found",
        ErrorCode.INTERNAL_EXCEPTION
      );
    }
  }

  let cashRegister: CashRegister | null;

  if (
    orderSession?.platform == "ONLINE" ||
    orderSession?.platform === "SWIGGY" ||
    orderSession?.platform === "ZOMATO"
  ) {
    cashRegister = await prismaDB.cashRegister.findFirst({
      where: {
        id: cashRegisterId,
        restaurantId: outlet.id,
        status: "OPEN",
      },
    });
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
        sessionStatus: "COMPLETED",
        orders: {
          updateMany: {
            where: {
              orderStatus: {
                in: ["SERVED", "INCOMMING", "PREPARING", "FOODREADY", "ONHOLD"],
              },
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

    // Create a single transaction for regular payment
    if (
      orderSession?.platform == "ONLINE" ||
      orderSession?.platform === "SWIGGY" ||
      orderSession?.platform === "ZOMATO"
    ) {
      if (!cashRegister?.id) {
        throw new BadRequestsException(
          "Cash Register Not Found",
          ErrorCode.INTERNAL_EXCEPTION
        );
      }
      await prismaDB.cashTransaction.create({
        data: {
          registerId: cashRegister?.id,
          amount:
            orderSession?.paymentMethod === "CASH"
              ? orderSession?.amountReceived!
              : orderSession?.subTotal!,
          type: "CASH_IN",
          source: "ORDER",
          orderId: orderSession?.id,
          description: `Order Sales - #${orderSession.billId} - ${
            orderSession.orderType
          } - ${
            updatedOrderSession?.orders?.filter(
              (order) => order?.orderStatus === "COMPLETED"
            ).length
          } x Items`,
          paymentMethod: orderSession?.paymentMethod as PaymentMethod,
          performedBy: id,
        },
      });
    }

    // Get all orders in this order session
    const orders = await prisma.order.findMany({
      where: {
        orderSessionId: orderSession.id,
        restaurantId: outlet.id,
      },
      select: {
        id: true,
      },
    });

    // Delete all alerts linked to any order in this order session
    if (orders.length > 0) {
      const orderIds = orders.map((order) => order.id);
      await prisma.alert.deleteMany({
        where: {
          restaurantId: outlet.id,
          orderId: {
            in: orderIds,
          },
          status: { in: ["PENDING", "ACKNOWLEDGED"] }, // Only resolve pending alerts
        },
      });
    }

    if (orderSession?.customerId) {
      const getCustomerLoyalty = await prismaDB.customerLoyalty.findFirst({
        where: {
          restaurantCustomerId: orderSession?.customerId,
        },
        include: {
          loyaltyProgram: true,
          currentTier: true,
        },
      });

      if (getCustomerLoyalty) {
        const { loyaltyProgram, currentTier } = getCustomerLoyalty;
        let pointsToAdd = 0;
        let visitsToAdd = 0;
        let cashbackAmount = 0;

        // Calculate rewards based on program type
        switch (loyaltyProgram.loyaltyProgramType) {
          case "POINT_BASED":
            if (loyaltyProgram.pointsRatio) {
              pointsToAdd =
                Number(orderSession?.subTotal) / loyaltyProgram.pointsRatio;
            }
            break;
          case "VISIT_BASED":
            visitsToAdd = 1;
            break;
          case "SPEND_BASED_TIERS":
            // Update tier based on lifetime spend
            const newLifetimeSpend =
              getCustomerLoyalty.lifeTimeSpend + Number(orderSession?.subTotal);
            const nextTier = await prismaDB.tier.findFirst({
              where: {
                programId: loyaltyProgram.id,
                threshold: {
                  lte: newLifetimeSpend,
                },
              },
              orderBy: {
                threshold: "desc",
              },
            });
            if (
              nextTier &&
              (!currentTier || nextTier.threshold > currentTier.threshold)
            ) {
              await prismaDB.customerLoyalty.update({
                where: { id: getCustomerLoyalty.id },
                data: { currentTierId: nextTier.id },
              });
            }
            break;
          case "CASHBACK_WALLET_BASED":
            if (
              loyaltyProgram.cashBackPercentage &&
              loyaltyProgram.minSpendForCashback &&
              Number(orderSession?.subTotal) >=
                loyaltyProgram.minSpendForCashback
            ) {
              cashbackAmount =
                Number(orderSession?.subTotal) *
                (loyaltyProgram.cashBackPercentage / 100);
            }
            break;
        }

        // Update customer loyalty data
        const updated = await prismaDB.customerLoyalty.update({
          where: { id: getCustomerLoyalty.id },
          data: {
            points: { increment: pointsToAdd },
            visits: { increment: visitsToAdd },
            walletBalance: { increment: cashbackAmount },
            lifeTimePoints: { increment: pointsToAdd },
            lifeTimeSpend: { increment: Number(orderSession?.subTotal) },
            lastVisitDate: new Date(),
          },
        });

        console.log(`Updated loyalty ${updated}`);

        // Create loyalty transaction records
        if (pointsToAdd > 0) {
          await prismaDB.loyaltyTransaction.create({
            data: {
              restaurantId: outlet.id,
              restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
              programId: loyaltyProgram.id,
              type: "POINTS_EARNED",
              points: pointsToAdd,
              description: `Points earned from order #${orderSession.billId}`,
            },
          });
        }

        if (visitsToAdd > 0) {
          await prismaDB.loyaltyTransaction.create({
            data: {
              restaurantId: outlet.id,
              restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
              programId: loyaltyProgram.id,
              type: "VISIT_RECORDED",
              visits: visitsToAdd,
              description: `Visit recorded for order #${orderSession.billId}`,
            },
          });
        }

        if (cashbackAmount > 0) {
          await prismaDB.loyaltyTransaction.create({
            data: {
              restaurantId: outlet.id,
              restaurantCustomerId: getCustomerLoyalty.restaurantCustomerId,
              programId: loyaltyProgram.id,
              type: "CASHBACK_EARNED",
              amount: cashbackAmount,
              description: `Cashback earned from order #${orderSession.billId}`,
            },
          });
        }
      }
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
    paymentMethod: orderSession?.isSplitPayment
      ? "SPLIT"
      : orderSession?.paymentMethod,
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
        paymentMode: orderSession?.isSplitPayment
          ? "SPLIT"
          : orderSession?.paymentMethod,
        isSplitPayment: invoiceData.isSplitPayment,
        splitPayments: invoiceData.splitPayments,
      },
    },
    `bill-${result.id}`
  );

  await Promise.all([
    redis.del(`active-os-${outletId}`),
    redis.del(`liv-online-${outletId}`),
    redis.del(`liv-o-${outletId}`),
    redis.del(`tables-${outletId}`),
    redis.del(`a-${outletId}`),
    redis.del(`o-n-${outletId}`),
    redis.del(`${outletId}-stocks`),
    redis.del(`all-order-staff-${outletId}`),
  ]);

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

export const assignCustomerToOrder = async (req: Request, res: Response) => {
  const { outletId, orderSessionId } = req.params;

  const { customerId } = req.body;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const orderSession = await getOrderSessionById(outlet?.id, orderSessionId);

  const getCustomer = await prismaDB.customerRestaurantAccess.findFirst({
    where: {
      restaurantId: outletId,
      customerId: customerId,
    },
    select: {
      id: true,
      customer: {
        select: {
          id: true,
          name: true,
          phoneNo: true,
        },
      },
    },
  });

  if (!getCustomer) {
    throw new BadRequestsException(
      "Customer Not Found",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }

  if (!orderSession?.id) {
    throw new NotFoundException("Order Session not Found", ErrorCode.NOT_FOUND);
  }

  if (orderSession?.customerId) {
    throw new BadRequestsException(
      "Customer Already Assigned to Order",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }

  await prismaDB.orderSession.update({
    where: { id: orderSessionId, restaurantId: outletId },
    data: {
      username: getCustomer?.customer?.name,
      phoneNo: getCustomer?.customer?.phoneNo,
      customerId: getCustomer?.id,
    },
  });

  await redis.del(`active-os-${outletId}`);
  await redis.del(`liv-o-${outletId}`);
  await redis.del(`tables-${outletId}`);
  await redis.del(`a-${outletId}`);
  await redis.del(`o-n-${outletId}`);
  await redis.del(`${outletId}-stocks`);
  await redis.del(`all-order-staff-${outletId}`);

  return res.json({
    success: true,
    message: "Customer Assigned to Order Successfully",
  });
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
  id: string;
  menuId: string;
  menuItem: FoodMenu;
  quantity: number;
  originalPrice: number;
  price: number;
  netPrice: number;
  gst: number;
  grossProfit: number;
  sizeVariantsId: string | null;
  addOnSelected: {
    id: string | undefined;
    selectedVariantsId: {
      id: string;
    }[];
  }[];
}

export const calculateTotalsForTakewayAndDelivery = (
  orders: CartItems[],
  deliveryFee: number,
  packingFee: number,
  orderType: string
) => {
  const subtotal = orders?.reduce((acc, order) => acc + order?.price, 0);
  const sgst = subtotal * orders?.reduce((acc, order) => acc + order?.gst, 0);
  const cgst = subtotal * orders?.reduce((acc, order) => acc + order?.gst, 0);
  const total = subtotal + sgst + cgst;
  const tax = cgst + sgst;
  const restaurantCharges =
    orderType === "DELIVERY"
      ? deliveryFee + packingFee
      : orderType === "TAKEAWAY"
      ? packingFee
      : 0;
  const roundedTotal = Math.floor(total + restaurantCharges); // Rounded down total
  const roundedDifference = parseFloat((total - roundedTotal).toFixed(2)); // Difference between total and roundedTotal

  return {
    subtotal,
    sgst,
    cgst,
    total,
    tax,
    deliveryFee,
    packingFee,
    roundedTotal,
    roundedDifference,
  };
};
