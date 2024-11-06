import { Request, Response } from "express";
import { prismaDB } from "../../..";
import { sendToken } from "../../../services/jwt";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phoneNo: string;
  image: string | null;
  role: "CUSTOMER";
  restaurantId: string;
}

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
  const { mobile } = req.body;

  const newOtp = generateOtp();
  const newExpiry = new Date(Date.now() + 300000);

  const existingOtp = await prismaDB.otp.findUnique({
    where: {
      mobile: mobile.toString(),
    },
  });

  if (existingOtp) {
    const update = await prismaDB.otp.update({
      where: { mobile: mobile.toString() },
      data: { otp: newOtp, expires: newExpiry },
    });
    return res.json({ success: true, otp: update.otp });
  } else {
    const createdOTP = await prismaDB.otp.create({
      data: {
        mobile: mobile.toString(),
        otp: newOtp,
        expires: newExpiry,
      }, // expires in 5 minutes
    });
    return res.json({ success: true, otp: createdOTP.otp });
  }
};

export function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

export const CustomerLogin = async (req: Request, res: Response) => {
  const { phoneNo, name, restaurantId } = req.body;

  const customer = await prismaDB.customer.findFirst({
    where: {
      phoneNo: phoneNo,
      restaurantId: restaurantId,
    },
  });

  if (customer) {
    const updateCustomer = await prismaDB.customer.update({
      where: {
        id: customer.id,
        phoneNo: phoneNo,
        restaurantId: restaurantId,
      },
      data: {
        name: name,
      },
    });

    const customerData = {
      id: updateCustomer?.id,
      name: updateCustomer?.name,
      email: updateCustomer?.email,
      phoneNo: updateCustomer?.phoneNo,
      image: updateCustomer?.image,
      role: updateCustomer?.role,
      restaurantId: updateCustomer.restaurantId,
    };

    sendToken(customerData as Customer, 200, res);
  } else {
    const createCustomer = await prismaDB.customer.create({
      data: {
        name,
        phoneNo,
        restaurantId,
      },
    });

    const customerData = {
      id: createCustomer?.id,
      name: createCustomer?.name,
      email: createCustomer?.email,
      phoneNo: createCustomer?.phoneNo,
      image: createCustomer?.image,
      role: createCustomer?.role,
      restaurantId: createCustomer.restaurantId,
    };

    sendToken(customerData as Customer, 200, res);
  }
};

export const customerUpdateSession = async (req: Request, res: Response) => {
  const { outletId, customerId } = req.params;

  const { userType, tableId } = req.body;

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

  const getCustomer = await prismaDB.customer.findUnique({
    where: {
      id: customerId,
      restaurantId: outletId,
    },
  });

  if (!getCustomer?.id) {
    throw new NotFoundException("No User Found", ErrorCode.NOT_FOUND);
  }

  const updateCustomerDetails = await prismaDB.customer.updateMany({
    where: {
      id: getCustomer.id,
      restaurantId: outletId,
    },
    data: {
      userType: userType,
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
