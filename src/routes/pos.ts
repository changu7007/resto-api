import { Router } from "express";
import { errorHandler } from "../error-handler";
import { isAuthMiddelware } from "../middlewares/auth";
import {
  posGetRegisterStatus,
  posStaffCheckInAndRegister,
  posStaffCheckOut,
} from "../controllers/outlet/posController";
import {
  getInventoryAlerts,
  getPopularItems,
  getPosStats,
  getStaffPerformance,
} from "../controllers/outlet/stats/posStatsController";
import {
  getPOSTableAllOrders,
  getPOSTableAllSessionOrders,
} from "../controllers/outlet/order/posController";

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

posRoute.get(
  "/:outletId/pos-stats",
  isAuthMiddelware,
  errorHandler(getPosStats)
);

posRoute.get(
  "/:outletId/pos-stats/low-stock-items",
  isAuthMiddelware,
  errorHandler(getInventoryAlerts)
);

posRoute.get(
  "/:outletId/pos-stats/popular-items",
  isAuthMiddelware,
  errorHandler(getPopularItems)
);

posRoute.get(
  "/:outletId/pos-stats/staff-performance",
  isAuthMiddelware,
  errorHandler(getStaffPerformance)
);

posRoute.post(
  "/:outletId/pos-table/table-session-orders",
  isAuthMiddelware,
  errorHandler(getPOSTableAllSessionOrders)
);

posRoute.post(
  "/:outletId/pos-table/table-orders",
  isAuthMiddelware,
  errorHandler(getPOSTableAllOrders)
);

export default posRoute;
