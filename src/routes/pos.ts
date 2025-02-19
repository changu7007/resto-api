import { Router } from "express";
import { errorHandler } from "../error-handler";
import { isAuthMiddelware } from "../middlewares/auth";
import {
  posGetRegisterStatus,
  posStaffCheckInAndRegister,
  posStaffCheckOut,
} from "../controllers/outlet/posController";

const posRoute: Router = Router();

posRoute.post(
  "/:outletId/register",
  isAuthMiddelware,
  errorHandler(posStaffCheckInAndRegister)
);

posRoute.post(
  "/:outletId/close-shift",
  isAuthMiddelware,
  errorHandler(posStaffCheckOut)
);

posRoute.get(
  "/:outletId/register-status",
  isAuthMiddelware,
  errorHandler(posGetRegisterStatus)
);

export default posRoute;
