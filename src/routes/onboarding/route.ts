import { Router } from "express";
import { isAuthMiddelware } from "../../middlewares/auth";
import { errorHandler } from "../../error-handler";
import {
  createOutlet,
  getOnBoarding,
  saveOnBoarding,
  updateOnboardingStatus,
} from "../../controllers/outlet/onboarding/onboardingController";
import {
  createPhonePeOrder,
  CreateRazorPayOrder,
  paymentRazorpayVerification,
  paymentWebhookVerification,
  statusPhonePeCheck,
} from "../../controllers/outlet/plans/planController";
import { sendFireBaseNotification } from "../../controllers/utilsController";

const onboardingRoute: Router = Router();

onboardingRoute.get("/", isAuthMiddelware, errorHandler(getOnBoarding));
onboardingRoute.post(
  "/create-outlet",
  isAuthMiddelware,
  errorHandler(createOutlet)
);
onboardingRoute.patch("/save", isAuthMiddelware, errorHandler(saveOnBoarding));
onboardingRoute.patch(
  "/update-onboarding-user",
  isAuthMiddelware,
  errorHandler(updateOnboardingStatus)
);
onboardingRoute.post(
  "/create-razorpay-order",
  isAuthMiddelware,
  errorHandler(CreateRazorPayOrder)
);
onboardingRoute.post(
  "/create-phonepe-order",
  isAuthMiddelware,
  errorHandler(createPhonePeOrder)
);
onboardingRoute.get("/check-status", errorHandler(statusPhonePeCheck));
onboardingRoute.post(
  "/verify-razorpay-payment",
  errorHandler(paymentRazorpayVerification)
);
onboardingRoute.post(
  "/razorpay-verification",
  errorHandler(paymentWebhookVerification)
);
onboardingRoute.post(
  "/send-notification",
  errorHandler(sendFireBaseNotification)
);

export default onboardingRoute;
