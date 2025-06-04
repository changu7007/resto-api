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
import { API } from "./planController";
import { PhonePeService } from "../../../services/phonepe/phonepe-service";

const phonePeService = PhonePeService.getInstance();

// const outletPhonePeClient = async (outletId: string) => {
//   try {
//     const getOutlet = await getOutletById(outletId);

//     if (!getOutlet?.id) {
//       throw new NotFoundException(
//         "Outlet Not found",
//         ErrorCode.OUTLET_NOT_FOUND
//       );
//     }

//     const phonePeIntegration = await prismaDB.integration.findFirst({
//       where: {
//         restaurantId: outletId,
//         name: "PHONEPE",
//       },
//       select: {
//         phonePeAPIId: true,
//         phonePeAPISecretKey: true,
//       },
//     });

//     if (!phonePeIntegration) {
//       throw new NotFoundException(
//         "PhonePe Connection Error, Contact Support",
//         ErrorCode.UNPROCESSABLE_ENTITY
//       );
//     }

//     if (
//       !phonePeIntegration?.phonePeAPIId ||
//       !phonePeIntegration?.phonePeAPISecretKey
//     ) {
//       throw new NotFoundException(
//         "PhonePe Not Configured for this outlet",
//         ErrorCode.UNPROCESSABLE_ENTITY
//       );
//     }

//     const clientId = decryptData(phonePeIntegration?.phonePeAPIId);
//     const clientSecret = decryptData(phonePeIntegration?.phonePeAPISecretKey);

//     // Check if client already exists for this outlet
//     const clientKey = `${outletId}_${clientId}`;
//     if (phonePeClients.has(clientKey)) {
//       return phonePeClients.get(clientKey);
//     }

//     // Create new client instance for this outlet
//     try {
//       const client = StandardCheckoutClient.getInstance(
//         clientId,
//         clientSecret,
//         1,
//         ENV === "development" ? Env.SANDBOX : Env.PRODUCTION
//       );

//       // Store the client for reuse
//       phonePeClients.set(clientKey, client);
//       return client;
//     } catch (error) {
//       // If getInstance fails due to re-initialization, try alternative approach
//       console.log(
//         "StandardCheckoutClient re-initialization error, using workaround"
//       );

//       // Alternative: Create a custom client wrapper or use direct API calls
//       // For now, we'll throw a more descriptive error
//       throw new BadRequestsException(
//         "PhonePe client initialization conflict. Please contact support.",
//         ErrorCode.INTERNAL_EXCEPTION
//       );
//     }
//   } catch (error) {
//     console.log("outletPhonePeClient error:", error);
//     if (
//       error instanceof NotFoundException ||
//       error instanceof BadRequestsException
//     ) {
//       throw error;
//     }
//     throw new BadRequestsException(
//       "Something went wrong in the server",
//       ErrorCode.INTERNAL_EXCEPTION
//     );
//   }
// };

export async function createDomainPhonePeOrder(req: Request, res: Response) {
  try {
    const { outletId } = req.params;
    const { amount, orderSessionId, from, domain } = req.body;
    // @ts-ignore
    const userId = req.user.id;

    // Validation
    if (!amount) {
      throw new NotFoundException(
        "Amount is Required",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
    if (!from) {
      throw new NotFoundException(
        "PhonePe Initialization Failed",
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

    // Verify outlet exists
    const getOutlet = await getOutletById(outletId);
    if (!getOutlet?.id) {
      throw new NotFoundException(
        "Outlet Not found",
        ErrorCode.OUTLET_NOT_FOUND
      );
    }

    // Verify order if from paybill
    if (from === "paybill") {
      const getOrder = await getOrderSessionById(outletId, orderSessionId);
      if (getOrder?.active === false && getOrder.isPaid) {
        throw new BadRequestsException(
          "Bill Already Cleared",
          ErrorCode.INTERNAL_EXCEPTION
        );
      }
    }

    // Get PhonePe client for outlet
    const phonePeClient = await phonePeService.getOutletClient(outletId);
    const merchantOrderId = phonePeClient.generatePhonePeOrderId("OUTLET");

    let redirectUrl;

    if (from === "paybill") {
      redirectUrl = `${API}/outlet/${outletId}/check-phonepe-status?merchantOrderId=${merchantOrderId}&from=${from}&orderSessionId=${orderSessionId}&userId=${userId}&domain=${domain}`;
    } else {
      redirectUrl = `${API}/outlet/${outletId}/check-phonepe-status?merchantOrderId=${merchantOrderId}&from=${from}&userId=${userId}&domain=${domain}`;
    }

    // Create payment
    const paymentResponse = await phonePeClient.createPayment({
      merchantOrderId,
      amount,
      redirectUrl,
      userId,
      metadata: { outletId, from, domain },
    });

    console.log("Payment Creation Response:", paymentResponse);

    if (!paymentResponse.success) {
      throw new BadRequestsException(
        paymentResponse.error || "Payment creation failed",
        ErrorCode.INTERNAL_EXCEPTION
      );
    }

    return res.json({
      success: true,
      redirectUrl: paymentResponse.redirectUrl,
    });
  } catch (error: any) {
    console.error("createDomainPhonePeOrder error:", error);

    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestsException
    ) {
      throw error;
    }

    throw new BadRequestsException(
      "Something went wrong in payment processing",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }
}

export async function posOutletPhonePeOrder(req: Request, res: Response) {
  try {
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
      throw new NotFoundException(
        "Outlet Not found",
        ErrorCode.OUTLET_NOT_FOUND
      );
    }

    const phonePeClient = await phonePeService.getOutletClient(outletId);
    const merchantOrderId = phonePeClient.generatePhonePeOrderId("POS");

    const redirectUrl = `${API}/outlet/${outletId}/check-pos-phonepe-status?merchantOrderId=${merchantOrderId}&userId=${userId}`;

    const paymentResponse = await phonePeClient.createPayment({
      merchantOrderId,
      amount,
      redirectUrl,
      userId,
      metadata: { outletId, type: "pos" },
    });

    if (!paymentResponse.success) {
      throw new BadRequestsException(
        paymentResponse.error || "Payment creation failed",
        ErrorCode.INTERNAL_EXCEPTION
      );
    }

    return res.json({
      success: true,
      redirectUrl: paymentResponse.redirectUrl,
    });
  } catch (error: any) {
    console.error("posOutletPhonePeOrder error:", error);

    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestsException
    ) {
      throw error;
    }

    throw new BadRequestsException(
      "Something went wrong in payment processing",
      ErrorCode.INTERNAL_EXCEPTION
    );
  }
}

export async function orderAmountPhoneCheck(req: Request, res: Response) {
  try {
    const { outletId } = req.params;
    const { merchantOrderId, orderSessionId, from, userId, domain } = req.query;

    if (!merchantOrderId) {
      throw new NotFoundException(
        "Merchant OrderId is Missing",
        ErrorCode.UNAUTHORIZED
      );
    }

    if (!orderSessionId && from === "paybill") {
      throw new NotFoundException("OrderId is Missing", ErrorCode.UNAUTHORIZED);
    }

    const phonePeClient = await phonePeService.getOutletClient(outletId);
    const statusResponse = await phonePeClient.getOrderStatus(
      merchantOrderId as string
    );

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

    if (statusResponse.state === "COMPLETED") {
      if (!userId) {
        throw new BadRequestsException(
          "User is Missing",
          ErrorCode.UNPROCESSABLE_ENTITY
        );
      }

      if (from === "paybill") {
        return res.redirect(
          `${host}/paybill/${orderSession?.tableId}?payment=success&paymentId=${
            statusResponse?.orderId
          }&amount=${(statusResponse?.amount || 0) / 100}`
        );
      } else {
        return res.redirect(
          `${host}/cart?payment=success&paymentId=${
            statusResponse?.orderId
          }&amount=${(statusResponse?.amount || 0) / 100}`
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
  } catch (error: any) {
    console.error("orderAmountPhoneCheck error:", error);

    const host =
      ENV === "production"
        ? `https://${req.query.domain}.restobytes.in/${req.params.outletId}`
        : `http://${req.query.domain}.localhost:2000/${req.params.outletId}`;

    return res.redirect(`${host}/cart?payment=error`);
  }
}

export async function posAmountPhoneCheck(req: Request, res: Response) {
  try {
    const { outletId } = req.params;
    const { merchantOrderId } = req.query;

    if (!merchantOrderId) {
      throw new NotFoundException(
        "Merchant OrderId is Missing",
        ErrorCode.UNAUTHORIZED
      );
    }

    const phonePeClient = await phonePeService.getOutletClient(outletId);
    const statusResponse = await phonePeClient.getOrderStatus(
      merchantOrderId as string
    );

    const host =
      ENV === "production"
        ? `https://pos.restobytes.in/${outletId}/billing`
        : `http://localhost:5173/${outletId}/billing`;

    if (statusResponse.state === "COMPLETED") {
      return res.redirect(
        `${host}?payment=success&paymentId=${statusResponse?.orderId}&amount=${
          (statusResponse?.amount || 0) / 100
        }`
      );
    } else {
      return res.redirect(`${host}?payment=failure`);
    }
  } catch (error: any) {
    console.error("posAmountPhoneCheck error:", error);

    const host =
      ENV === "production"
        ? `https://pos.restobytes.in/${req.params.outletId}/billing`
        : `http://localhost:5173/${req.params.outletId}/billing`;

    return res.redirect(`${host}?payment=error`);
  }
}

// Utility endpoint for cache management (optional)
export async function clearPhonePeCache(req: Request, res: Response) {
  try {
    const { outletId } = req.params;

    if (outletId) {
      phonePeService.clearOutletCache(outletId);
    } else {
      phonePeService.clearAllCache();
    }

    return res.json({
      success: true,
      message: outletId
        ? `Cache cleared for outlet ${outletId}`
        : "All cache cleared",
      stats: phonePeService.getCacheStats(),
    });
  } catch (error: any) {
    return res.json({
      success: false,
      error: error.message,
    });
  }
}
