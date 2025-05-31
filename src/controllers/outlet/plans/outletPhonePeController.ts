import {
  Env,
  StandardCheckoutClient,
  StandardCheckoutPayRequest,
} from "pg-sdk-node";
import { prismaDB } from "../../..";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { getOrderSessionById, getOutletById } from "../../../lib/outlet";
import { decryptData } from "../../../lib/utils";
import { ENV } from "../../../secrets";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { API } from "./planController";

const outletPhonePeClient = async (outletId: string) => {
  try {
    const getOutlet = await getOutletById(outletId);

    if (!getOutlet?.id) {
      throw new NotFoundException(
        "Outlet Not found",
        ErrorCode.OUTLET_NOT_FOUND
      );
    }

    const phonePeIntegration = await prismaDB.integration.findFirst({
      where: {
        restaurantId: outletId,
        name: "PHONEPE",
      },
      select: {
        phonePeAPIId: true,
        phonePeAPISecretKey: true,
      },
    });

    if (!phonePeIntegration) {
      throw new NotFoundException(
        "PhonePe Connection Error, Contact Support",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    if (
      !phonePeIntegration?.phonePeAPIId ||
      !phonePeIntegration?.phonePeAPISecretKey
    ) {
      throw new NotFoundException(
        "PhonePe Not Configured for this outlet",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }

    const clientId = decryptData(phonePeIntegration?.phonePeAPIId);
    const clientSecret = decryptData(phonePeIntegration?.phonePeAPISecretKey);
    return StandardCheckoutClient.getInstance(
      clientId,
      clientSecret,
      1,
      ENV === "development" ? Env.SANDBOX : Env.PRODUCTION
    );
  } catch (error) {
    console.log(error);
    throw new BadRequestsException(
      "Something Went wrong in the server",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }
};

export async function createDomainPhonePeOrder(req: Request, res: Response) {
  const { outletId } = req.params;
  const { amount, orderSessionId, from, domain } = req.body;
  // @ts-ignore
  const userId = req.user.id;

  if (!amount) {
    throw new NotFoundException(
      "Amount is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!from) {
    throw new NotFoundException(
      "PhonePe Initiialization Failed",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }

  if (from === "paybill" && !orderSessionId) {
    throw new NotFoundException(
      "Order is Missing",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!domain) {
    throw new NotFoundException("Domain Not found", ErrorCode.NOT_FOUND);
  }

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const ophonePeClient = await outletPhonePeClient(outletId);

  const merchantOrderId = randomUUID();
  if (from === "paybill") {
    const getOrder = await getOrderSessionById(outletId, orderSessionId);
    if (getOrder?.active === false && getOrder.isPaid) {
      throw new BadRequestsException(
        "Bill Already Cleared",
        ErrorCode.INTERNAL_EXCEPTION
      );
    }

    const redirectUrl = `${API}/outlet/${outletId}/check-phonepe-status?merchantOrderId=${merchantOrderId}&from=${from}&orderSessionId=${orderSessionId}&userId=${userId}&domain=${domain}`;

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amount)
      .redirectUrl(redirectUrl)
      .build();

    const response = await ophonePeClient.pay(request);
    return res.json({
      success: true,
      redirectUrl: response.redirectUrl,
    });
  } else {
    const redirectUrl = `${API}/outlet/${outletId}/check-phonepe-status?merchantOrderId=${merchantOrderId}&from=${from}&userId=${userId}&domain=${domain}`;

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amount)
      .redirectUrl(redirectUrl)
      .build();

    const response = await ophonePeClient.pay(request);
    return res.json({
      success: true,
      redirectUrl: response.redirectUrl,
    });
  }
}

export async function posOutletPhonePeOrder(req: Request, res: Response) {
  const { outletId } = req.params;
  const { amount } = req.body;
  // @ts-ignore
  const userId = req.user.id;

  if (!amount) {
    throw new NotFoundException(
      "Amount is Required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const getOutlet = await getOutletById(outletId);

  if (!getOutlet?.id) {
    throw new NotFoundException("Outlet Not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const ophonePeClient = await outletPhonePeClient(outletId);

  const merchantOrderId = randomUUID();

  const redirectUrl = `${API}/outlet/${outletId}/check-pos-phonepe-status?merchantOrderId=${merchantOrderId}&&userId=${userId}`;

  const request = StandardCheckoutPayRequest.builder()
    .merchantOrderId(merchantOrderId)
    .amount(amount)
    .redirectUrl(redirectUrl)
    .build();

  const response = await ophonePeClient.pay(request);
  return res.json({
    success: true,
    redirectUrl: response.redirectUrl,
  });
}

export async function posAmountPhoneCheck(req: Request, res: Response) {
  const { outletId } = req.params;

  const { merchantOrderId } = req.query;

  if (!merchantOrderId) {
    throw new NotFoundException(
      "Merchant OrderId is Missing",
      ErrorCode.UNAUTHORIZED
    );
  }

  const ophonePeClient = await outletPhonePeClient(outletId);
  const response = await ophonePeClient.getOrderStatus(
    merchantOrderId as string
  );

  const status = response.state;
  let host =
    ENV === "production"
      ? `https://pos.restobytes.in/${outletId}/billing`
      : `http://localhost:5173/${outletId}/billing`;

  if (status === "COMPLETED") {
    // Create subscription similar to buyPlan function
    return res.redirect(
      `${host}?payment=success&paymentId=${response?.orderId}&amount=${
        response?.amount / 100
      }`
    );
  } else {
    return res.redirect(`${host}?payment=failure`);
  }
}

export async function orderAmountPhoneCheck(req: Request, res: Response) {
  const { outletId } = req.params;

  const { merchantOrderId, orderSessionId, from, userId, domain } = req.query;

  if (!merchantOrderId) {
    throw new NotFoundException(
      "Merchant OrderId is Missing",
      ErrorCode.UNAUTHORIZED
    );
  }

  if (!orderSessionId && from === "paybill") {
    throw new NotFoundException(" OrderId is Missing", ErrorCode.UNAUTHORIZED);
  }

  const ophonePeClient = await outletPhonePeClient(outletId);
  const response = await ophonePeClient.getOrderStatus(
    merchantOrderId as string
  );

  const status = response.state;
  const host =
    ENV === "production"
      ? `https://${domain}.restobytes.in/${outletId}`
      : `http://${domain}.localhost:2000/${outletId}`;

  const orderSession = await getOrderSessionById(
    outletId,
    orderSessionId as string
  );

  if (!orderSession) {
    throw new NotFoundException("Order Not Found", ErrorCode.NOT_FOUND);
  }

  if (status === "COMPLETED") {
    // Create subscription similar to buyPlan function
    if (!userId) {
      throw new BadRequestsException(
        "User is Missing",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
    if (from === "paybill") {
      return res.redirect(
        `${host}/paybill/${orderSession?.tableId}?payment=success&paymentId=${
          response?.orderId
        }&amount=${response?.amount / 100}`
      );
    } else {
      return res.redirect(
        `${host}/cart?payment=success&paymentId=${response?.orderId}&amount=${
          response?.amount / 100
        }`
      );
    }
  } else {
    if (from === "paybill") {
      return res.redirect(
        `${host}/paybill/${orderSession?.tableId}?payment=failure`
      );
    } else {
      return res.redirect(`${host}/cart?payment=failure`);
    }
  }
}
