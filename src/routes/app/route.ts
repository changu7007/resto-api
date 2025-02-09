import { Router } from "express";
import { errorHandler } from "../../error-handler";
import { getPrimeDomain } from "../../controllers/outlet/domains/domainController";
import {
  CustomerLogin,
  CustomerUpdateAccessToken,
  customerUpdateSession,
  getCurrentOrderForCustomer,
  getCustomerOrdersById,
  otpCheck,
  updateOtp,
} from "../../controllers/auth/prime/authControl";
import { isAuthMiddelware } from "../../middlewares/auth";
import { CreateRazorPayOrderForOutlet } from "../../controllers/outlet/plans/planController";

const appRoute: Router = Router();

appRoute.get("/get-site/:subdomain", errorHandler(getPrimeDomain));
appRoute.post("/check-otp", errorHandler(otpCheck));
appRoute.post("/update-otp", errorHandler(updateOtp));
appRoute.post("/customer-login", errorHandler(CustomerLogin));
appRoute.patch(
  "/update-customer-session/:outletId/:customerId",
  isAuthMiddelware,
  errorHandler(customerUpdateSession)
);
appRoute.get(
  "/outlet/:outletId/customer/:customerId/get-orders",
  isAuthMiddelware,
  errorHandler(getCustomerOrdersById)
);
appRoute.get(
  "/outlet/:outletId/customer/:customerId/get-current-orders",
  isAuthMiddelware,
  errorHandler(getCurrentOrderForCustomer)
);
appRoute.post(
  "/outlet/:outletId/create-razorpay-order",
  isAuthMiddelware,
  errorHandler(CreateRazorPayOrderForOutlet)
);
appRoute.post(
  "/customer-update-access-token",
  isAuthMiddelware,
  errorHandler(CustomerUpdateAccessToken)
);
export default appRoute;
