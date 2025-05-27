import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { encryptData } from "../../../lib/utils";
import { z } from "zod";
import { BadRequestsException } from "../../../exceptions/bad-request";

const phonePeSchema = z.object({
  apiKey: z.string().min(1, { message: "Api Key field is reuired" }),
  apiSecret: z.string().min(1, { message: "Api Key field is required" }),
});

export const phonePeDetails = async (req: Request, res: Response) => {
  const { outletId } = req.params;

  const { data, error } = phonePeSchema.safeParse(req.body);

  if (error) {
    throw new BadRequestsException(
      error?.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const outlet = await getOutletById(outletId);

  if (!outlet?.id) {
    throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const getPhonePe = await prismaDB.integration.findFirst({
    where: {
      restaurantId: outlet?.id,
      name: "PHONEPE",
    },
  });

  if (!getPhonePe) {
    throw new NotFoundException(
      "App Not Configured. Contact Support",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }

  await prismaDB.integration.update({
    where: {
      id: getPhonePe?.id,
      name: "PHONEPE",
      restaurantId: outletId,
    },
    data: {
      phonePeAPIId: encryptData(data?.apiKey),
      phonePeAPISecretKey: encryptData(data?.apiSecret),
      connected: true,
    },
  });

  return res.json({
    success: true,
    message: "PhonePe Credentials Saved Successfully ✅",
  });
};
