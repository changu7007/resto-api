import { Request, Response } from "express";
import { prismaDB } from "../../..";
import { sendToken } from "../../../services/jwt";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import {
  getOutletById,
  getOutletCustomerAndFetchToRedis,
} from "../../../lib/outlet";
import { getCustomerById } from "../../../lib/get-users";
import {
  ACCESS_TOKEN,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
} from "../../../secrets";
import { REFRESH_TOKEN } from "../../../secrets";
import * as jwt from "jsonwebtoken";
import { redis } from "../../../services/redis";
import { WhatsAppService } from "../../../services/whatsapp";
import { TwilioService } from "../../../services/twilio";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phoneNo: string;
  image: string | null;
  role: "CUSTOMER";
  restaurantId: string;
}

const whatsappService = new WhatsAppService({
  accessToken: process.env.META_ACCESS_TOKEN!,
  phoneNumberId: process.env.META_PHONE_NUMBER_ID!,
  businessAccountId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID!,
  version: "v21.0",
});

// Initialize Twilio service for SMS
const twilioService = new TwilioService({
  accountSid: TWILIO_ACCOUNT_SID,
  authToken: TWILIO_AUTH_TOKEN,
  fromPhoneNumber: TWILIO_PHONE_NUMBER,
});

export const otpCheck = async (req: Request, res: Response) => {
  const { mobile } = req.body;

  const otpRecord = await prismaDB.otp.findUnique({
    where: {
      mobile: mobile,
    },
  });

  return res.json({ success: true, otpRecord });
};

export const checkCustomer = async (req: Request, res: Response) => {
  const { email, mobile } = req.body;
};

export const updateOtp = async (req: Request, res: Response) => {
  const { mobile, restaurantId } = req.body;

  try {
    const getOutlet = await getOutletById(restaurantId);
    if (!getOutlet?.id) {
      throw new NotFoundException(
        "Outlet Not Found",
        ErrorCode.OUTLET_NOT_FOUND
      );
    }
    // Generate a new OTP
    const newOtp = generateOtp();
    const newExpiry = new Date(Date.now() + 300000); // 5 minutes expiry

    // Store or update OTP in database
    const existingOtp = await prismaDB.otp.findUnique({
      where: {
        mobile: mobile.toString(),
      },
    });

    if (existingOtp) {
      await prismaDB.otp.update({
        where: { mobile: mobile.toString() },
        data: { otp: newOtp, expires: newExpiry },
      });
    } else {
      await prismaDB.otp.create({
        data: {
          mobile: mobile.toString(),
          otp: newOtp,
          expires: newExpiry,
        },
      });
    }

    // Send OTP via SMS using Twilio
    const businessName = getOutlet?.name || "Your Restaurant";
    await twilioService.sendSmsOtp(mobile.toString(), newOtp, businessName);

    return res.json({
      success: true,
      message: "Verification code sent via SMS",
      phoneNumber: mobile.toString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send verification code",
    });
  }
};

/**
 * Send OTP via WhatsApp
 */
export const sendWhatsAppOtp = async (req: Request, res: Response) => {
  const { mobile, restaurantName } = req.body;

  try {
    // Generate a new OTP
    const newOtp = generateOtp();
    const newExpiry = new Date(Date.now() + 300000); // 5 minutes expiry

    // Store or update OTP in database
    const existingOtp = await prismaDB.otp.findUnique({
      where: {
        mobile: mobile.toString(),
      },
    });

    if (existingOtp) {
      await prismaDB.otp.update({
        where: { mobile: mobile.toString() },
        data: { otp: newOtp, expires: newExpiry },
      });
    } else {
      await prismaDB.otp.create({
        data: {
          mobile: mobile.toString(),
          otp: newOtp,
          expires: newExpiry,
        },
      });
    }

    // Send OTP via WhatsApp using Twilio
    const businessName = restaurantName || "Your Restaurant";
    await twilioService.sendWhatsAppOtp(
      mobile.toString(),
      newOtp,
      businessName
    );

    return res.json({
      success: true,
      message: "Verification code sent via WhatsApp",
      phoneNumber: mobile.toString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send verification code",
    });
  }
};

/**
 * Verify OTP code
 */
export const verifyOtp = async (req: Request, res: Response) => {
  const { mobile, code } = req.body;

  try {
    if (!mobile || !code) {
      return res.status(400).json({
        success: false,
        message: "Phone number and verification code are required",
      });
    }

    // Get OTP from database
    const otpRecord = await prismaDB.otp.findUnique({
      where: { mobile: mobile.toString() },
    });

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: "No verification code found for this number",
      });
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expires) {
      // Delete expired OTP
      await prismaDB.otp.delete({
        where: { mobile: mobile.toString() },
      });

      return res.status(400).json({
        success: false,
        message: "Verification code has expired",
      });
    }

    // Check if OTP matches
    if (otpRecord.otp !== code) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    // Delete used OTP
    await prismaDB.otp.delete({
      where: { mobile: mobile.toString() },
    });

    return res.json({
      success: true,
      message: "Phone number verified successfully",
      phoneNumber: mobile.toString(),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify code",
    });
  }
};

export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

export const CustomerLogin = async (req: Request, res: Response) => {
  const { phoneNo, name, restaurantId } = req.body;

  const existingCustomer = await prismaDB.customer.findUnique({
    where: {
      phoneNo: phoneNo,
    },
    include: {
      restaurantAccess: true,
    },
  });

  if (existingCustomer?.id) {
    // Customer exists, check if they have access to this restaurant
    const hasRestaurantAccess = existingCustomer.restaurantAccess.some(
      (access) => access.restaurantId === restaurantId
    );

    if (hasRestaurantAccess) {
      // Update existing customer's name if provided
      const updateCustomer = await prismaDB.customer.update({
        where: {
          id: existingCustomer.id,
        },
        data: {
          name: name || existingCustomer.name,
        },
      });

      const customerData = {
        id: updateCustomer.id,
        name: updateCustomer.name,
        email: updateCustomer.email,
        phoneNo: updateCustomer.phoneNo,
        image: updateCustomer.image,
        role: updateCustomer.role,
        restaurantId: restaurantId,
      };

      await getOutletCustomerAndFetchToRedis(restaurantId);
      return sendToken(customerData as Customer, 200, res);
    } else {
      // Add access to new restaurant for existing customer
      await prismaDB.customerRestaurantAccess.create({
        data: {
          customerId: existingCustomer.id,
          restaurantId: restaurantId,
        },
      });

      const customerData = {
        id: existingCustomer.id,
        name: existingCustomer.name,
        email: existingCustomer.email,
        phoneNo: existingCustomer.phoneNo,
        image: existingCustomer.image,
        role: existingCustomer.role,
        restaurantId: restaurantId,
      };

      await getOutletCustomerAndFetchToRedis(restaurantId);
      return sendToken(customerData as Customer, 200, res);
    }
  } else {
    const createCustomer = await prismaDB.customer.create({
      data: {
        name,
        phoneNo,
        restaurantAccess: {
          create: {
            restaurantId: restaurantId,
          },
        },
      },
    });

    const customerData = {
      id: createCustomer?.id,
      name: createCustomer?.name,
      email: createCustomer?.email,
      phoneNo: createCustomer?.phoneNo,
      image: createCustomer?.image,
      role: createCustomer?.role,
      restaurantId: restaurantId,
    };
    await getOutletCustomerAndFetchToRedis(restaurantId);
    sendToken(customerData as Customer, 200, res);
  }
};

export const customerUpdateSession = async (req: Request, res: Response) => {
  const { outletId, customerId } = req.params;

  const { userType, tableId, address, location } = req.body;

  if (!outletId) {
    throw new BadRequestsException(
      "Restuarant ID Required",
      ErrorCode.NOT_FOUND
    );
  }
  if (!customerId) {
    throw new BadRequestsException("Customer ID Required", ErrorCode.NOT_FOUND);
  }

  if (!userType) {
    throw new BadRequestsException("UserType Required", ErrorCode.NOT_FOUND);
  }

  const getCustomer = await prismaDB.customerRestaurantAccess.findFirst({
    where: {
      customerId: customerId,
      restaurantId: outletId,
    },
  });

  if (!getCustomer?.id) {
    throw new NotFoundException("No User Found", ErrorCode.NOT_FOUND);
  }

  await prismaDB.customerRestaurantAccess.update({
    where: {
      id: getCustomer.id,
      customerId: getCustomer.customerId,
      restaurantId: outletId,
    },
    data: {
      userType: userType,
      address: `${address?.area},${address?.address}`,
      landmark: address?.landmark,
      latitude: location?.lat ? location?.lat.toString() : null,
      longitude: location?.lng ? location?.lng.toString() : null,
    },
  });

  if (tableId) {
    await prismaDB.table.updateMany({
      where: {
        id: tableId,
        restaurantId: outletId,
      },
      data: {
        customerId: getCustomer?.id,
        occupied: true,
      },
    });
  }

  return res.json({
    success: true,
    message: "Profile Session ot updated",
  });
};

export const getCustomerOrdersById = async (req: Request, res: Response) => {
  const { outletId, customerId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const customer = await getCustomerById(customerId, outlet?.id);

  if (!customer?.id) {
    throw new NotFoundException("Customer Not Found", ErrorCode.NOT_FOUND);
  }

  const formattedOrder = customer?.orderSession
    .filter((s) => s.active === false)
    .map((session) => ({
      id: session?.id,
      billId: session?.billId,
      active: session?.active,
      invoiceUrl: session?.invoiceUrl,
      orderType: session?.orderType,
      status: session?.sessionStatus,
      isPaid: session?.isPaid,
      subTotal: session?.subTotal,
      paymentMethod: session?.paymentMethod,
      deliveryFee: session?.deliveryFee,
      packingFee: session?.packingFee,
      paymentMode: session?.paymentMode,
      orders: session?.orders?.map((order) => ({
        id: order?.generatedOrderId,
        status: order?.orderStatus,
        s: order?.totalAmount,
        orderItems: order?.orderItems.map((item) => ({
          id: item?.id,
          name: item?.name,
          quantity: item.quantity,
          originalRate: item.originalRate,
          total: item?.totalPrice,
        })),
      })),
    }));
  return res.json({
    success: true,
    orders: formattedOrder,
  });
};

export const getCurrentOrderForCustomer = async (
  req: Request,
  res: Response
) => {
  const { outletId, customerId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const customer = await getCustomerById(customerId, outlet?.id);

  if (!customer?.id) {
    throw new NotFoundException("Customer Not Found", ErrorCode.NOT_FOUND);
  }

  const formattedOrder = customer?.orderSession
    .filter((s) => s.active === true)
    .map((session) => ({
      id: session?.id,
      orderStatus: session?.orders?.some(
        (o) => o?.orderStatus !== "SERVED" && o?.orderStatus !== "CANCELLED"
      ),
      billId: session?.billId,
      active: session?.active,
      invoiceUrl: session?.invoiceUrl,
      orderType: session?.orderType,
      status: session?.sessionStatus,
      isPaid: session?.isPaid,
      subTotal: session?.subTotal,
      paymentMethod: session?.paymentMethod,
      deliveryFee: session?.deliveryFee,
      packingFee: session?.packingFee,
      paymentMode: session?.paymentMode,
      orders: session?.orders?.map((order) => ({
        id: order?.generatedOrderId,
        orderStatus: order?.orderStatus,
        totalAmount: order?.totalAmount,
        preparationTime: order?.preparationTime,
        createdAt: order?.createdAt,
        updatedAt: order?.updatedAt,
        orderItems: order?.orderItems.map((item) => ({
          id: item?.id,
          name: item?.name,
          quantity: item.quantity,
          originalRate: item.originalRate,
          total: item?.totalPrice,
        })),
      })),
    }));

  return res.json({
    success: true,
    orders: formattedOrder,
  });
};

export const CustomerUpdateAccessToken = async (
  req: Request,
  res: Response
) => {
  const authHeader = req.headers.authorization as string;
  const refresh_token = authHeader && authHeader.split(" ")[1];
  const payload = jwt.verify(refresh_token, REFRESH_TOKEN) as jwt.JwtPayload;
  if (!payload) {
    throw new NotFoundException(
      "Could Not refresh token",
      ErrorCode.TOKENS_NOT_VALID
    );
  }

  const session = await redis.get(payload.id);

  if (!session) {
    throw new NotFoundException("User Not Found", ErrorCode.NOT_FOUND);
  }

  const user = JSON.parse(session);

  const accessToken = jwt.sign({ id: user.id }, ACCESS_TOKEN, {
    expiresIn: "5m",
  });

  const refreshToken = jwt.sign({ id: user?.id }, REFRESH_TOKEN, {
    expiresIn: "7d",
  });

  res.status(200).json({
    success: true,
    tokens: {
      accessToken,
      refreshToken,
    },
  });
};
