import { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { NotFoundException } from "../../../exceptions/not-found";
import {
  ENCRYPT_KEY,
  ENV,
  PHONE_PE_CLIENT_ID,
  PHONE_PE_CLIENT_SECRET,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
} from "../../../secrets";
import { getOutletById } from "../../../lib/outlet";
import { UnauthorizedException } from "../../../exceptions/unauthorized";
import { getFormatUserAndSendToRedis } from "../../../lib/get-users";
import { PhonePeService } from "../../../services/phonepe/phonepe-service";

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

export const API =
  ENV === "production"
    ? "https://api.restobytes.in/api"
    : "http://localhost:8080/api";
const FRONTEND =
  ENV === "production" ? "https://app.restobytes.in" : "http://localhost:4000";

const phonePeService = PhonePeService.getInstance();

export async function CreateRazorPayOrder(req: Request, res: Response) {
  const { amount } = req.body;
  const order = await razorpay.orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: "receipt_" + Math.random().toString(36).substring(7),
  });

  return res.json({
    success: true,
    orderId: order.id,
  });
}

export async function createPhonePeOrder(req: Request, res: Response) {
  try {
    const { amount, subscriptionId } = req.body;
    // @ts-ignore
    const userId = req.user.id;

    if (!amount) {
      throw new NotFoundException(
        "Amount is Required",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    if (!subscriptionId) {
      throw new NotFoundException(
        "Subscription ID is Required",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    console.log("Creating PhonePe order with params:", {
      amount,
      subscriptionId,
      userId,
    });

    // Use global PhonePe client for subscription payments
    const phonePeClient = phonePeService.getGlobalClient();
    const merchantOrderId = phonePeClient.generatePhonePeOrderId("SUB");
    const redirectUrl = `${API}/onboarding/check-status?merchantOrderId=${merchantOrderId}&subId=${subscriptionId}&userId=${userId}`;

    const paymentResponse = await phonePeClient.createPayment({
      merchantOrderId,
      amount,
      redirectUrl,
      userId,
      metadata: { subscriptionId, type: "subscription" },
    });

    console.log("PhonePe payment response:", paymentResponse);

    if (!paymentResponse.success) {
      console.error("PhonePe payment creation failed:", {
        error: paymentResponse.error,
        errorCode: paymentResponse.errorCode,
        merchantOrderId: paymentResponse.merchantOrderId,
        amount: paymentResponse.amount,
      });

      throw new BadRequestsException(
        paymentResponse.error || "Payment creation failed",
        ErrorCode.INTERNAL_EXCEPTION
      );
    }

    return res.json({
      success: true,
      redirectUrl: paymentResponse.redirectUrl,
      orderId: paymentResponse.orderId,
      amount: paymentResponse.amount,
      merchantOrderId: paymentResponse.merchantOrderId,
      responseData: paymentResponse.responseData,
    });
  } catch (error: any) {
    console.error("createPhonePeOrder error:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
      response: error.response?.data,
    });

    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestsException
    ) {
      throw error;
    }

    throw new BadRequestsException(
      error.message || "Something went wrong in payment processing",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }
}

export async function statusPhonePeCheck(req: Request, res: Response) {
  try {
    const { merchantOrderId, subId, userId } = req.query;

    if (!merchantOrderId) {
      throw new NotFoundException(
        "MerchantOrderId is Missing",
        ErrorCode.UNAUTHORIZED
      );
    }

    const phonePeClient = phonePeService.getGlobalClient();
    const statusResponse = await phonePeClient.getOrderStatus(
      merchantOrderId as string
    );

    if (statusResponse.state === "COMPLETED") {
      if (!subId || !userId) {
        throw new BadRequestsException(
          "Subscription ID or User ID is missing",
          ErrorCode.UNPROCESSABLE_ENTITY
        );
      }

      const findOwner = await prismaDB.user.findFirst({
        where: { id: userId as string },
      });

      if (!findOwner?.id) {
        throw new NotFoundException("User Not Found", ErrorCode.NOT_FOUND);
      }

      const findSubscription = await prismaDB.subsciption.findFirst({
        where: { id: subId as string },
      });

      if (!findSubscription) {
        throw new BadRequestsException(
          "No Subscription Found",
          ErrorCode.NOT_FOUND
        );
      }

      let validDate = new Date();
      const paidAmount = (statusResponse.amount || 0) / 100;

      if (paidAmount === 0) {
        validDate.setDate(validDate.getDate() + 15); // 15 days free trial
      } else if (findSubscription.planType === "MONTHLY") {
        validDate.setMonth(validDate.getMonth() + 1);
      } else if (findSubscription.planType === "ANNUALLY") {
        validDate.setFullYear(validDate.getFullYear() + 1);
      }

      await prismaDB.subscriptionBilling.create({
        data: {
          userId: findOwner.id,
          isSubscription: true,
          paymentId: statusResponse?.orderId || (merchantOrderId as string),
          paidAmount: paidAmount,
          subscribedDate: new Date(),
          planType: findSubscription.planType,
          subscriptionPlan: findSubscription.subscriptionPlan,
          validDate: validDate,
        },
      });

      await getFormatUserAndSendToRedis(findOwner?.id);

      return res.redirect(`${FRONTEND}/thankyou?status=success`);
    } else {
      return res.redirect(`${FRONTEND}/thankyou?status=failure`);
    }
  } catch (error: any) {
    console.error("statusPhonePeCheck error:", error);
    return res.redirect(`${FRONTEND}/thankyou?status=error`);
  }
}

export async function CreateRazorPayOrderForOutlet(
  req: Request,
  res: Response
) {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const outletComission = outlet?.comission / 100;

  const { amount } = req.body;
  const comission = amount * outletComission;
  console.log("Outlet Comission", outlet?.comission);
  console.log("Comission", comission);

  const order = await razorpay.orders.create({
    amount: amount * 100,
    currency: "INR",
    receipt: "receipt_" + Math.random().toString(36).substring(7),
    transfers: [
      {
        account: outlet?.razorpayInfo?.acc_id!,
        amount: (amount - comission) * 100,
        currency: "INR",
        on_hold: 0,
      },
    ],
  });

  return res.json({
    success: true,
    orderId: order.id,
  });
}

// export async function CreateRazorPaySubscriptionForOutlet(
//   req: Request,
//   res: Response
// ) {
//   const { outletId } = req.params;

//   // @ts-ignore
//   const userId = req.user.id;

//   const {razorpayPlanId,id}=req.body;

//   if(!razorpayPlanId || !id) {
//     throw new NotFoundException("Please select your plan",ErrorCode.NOT_FOUND)
//   }

//   const outlet = await getOutletById(outletId);

//   if (!outlet?.id) {
//     throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
//   }

//   if (outlet.adminId !== userId) {
//     throw new NotFoundException(
//       "Only Restaurant Owner/manager Can Subscribe",
//       ErrorCode.UNAUTHORIZED
//     );
//   }

//   const user = await prismaDB.user.findFirst({
//     where: {
//       id: userId,
//     },
//   });

//   if (!user?.id) {
//     throw new NotFoundException("Admin Not Found", ErrorCode.UNAUTHORIZED);
//   }

//   const subs = await razorpay.subscriptions.create({
//     plan_id: razorpayPlanId,
//     customer_notify: 1,
//     quantity: 1,
//     total_count: 12,
//   });

//   const findSubscription = await prismaDB.subsciption.findFirst({
//     where: {
//       id: id,
//     },
//   });

//   if (!findSubscription) {
//     throw new BadRequestsException(
//       "No Subscription Found",
//       ErrorCode.NOT_FOUND
//     );
//   }

//   const userUpdate = await prismaDB.user.update({
//     where:{
//       id: user.id
//     },
//     data:{
//       billings:{
//         create:{
//           isSubscription: false,
//           planType: findSubscription.planType,
//           subscriptionPlan: findSubscription.subscriptionPlan,
//           subscriptionLink: subs?.short_url,
//           subscriptionStatus: subs?.status
//         }
//       }
//     }
//   })

//   return res.json({
//     success: true,
//     shortUrl : subs?.short_url
//   });
// }

export const paymentRazorpayVerification = async (
  req: Request,
  res: Response
) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const body = razorpayOrderId + "|" + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  const isAuthentic = expectedSignature === razorpaySignature;
  if (isAuthentic) {
    console.log(razorpayPaymentId);
    return res.json({ success: true, message: "Payment Successfull" });
  } else {
    return res.json({
      success: false,
      message: "Payment Failed",
    });
  }
};

export const paymentWebhookVerification = async (
  req: Request,
  res: Response
) => {
  const secret = ENCRYPT_KEY;
  const shasum = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(req.body));
  const digest = shasum.digest("hex");

  if (digest === req.headers["x-razorpay-signature"]) {
    console.log("Request is legit");
    return res.json({
      success: true,
      message: "legit",
    });
  } else {
    console.log("Messing");
    return res.json({
      success: false,
      message: "not-legit",
    });
  }
};

export const buyPlan = async (req: Request, res: Response) => {
  const { paymentId, subscriptionId, paidAmount } = req.body;
  // @ts-ignore
  const userId = req.user?.id;
  console.log("Plan", req.body);

  if (!paymentId || !subscriptionId) {
    throw new BadRequestsException(
      "Payment ID not Verfied",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const findOwner = await prismaDB.user.findFirst({
    where: {
      id: userId,
    },
  });

  if (!findOwner?.id) {
    throw new NotFoundException("User Not Found", ErrorCode.NOT_FOUND);
  }

  const findSubscription = await prismaDB.subsciption.findFirst({
    where: {
      id: subscriptionId,
    },
  });

  if (!findSubscription) {
    throw new BadRequestsException(
      "No Subscription Found",
      ErrorCode.NOT_FOUND
    );
  }

  let validDate = new Date();

  if (paymentId === "FREETRIAL" && paidAmount === 0) {
    // Set validDate to 15 days from today for free trial
    validDate.setDate(validDate.getDate() + 15);
  } else if (findSubscription.planType === "MONTHLY") {
    validDate.setMonth(validDate.getMonth() + 1);
  } else if (findSubscription.planType === "ANNUALLY") {
    validDate.setFullYear(validDate.getFullYear() + 1);
  }

  await prismaDB.subscriptionBilling.create({
    data: {
      userId: findOwner.id,
      isSubscription: true,
      paymentId: paymentId,
      paidAmount: paidAmount,
      subscribedDate: new Date(),
      planType: findSubscription.planType,
      subscriptionPlan: findSubscription.subscriptionPlan,
      validDate: validDate,
    },
  });

  await getFormatUserAndSendToRedis(findOwner?.id);

  return res.json({
    success: true,
    message: "Your Subscription is now Active",
  });
};

export const getAllPlans = async (req: Request, res: Response) => {
  const plans = await prismaDB.subsciption.findMany();
  return res.json({
    success: true,
    plans,
  });
};

export const createVendorAccount = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { account_number, ifsc_code } = req.body;
  // @ts-ignore
  const userId = req?.user?.id;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  if (outlet?.adminId !== userId) {
    throw new UnauthorizedException(
      "Your Not Authorized",
      ErrorCode.UNAUTHORIZED
    );
  }

  const getOwner = await prismaDB.user.findFirst({
    where: {
      id: userId,
    },
  });

  const razorpayInfo = await prismaDB.razorpayIntegration.findFirst({
    where: {
      restaurantId: outlet?.id,
    },
  });

  let vendor;

  if (!razorpayInfo?.acc_id) {
    // Create Razorpay account if it doesn't exist
    const data = {
      email: getOwner?.email!,
      phone: getOwner?.phoneNo!,
      type: "route",
      reference_id: Math.random().toString(36).substring(7),
      legal_business_name: outlet?.restaurantName!,
      business_type: outlet?.businessType!,
      contact_name: getOwner?.name!,
      profile: {
        category: "food",
        subcategory: "restaurant",
        addresses: {
          registered: {
            street1: outlet?.address!,
            street2: outlet?.address!,
            city: outlet?.city!,
            postal_code: outlet?.pincode!,
            state: outlet?.state!,
            country: outlet?.country!,
          },
        },
      },
      // legal_info: {
      //   pan: getOwner?.pan!,
      //   gst: outlet?.GSTIN!,
      // },
    };

    const response = await razorpay.accounts.create(data);
    // const response = await axios.post(
    //   "https://api.razorpay.com/v2/accounts",
    //   data,
    //   {
    //     auth: {
    //       username: RAZORPAY_KEY_ID, // Replace with your Razorpay Key ID
    //       password: RAZORPAY_KEY_SECRET, // Replace with your Razorpay Secret
    //     },
    //     headers: {
    //       "Content-Type": "application/json",
    //     },
    //   }
    // );
    console.log("Response Vendor", response);
    vendor = { id: response?.id };

    if (vendor?.id) {
      // Store Razorpay account info
      await prismaDB.razorpayIntegration.create({
        data: {
          restaurantId: outlet?.id,
          acc_id: vendor?.id,
        },
      });
    }
  } else {
    const response = await razorpay.accounts.fetch(razorpayInfo?.acc_id);
    console.log("Account", response);
    vendor = { id: razorpayInfo?.acc_id };
  }

  // Create or update stakeholder
  if (vendor?.id) {
    const stakeholder = await razorpay.stakeholders.create(vendor?.id, {
      name: getOwner?.name!,
      email: getOwner?.email!,
      phone: {
        primary: getOwner?.phoneNo!,
      },
      addresses: {
        residential: {
          street: outlet?.address!,
          city: outlet?.city!,
          country: outlet?.country!,
          postal_code: outlet?.pincode!,
          state: outlet?.state!,
        },
      },
      kyc: {
        pan: getOwner?.pan!,
      },
    });

    console.log("Stakeholder created");
    // Update Razorpay integration with stakeholder ID
    await prismaDB.razorpayIntegration.update({
      where: {
        acc_id: vendor?.id,
        restaurantId: outlet?.id,
      },
      data: {
        stakeholderId: stakeholder?.id,
      },
    });
  }

  // Configure product for vendor
  if (vendor?.id) {
    const product = await razorpay.products.requestProductConfiguration(
      vendor.id,
      {
        product_name: "route",
        tnc_accepted: true,
      }
    );

    if (product?.id) {
      await prismaDB.razorpayIntegration.update({
        where: { acc_id: vendor?.id, restaurantId: outlet?.id },
        data: { productId: product.id },
      });

      const beneficaryName =
        outlet?.businessType === "individual" ||
        outlet?.businessType === "propreitorship"
          ? getOwner?.name!
          : outlet?.restaurantName!;

      const up = await razorpay.products.edit(vendor.id, product.id, {
        settlements: {
          account_number: account_number,
          ifsc_code: ifsc_code,
          beneficiary_name: beneficaryName,
        },
        tnc_accepted: true,
      });

      if (up?.id) {
        await prismaDB.razorpayIntegration.update({
          where: {
            acc_id: vendor?.id,
            restaurantId: outlet?.id,
          },
          data: {
            account_number: account_number,
            ifsc_code: ifsc_code,
            activation_status: up.activation_status,
          },
        });

        const update = await prismaDB.integration.findFirst({
          where: {
            name: "RAZORAPY",
            restaurantId: outlet?.id,
          },
        });

        await prismaDB.integration.update({
          where: {
            id: update?.id,
          },
          data: {
            connected: true,
          },
        });
      }
    }
  }

  return res.json({ success: true });
};

export const fetchBankAccountStatus = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const razorpayInfo = await prismaDB.razorpayIntegration.findFirst({
    where: {
      restaurantId: outlet?.id,
    },
  });

  if (!razorpayInfo?.id || !razorpayInfo?.acc_id || !razorpayInfo?.productId) {
    throw new NotFoundException(
      "You have not Added your Bank Account",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }

  const razorpayAccount = await razorpay.accounts.fetch(razorpayInfo?.acc_id);

  console.log("Linked ACcount", razorpayAccount);

  const razorpayProduct = await razorpay.products.fetch(
    razorpayInfo.acc_id,
    razorpayInfo.productId
  );

  console.log("PRoduct ACcount", razorpayProduct);

  await prismaDB.razorpayIntegration.update({
    where: {
      id: razorpayInfo?.id,
    },
    data: {
      activation_status: razorpayProduct?.activation_status,
    },
  });

  // if (razorpayProduct.activation_status === "under_review") {
  //   if (razorpayAccount.business_type === "partnership") {
  //     await razorpay.products.edit(
  //       razorpayInfo.acc_id,
  //       razorpayInfo?.productId,
  //       {
  //         settlements: {
  //           account_number:
  //             razorpayProduct?.active_configuration?.settlements
  //               ?.account_number,
  //           ifsc_code:
  //             razorpayProduct?.active_configuration?.settlements?.ifsc_code,
  //           beneficiary_name: razorpayAccount?.legal_business_name,
  //         },
  //         tnc_accepted: true,
  //       }
  //     );
  //     console.log("Done updating based on businesstype");
  //   }
  // }

  // if (razorpayProduct.activation_status === "needs_clarification") {
  //   if (razorpayAccount.business_type === "partnership") {
  //     await razorpay.accounts.edit(razorpayInfo?.acc_id, {
  //       type: "individual",
  //     });
  //     await razorpay.products.edit(
  //       razorpayInfo.acc_id,
  //       razorpayInfo?.productId,
  //       {
  //         settlements: {
  //           account_number:
  //             razorpayProduct?.active_configuration?.settlements
  //               ?.account_number,
  //           ifsc_code:
  //             razorpayProduct?.active_configuration?.settlements?.ifsc_code,
  //           beneficiary_name: razorpayAccount?.contact_name,
  //         },
  //         tnc_accepted: true,
  //       }
  //     );
  //     console.log("Done updating based on businesstype");
  //   }
  // }

  return res.json({
    success: true,
    message:
      razorpayProduct.activation_status === "under_review"
        ? "UNDER REVIEW"
        : "ACCOUNT ACTIVATED",
  });
};

// async function createVendorAccount(data) ===???? acc_PQ10D2tzRS6kmh
//   const options = {
//     method: 'POST',
//     url: 'https://api.razorpay.com/v1/partners/contacts',
//     headers: {
//       Authorization: `Basic ${Buffer.from('YOUR_KEY_ID:YOUR_KEY_SECRET').toString('base64')}`,
//       'Content-Type': 'application/json'
//     },
//     data
//   };

//   return axios.request(options);
// }

export const phonePeWebhookHandler = async (req: Request, res: Response) => {
  try {
    const { event, payload } = req.body;
    console.log("PhonePe Webhook Received:", { event, payload });

    // Validate the webhook payload
    if (!event || !payload) {
      console.error("Invalid webhook payload:", req.body);
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload" });
    }

    // Extract authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.error("Missing authorization header");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // TODO: Validate the authorization header with your configured username:password
    // const expectedAuth = crypto.createHash('sha256').update('username:password').digest('hex');
    // if (authHeader !== expectedAuth) {
    //   return res.status(401).json({ success: false, message: "Invalid authorization" });
    // }

    // Handle different webhook events
    switch (event) {
      case "checkout.order.completed":
        if (payload.state === "COMPLETED") {
          // Payment successful
          const { merchantOrderId, amount, metaInfo } = payload;

          // Extract subscription details from metaInfo
          const subscriptionId = metaInfo?.udf4; // Assuming subscriptionId is stored in udf4
          const userId = metaInfo?.udf5; // Assuming userId is stored in udf5

          if (!subscriptionId || !userId) {
            console.error("Missing subscription or user details:", {
              subscriptionId,
              userId,
            });
            return res
              .status(400)
              .json({ success: false, message: "Missing required details" });
          }

          // Find user and subscription
          const findOwner = await prismaDB.user.findFirst({
            where: { id: userId },
          });

          if (!findOwner?.id) {
            console.error("User not found:", userId);
            return res
              .status(404)
              .json({ success: false, message: "User not found" });
          }

          const findSubscription = await prismaDB.subsciption.findFirst({
            where: { id: subscriptionId },
          });

          if (!findSubscription) {
            console.error("Subscription not found:", subscriptionId);
            return res
              .status(404)
              .json({ success: false, message: "Subscription not found" });
          }

          // Calculate validity date
          let validDate = new Date();
          const paidAmount = (amount || 0) / 100;

          if (paidAmount === 0) {
            validDate.setDate(validDate.getDate() + 15); // 15 days free trial
          } else if (findSubscription.planType === "MONTHLY") {
            validDate.setMonth(validDate.getMonth() + 1);
          } else if (findSubscription.planType === "ANNUALLY") {
            validDate.setFullYear(validDate.getFullYear() + 1);
          }

          // Create subscription billing record
          await prismaDB.subscriptionBilling.create({
            data: {
              userId: findOwner.id,
              isSubscription: true,
              paymentId: payload.orderId || merchantOrderId,
              paidAmount: paidAmount,
              subscribedDate: new Date(),
              planType: findSubscription.planType,
              subscriptionPlan: findSubscription.subscriptionPlan,
              validDate: validDate,
            },
          });

          // Update user cache
          await getFormatUserAndSendToRedis(findOwner.id);

          console.log("Subscription activated successfully:", {
            userId,
            subscriptionId,
            merchantOrderId,
            amount: paidAmount,
          });
        }
        break;

      case "checkout.order.failed":
        if (payload.state === "FAILED") {
          const { merchantOrderId, errorCode, detailedErrorCode } = payload;
          console.error("Payment failed:", {
            merchantOrderId,
            errorCode,
            detailedErrorCode,
          });
          // Handle failed payment - you might want to notify the user or update your records
        }
        break;

      default:
        console.log("Unhandled webhook event:", event);
    }

    // Always return 200 to acknowledge receipt of webhook
    return res
      .status(200)
      .json({ success: true, message: "Webhook processed" });
  } catch (error: any) {
    console.error("PhonePe webhook processing error:", {
      message: error.message,
      stack: error.stack,
      body: req.body,
    });
    // Still return 200 to acknowledge receipt, but log the error
    return res
      .status(200)
      .json({ success: false, message: "Error processing webhook" });
  }
};
