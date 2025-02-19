import { Request, Response } from "express";
import { AdminCashRegisterService } from "../../../services/adminCashRegisterService";
import { redis } from "../../../services/redis";
import { prismaDB } from "../../..";
import { z } from "zod";
import { ErrorCode } from "../../../exceptions/root";
import { BadRequestsException } from "../../../exceptions/bad-request";

const adminRegisterService = new AdminCashRegisterService();

const openRegisterSchema = z.object({
  userId: z.string(),
  openingBalance: z.coerce.number().min(0, "Opening balance must be positive"),
  openingNotes: z.string().optional(),
  denominations: z.object({
    coins: z.number().min(0, "Coins must be positive"),
    coins2: z.number().min(0, "Coins 2 must be positive"),
    coins5: z.number().min(0, "Coins 5 must be positive"),
    note500: z.number().min(0, "₹500 Notes must be positive"),
    note200: z.number().min(0, "₹200 Notes must be positive"),
    note100: z.number().min(0, "₹100 Notes must be positive"),
    note50: z.number().min(0, "₹50 Notes must be positive"),
    note20: z.number().min(0, "₹20 Notes must be positive"),
    note10: z.number().min(0, "₹10 Notes must be positive"),
  }),
});

export const openAdminRegister = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const validateFields = openRegisterSchema.safeParse(req.body);

  if (!validateFields.success) {
    throw new BadRequestsException(
      validateFields.error.message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  // @ts-ignore
  const adminId = req.user.id;

  if (validateFields.data.userId !== adminId) {
    throw new BadRequestsException(
      "You are not authorized to open this register",
      ErrorCode.UNAUTHORIZED
    );
  }

  const register = await adminRegisterService.openRegister(
    adminId,
    outletId,
    validateFields.data.openingBalance,
    validateFields.data.openingNotes,
    validateFields.data.denominations
  );

  // Clear cache
  await redis.del(`admin-register-${adminId}-${outletId}`);

  return res.json({
    success: true,
    message: "Cash Register Opened Successfully",
    data: register,
  });
};

const closeRegisterSchema = z.object({
  userId: z.string(),
  actualBalance: z.coerce
    .number()
    .min(0, "Actual balance must be positive")
    .refine((val) => val >= 0, "Balance cannot be negative"),
  closingNotes: z.string().optional(),
  denominations: z
    .object({
      note500: z.coerce.number().min(0).optional(),
      note200: z.coerce.number().min(0).optional(),
      note100: z.coerce.number().min(0).optional(),
      note50: z.coerce.number().min(0).optional(),
      note20: z.coerce.number().min(0).optional(),
      note10: z.coerce.number().min(0).optional(),
      coins: z.coerce.number().min(0).optional(),
      coins2: z.coerce.number().min(0).optional(),
      coins5: z.coerce.number().min(0).optional(),
    })
    .refine((data) => {
      const total = Object.entries(data).reduce((sum, [key, count]) => {
        const value = parseInt(key.replace("note", "")) || 1; // Use 1 for coins
        return sum + value * (count || 0);
      }, 0);
      return total >= 0;
    }, "At least one denomination must be entered"),
});

export const closeAdminRegister = async (req: Request, res: Response) => {
  const { outletId, registerId } = req.params;

  const { data: validateFields, error } = closeRegisterSchema.safeParse(
    req.body
  );

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  // @ts-ignore
  const adminId = req.user.id;

  if (validateFields.userId !== adminId) {
    throw new BadRequestsException(
      "You are not authorized to close this register",
      ErrorCode.UNAUTHORIZED
    );
  }

  const result = await adminRegisterService.closeRegister(
    adminId,
    registerId,
    validateFields.actualBalance,
    validateFields.closingNotes,
    validateFields.denominations
  );

  // Clear cache
  const register = await prismaDB.cashRegister.findUnique({
    where: { id: registerId },
    select: { restaurantId: true },
  });
  if (register) {
    await redis.del(`admin-register-${adminId}-${outletId}`);
  }

  return res.json({
    success: true,
    message: "Cash Register Closed Successfully",
    data: result,
  });
};

export const getAdminRegisterStatus = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  // @ts-ignore
  const adminId = req.user.id;

  const status = await adminRegisterService.getRegisterStatus(
    adminId,
    outletId
  );

  return res.json({
    success: true,
    message: "Cash Register Status Fetched Successfully",
    data: status,
  });
};
