import { Router } from "express";

import { errorHandler } from "../error-handler";
import { isAuthMiddelware } from "../middlewares/auth";
import {
  GetStaff,
  StaffLogin,
  StaffLogout,
  StaffUpdateAccessToken,
} from "../controllers/auth/staff/staffAuthController";
import {
  AppLogout,
  AppUpdateAccessToken,
  createTwoFactorConfirmation,
  delete2FAConfirmation,
  generateTwoFactorToken,
  get2FAConfirmationUser,
  get2FATokenByEmail,
  getTwoFactorTokenByToken,
  getUserByEmail,
  getUserById,
  getUserByIdAndVerifyEmail,
  getUserInfo,
  getVerificationToken,
  OwnerLogin,
  OwnerUser,
  registerOwner,
  socialAuthLogin,
  twoFactorTokenDelete,
} from "../controllers/auth/owner/appAuthController";
import {
  deleteVerificationToken,
  getVerificationTokenByEmail,
  getVerificationTokenByToken,
  updateUserEmailVerification,
} from "../controllers/auth/verificationController";
import { getMainOutlet } from "../controllers/outlet/outletController";
import {
  buyPlan,
  getAllPlans,
} from "../controllers/outlet/plans/planController";

const authRoute: Router = Router();

authRoute.post("/app-login", errorHandler(OwnerLogin));
authRoute.post("/register-app-user", errorHandler(registerOwner));
authRoute.post("/app-logout", isAuthMiddelware, errorHandler(AppLogout));
authRoute.get("/app-user", isAuthMiddelware, errorHandler(OwnerUser));
authRoute.get("/app-refresh-token", errorHandler(AppUpdateAccessToken));
authRoute.post("/staff-login", errorHandler(StaffLogin));
authRoute.post("/staff-logout", isAuthMiddelware, errorHandler(StaffLogout));
authRoute.get("/staff-user", isAuthMiddelware, errorHandler(GetStaff));
authRoute.get("/staff-refresh-token", errorHandler(StaffUpdateAccessToken));
authRoute.post("/social-auth", errorHandler(socialAuthLogin));
authRoute.get("/outlet/:userId", isAuthMiddelware, errorHandler(getMainOutlet));

authRoute.get("/get-user/:id", errorHandler(getUserById));
authRoute.get("/get-user-info", isAuthMiddelware, errorHandler(getUserInfo));

authRoute.post(
  "/create-2fa-confirmation",
  errorHandler(createTwoFactorConfirmation)
);
authRoute.get(
  "/get-2fa-user-confirmation/:userId",
  errorHandler(get2FAConfirmationUser)
);
authRoute.delete("/delete-2fa/:id", errorHandler(delete2FAConfirmation));

authRoute.get(
  "/get-2fa-token-by-email/:email",
  errorHandler(get2FATokenByEmail)
);
authRoute.get(
  "/get-2fa-token-by-token/:token",
  errorHandler(getTwoFactorTokenByToken)
);
authRoute.delete("/delete-2fa-token/:id", errorHandler(twoFactorTokenDelete));

authRoute.post("/generate-2fa-token", errorHandler(generateTwoFactorToken));
authRoute.get("/get-user-email/:email", errorHandler(getUserByEmail));
authRoute.get(
  "/generateVerificationToken/:email",
  errorHandler(getVerificationToken)
);
authRoute.patch("/verify-email-user", errorHandler(getUserByIdAndVerifyEmail));

//email
authRoute.get(
  "/get-email-verification-user/:email",
  errorHandler(getVerificationTokenByEmail)
);
authRoute.get(
  "/get-emailVerification-token/:token",
  errorHandler(getVerificationTokenByToken)
);

authRoute.patch(
  "/update-verify-email-user",
  errorHandler(updateUserEmailVerification)
);
authRoute.delete(
  "/delete-email-verification/:id",
  errorHandler(deleteVerificationToken)
);

authRoute.get("/get-all-plans", errorHandler(getAllPlans));
authRoute.post("/subscribe-splan", isAuthMiddelware, errorHandler(buyPlan));

export default authRoute;
