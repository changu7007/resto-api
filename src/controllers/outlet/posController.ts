import { Request, Response } from "express";
import { ErrorCode } from "../../exceptions/root";
import { UnauthorizedException } from "../../exceptions/unauthorized";
import { prismaDB } from "../..";
import { NotFoundException } from "../../exceptions/not-found";
import { BadRequestsException } from "../../exceptions/bad-request";
import { getOutletById } from "../../lib/outlet";
import { redis } from "../../services/redis";
import { z } from "zod";
import { StaffCheckInServices } from "../../services/staffCheckInServices";

const staffCheckInService = new StaffCheckInServices();

const openRegisterSchema = z.object({
  staffId: z.string(),
  openingBalance: z.coerce.number().min(0, "Opening balance must be positive"),
  openingNotes: z.string().optional(),
  denominations: z.object({
    coins: z.number().min(0, "Coins must be positive"),
    note500: z.number().min(0, "₹500 Notes must be positive"),
    note200: z.number().min(0, "₹200 Notes must be positive"),
    note100: z.number().min(0, "₹100 Notes must be positive"),
    note50: z.number().min(0, "₹50 Notes must be positive"),
    note20: z.number().min(0, "₹20 Notes must be positive"),
    note10: z.number().min(0, "₹10 Notes must be positive"),
    coins2: z.number().min(0, "Coins 2 must be positive"),
    coins5: z.number().min(0, "Coins 5 must be positive"),
  }),
});

export const posStaffCheckInAndRegister = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;
  // @ts-ignore
  const { id } = req.user;

  const validatedBody = openRegisterSchema.safeParse(req.body);

  if (!validatedBody.success) {
    throw new BadRequestsException(
      "Invalid Request Body",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (id !== validatedBody.data.staffId) {
    throw new UnauthorizedException(
      "Unauthorized Access",
      ErrorCode.UNAUTHORIZED
    );
  }

  const outlet = await getOutletById(outletId);
  if (!outlet) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const { checkIn, register } = await staffCheckInService.handleStaffChecIn(
    validatedBody.data.staffId,
    outletId,
    validatedBody.data.openingBalance,
    validatedBody.data.openingNotes,
    validatedBody.data.denominations
  );

  await redis.del(`pos-${validatedBody.data.staffId}`);

  return res.json({
    success: true,
    message: "Cash Register Opened Successfully",
    data: {
      checkIn,
      register,
    },
  });
};

const closeRegisterSchema = z.object({
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

export const posStaffCheckOut = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  // @ts-ignore
  const id = req.user?.id;

  const validatedBody = closeRegisterSchema.safeParse(req.body);

  if (!validatedBody.success) {
    throw new BadRequestsException(
      validatedBody.error?.errors[0]?.message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }
  const { checkIn, register, summary } =
    await staffCheckInService.handleStaffCheckOut(
      id,
      validatedBody.data.actualBalance,
      validatedBody.data.closingNotes,
      validatedBody.data.denominations
    );

  // Clear any cached POS data for this staff
  await redis.del(`pos-${id}`);

  return res.json({
    success: true,
    message: "Cash Register Closed Successfully",
    data: {
      checkIn,
      register,
      summary,
    },
  });
};

export const posGetRegisterStatus = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  // @ts-ignore
  const id = req.user?.id;

  const outlet = await getOutletById(outletId);
  if (!outlet) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.NOT_FOUND);
  }

  const register = await prismaDB.cashRegister.findFirst({
    where: {
      restaurantId: outletId,
      status: "OPEN",
      openedBy: id,
    },
    include: {
      transactions: {
        include: {
          order: true,
          expense: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      staff: {
        select: {
          name: true,
          role: true,
        },
      },
      user: {
        select: {
          name: true,
          role: true,
        },
      },
    },
  });

  return res.status(200).json({
    success: true,
    data: register,
  });
};
