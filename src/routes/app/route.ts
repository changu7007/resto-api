import { Router } from "express";
import { errorHandler } from "../../error-handler";
import { getPrimeDomain } from "../../controllers/outlet/domains/domainController";
import {
  CustomerLogin,
  customerUpdateSession,
  otpCheck,
  updateOtp,
} from "../../controllers/auth/prime/authControl";
import { isAuthMiddelware } from "../../middlewares/auth";

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

export default appRoute;
