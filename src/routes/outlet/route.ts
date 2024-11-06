import { Router } from "express";
import {
  addFMCTokenToOutlet,
  getAllNotifications,
  getByOutletId,
  getStaffOutlet,
  patchOutletDetails,
} from "../../controllers/outlet/outletController";
import { errorHandler } from "../../error-handler";
import { isAuthMiddelware } from "../../middlewares/auth";
import {
  existingOrderPatch,
  existingOrderPatchApp,
  getAllActiveSessionOrders,
  getAllOrderByStaff,
  getAllOrders,
  getAllSessionOrders,
  getLiveOrders,
  getTodayOrdersCount,
  orderStatusPatch,
  postOrderForOwner,
  postOrderForStaf,
  postOrderForUser,
} from "../../controllers/outlet/order/orderOutletController";
import {
  deleteItem,
  getAddONById,
  getAllItem,
  getItemById,
  getVariantById,
  postItem,
  updateItembyId,
} from "../../controllers/outlet/items/itemsController";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  updateCategory,
} from "../../controllers/outlet/categories/outletCategories";
import {
  connectTable,
  createArea,
  createTable,
  deleteArea,
  deleteTable,
  getAllAreas,
  getAllTables,
  getTableByUniqueId,
  getTableCurrentOrders,
  updateArea,
  updateTable,
  verifyTable,
} from "../../controllers/outlet/tables/outletTableController";
import { billingOrderSession } from "../../controllers/outlet/order/orderSession/orderSessionController";
import {
  createAddOn,
  deleteAddon,
  getAddon,
  updateAddon,
} from "../../controllers/outlet/addons/addonsController";
import {
  createVariant,
  deleteVariant,
  getVariants,
  updateVariant,
} from "../../controllers/outlet/variants/variantsController";
import { s3Upload } from "../../controllers/s3Upload";
import {
  orderStatsForOutlet,
  orderStatsForOutletByStaff,
  outletTopSellingItems,
} from "../../controllers/outlet/stats/statsController";
import { getDomain } from "../../controllers/outlet/domains/domainController";
import {
  createStaff,
  deleteStaff,
  getAllStaffs,
  getStaffId,
  updateStaff,
} from "../../controllers/outlet/staffs/staffController";
import { getThisMonthPayroll } from "../../controllers/outlet/payroll/payrollController";

const outletRoute: Router = Router();

outletRoute.get(
  "/staff-outlet",
  isAuthMiddelware,
  errorHandler(getStaffOutlet)
);
outletRoute.get("/:outletId", isAuthMiddelware, errorHandler(getByOutletId));
outletRoute.patch("/:outletId/add-fmc", errorHandler(addFMCTokenToOutlet));
outletRoute.get(
  "/:outletId/notifications",
  isAuthMiddelware,
  errorHandler(getAllNotifications)
);
//staff
outletRoute.get("/:outletId/get-staffs", errorHandler(getAllStaffs));
outletRoute.get(
  "/:outletId/get-staff/:staffId",
  isAuthMiddelware,
  errorHandler(getStaffId)
);
outletRoute.post(
  "/:outletId/create-staff",
  isAuthMiddelware,
  errorHandler(createStaff)
);
outletRoute.patch(
  "/:outletId/update-staff/:staffId",
  isAuthMiddelware,
  errorHandler(updateStaff)
);
outletRoute.patch(
  "/:outletId/outlet-personal",
  isAuthMiddelware,
  errorHandler(patchOutletDetails)
);

outletRoute.delete(
  "/:outletId/delete-staff/:staffId",
  isAuthMiddelware,
  errorHandler(deleteStaff)
);

//Orders Routes
outletRoute.post(
  "/:outletId/staff-post-order",
  isAuthMiddelware,
  errorHandler(postOrderForStaf)
);
outletRoute.post(
  "/:outletId/app-post-order",
  isAuthMiddelware,
  errorHandler(postOrderForOwner)
);
outletRoute.post(
  "/:outletId/user-post-order",
  isAuthMiddelware,
  errorHandler(postOrderForUser)
);
outletRoute.patch(
  "/:outletId/add-orders/:orderId",
  isAuthMiddelware,
  errorHandler(existingOrderPatch)
);
outletRoute.patch(
  "/:outletId/app-add-orders/:orderId",
  isAuthMiddelware,
  errorHandler(existingOrderPatchApp)
);
outletRoute.patch(
  "/:outletId/orders/:orderId",
  isAuthMiddelware,
  errorHandler(orderStatusPatch)
);
outletRoute.patch(
  "/:outletId/orderSession/:orderSessionId",
  isAuthMiddelware,
  errorHandler(billingOrderSession)
);
outletRoute.get(
  "/:outletId/today-order-count",
  errorHandler(getTodayOrdersCount)
);
outletRoute.get("/:outletId/live-orders", errorHandler(getLiveOrders));
outletRoute.get(
  "/:outletId/all-orders",
  isAuthMiddelware,
  errorHandler(getAllOrders)
);
outletRoute.get(
  "/:outletId/active-session-orders",
  errorHandler(getAllActiveSessionOrders)
);
outletRoute.get(
  "/:outletId/all-session-orders",
  errorHandler(getAllSessionOrders)
);
outletRoute.get(
  "/:outletId/all-staff-orders",
  isAuthMiddelware,
  errorHandler(getAllOrderByStaff)
);
outletRoute.get(
  "/:outletId/table/:tableId/customer/:customerId",
  isAuthMiddelware,
  errorHandler(getTableCurrentOrders)
);

//Items Route
outletRoute.post(
  "/:outletId/create-item",
  isAuthMiddelware,
  errorHandler(postItem)
);
outletRoute.get("/:outletId/get-items", errorHandler(getAllItem));
outletRoute.get("/:outletId/get-categories", errorHandler(getAllCategories));
outletRoute.get(
  "/:outletId/items/:itemId",
  isAuthMiddelware,
  errorHandler(getItemById)
);
outletRoute.patch(
  "/:outletId/items/:itemId",
  isAuthMiddelware,
  errorHandler(updateItembyId)
);
outletRoute.delete(
  "/:outletId/items/:itemId",
  isAuthMiddelware,
  errorHandler(deleteItem)
);

//categories
outletRoute.post(
  "/:outletId/create-category",
  isAuthMiddelware,
  errorHandler(createCategory)
);
outletRoute.patch(
  "/:outletId/category/:categoryId",
  isAuthMiddelware,
  errorHandler(updateCategory)
);
outletRoute.delete(
  "/:outletId/category/:categoryId",
  isAuthMiddelware,
  errorHandler(deleteCategory)
);

//adons & Variants
outletRoute.get("/:outletId/get-addons", errorHandler(getAddon));
outletRoute.get("/:outletId/get-variants", errorHandler(getVariants));
outletRoute.get(
  "/:outletId/variants/:variantId",
  isAuthMiddelware,
  errorHandler(getVariantById)
);
outletRoute.get(
  "/:outletId/addons/:addOnId",
  isAuthMiddelware,
  errorHandler(getAddONById)
);
outletRoute.patch(
  "/:outletId/variants/:variantId",
  isAuthMiddelware,
  errorHandler(updateVariant)
);
outletRoute.delete(
  "/:outletId/variants/:variantId",
  isAuthMiddelware,
  errorHandler(deleteVariant)
);
outletRoute.post(
  "/:outletId/create-variant",
  isAuthMiddelware,
  errorHandler(createVariant)
);
outletRoute.patch(
  "/:outletId/addons/:addOnId",
  isAuthMiddelware,
  errorHandler(updateAddon)
);
outletRoute.delete(
  "/:outletId/addons/:addOnId",
  isAuthMiddelware,
  errorHandler(deleteAddon)
);
outletRoute.post(
  "/:outletId/create-addon",
  isAuthMiddelware,
  errorHandler(createAddOn)
);

//aws
outletRoute.post("/s3-upload", isAuthMiddelware, errorHandler(s3Upload));

//area-table
outletRoute.get("/:outletId/tables", errorHandler(getAllTables));
outletRoute.get("/:outletId/areas", errorHandler(getAllAreas));
outletRoute.post(
  "/:outletId/create-table",
  isAuthMiddelware,
  errorHandler(createTable)
);
outletRoute.patch(
  "/:outletId/update-table/:tableId",
  isAuthMiddelware,
  errorHandler(updateTable)
);

outletRoute.delete(
  "/:outletId/delete-table/:tableId",
  isAuthMiddelware,
  errorHandler(deleteTable)
);
outletRoute.post(
  "/:outletId/create-area",
  isAuthMiddelware,
  errorHandler(createArea)
);
outletRoute.get(
  "/:outletId/get-table/:uniqueId",
  errorHandler(getTableByUniqueId)
);

outletRoute.post("/:outletId/verify-table/:tableId", errorHandler(verifyTable));

outletRoute.post(
  "/:outletId/connect-table/:tableId",
  errorHandler(connectTable)
);

outletRoute.patch(
  "/:outletId/update-area/:areaId",
  isAuthMiddelware,
  errorHandler(updateArea)
);

outletRoute.delete(
  "/:outletId/delete-area/:areaId",
  isAuthMiddelware,
  errorHandler(deleteArea)
);

//stats
outletRoute.get(
  "/:outletId/get-outlet-stats",
  isAuthMiddelware,
  errorHandler(orderStatsForOutlet)
);
outletRoute.get(
  "/:outletId/get-staff-outlet-stats",
  isAuthMiddelware,
  errorHandler(orderStatsForOutletByStaff)
);
outletRoute.get(
  "/:outletId/get-outlet-top-items",
  isAuthMiddelware,
  errorHandler(outletTopSellingItems)
);

//domains
outletRoute.get(
  "/:outletId/get-domain",
  isAuthMiddelware,
  errorHandler(getDomain)
);

//payroll
outletRoute.get(
  "/:outletId/get-monthly-payroll",
  errorHandler(getThisMonthPayroll)
);

export default outletRoute;
