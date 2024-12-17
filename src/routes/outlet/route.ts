import { Router } from "express";
import {
  addFMCTokenToOutlet,
  createInvoiceDetails,
  deleteAllNotifications,
  deleteNotificationById,
  deleteOutlet,
  fetchInvoiceDetails,
  getAllNotifications,
  getByOutletId,
  getIntegration,
  getrazorpayConfig,
  getStaffOutlet,
  patchOutletDetails,
  patchOutletOnlinePOrtalDetails,
  updateInvoiceDetails,
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
  getMenuVariants,
  getShortCodeStatus,
  getSingleAddons,
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
  lastSixMonthsOrders,
  orderStatsForOutlet,
  orderStatsForOutletByStaff,
  outletTopSellingItems,
} from "../../controllers/outlet/stats/statsController";
import {
  createSubDomain,
  deleteSite,
  getDomain,
} from "../../controllers/outlet/domains/domainController";
import {
  createStaff,
  deleteStaff,
  getAllStaffs,
  getStaffId,
  updateStaff,
} from "../../controllers/outlet/staffs/staffController";
import {
  getThisMonthPayroll,
  updatePayrollStatus,
} from "../../controllers/outlet/payroll/payrollController";
import { getAllCustomer } from "../../controllers/outlet/customers/customerController";
import {
  createVendorAccount,
  fetchBankAccountStatus,
} from "../../controllers/outlet/plans/planController";
import {
  allStocks,
  createItemRecipe,
  createRawMaterial,
  createRawMaterialCategory,
  createRequestPurchase,
  createUnit,
  createVendor,
  deleteCategoryById,
  deleteRawMaterialById,
  deleteRequestPurchase,
  deleteUnitById,
  deleteVendor,
  getAllItemRecipe,
  getAllPurcahses,
  getAllRawMaterialCategory,
  getAllRawMaterials,
  getAllRawMaterialUnit,
  getAllVendors,
  getCategoryById,
  getPurchaseId,
  getRawMaterialById,
  getRecipeById,
  getUnitById,
  updateCategoryById,
  updateItemRecipe,
  updateRawMaterialById,
  updateRequestPurchase,
  updateUnitById,
  updateVendor,
  validatePurchasenRestock,
} from "../../controllers/outlet/inventory/inventory-controller";

const outletRoute: Router = Router();

outletRoute.get(
  "/staff-outlet",
  isAuthMiddelware,
  errorHandler(getStaffOutlet)
);
outletRoute.get(
  "/:outletId/get-razorpay-config",
  isAuthMiddelware,
  errorHandler(getrazorpayConfig)
);
outletRoute.get("/:outletId", isAuthMiddelware, errorHandler(getByOutletId));
outletRoute.patch("/:outletId/add-fmc", errorHandler(addFMCTokenToOutlet));
outletRoute.get(
  "/:outletId/notifications",
  isAuthMiddelware,
  errorHandler(getAllNotifications)
);
outletRoute.delete(
  "/:outletId/delete-all-notification",
  errorHandler(deleteAllNotifications)
);
outletRoute.delete(
  "/:outletId/delete-notification/:id",
  errorHandler(deleteNotificationById)
);
outletRoute.delete(
  "/:outletId/delete-outlet",
  isAuthMiddelware,
  errorHandler(deleteOutlet)
);

//integration
outletRoute.get(
  "/:outletId/get-integrations",
  isAuthMiddelware,
  errorHandler(getIntegration)
);

outletRoute.post(
  "/:outletId/patch-online-hub",
  isAuthMiddelware,
  errorHandler(patchOutletOnlinePOrtalDetails)
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
outletRoute.get("/:outletId/get-menu-variants", errorHandler(getMenuVariants));
outletRoute.get("/:outletId/get-addons-items", errorHandler(getSingleAddons));
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
outletRoute.post(
  "/:outletId/check-short-code",
  errorHandler(getShortCodeStatus)
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
outletRoute.get(
  "/:outletId/get-last-six-orderstats",
  isAuthMiddelware,
  errorHandler(lastSixMonthsOrders)
);

//domains
outletRoute.get(
  "/:outletId/get-domain",
  isAuthMiddelware,
  errorHandler(getDomain)
);
outletRoute.post(
  "/:outletId/create-sub-domain",
  isAuthMiddelware,
  errorHandler(createSubDomain)
);

outletRoute.delete(
  "/:outletId/delete-domain-settings/:siteId",
  isAuthMiddelware,
  errorHandler(deleteSite)
);

//payroll
outletRoute.get(
  "/:outletId/get-monthly-payroll",
  errorHandler(getThisMonthPayroll)
);
outletRoute.patch(
  "/:outletId/staff-payroll-status/:id",
  isAuthMiddelware,
  errorHandler(updatePayrollStatus)
);

//customers
outletRoute.get(
  "/:outletId/get-customers",
  isAuthMiddelware,
  errorHandler(getAllCustomer)
);

//invoice
outletRoute.get(
  "/:outletId/get-invoice-data",
  isAuthMiddelware,
  errorHandler(fetchInvoiceDetails)
);

outletRoute.post(
  "/:outletId/create-invoice-data",
  isAuthMiddelware,
  errorHandler(createInvoiceDetails)
);

outletRoute.patch(
  "/:outletId/update-invoice-data",
  isAuthMiddelware,
  errorHandler(updateInvoiceDetails)
);

//create-vendor-account
outletRoute.post(
  "/:outletId/create-vendor-account",
  isAuthMiddelware,
  errorHandler(createVendorAccount)
);
outletRoute.get(
  "/:outletId/bank-account-status",
  isAuthMiddelware,
  errorHandler(fetchBankAccountStatus)
);

// Raw Material GETALL,GETBYID,POST,PATCH,DELETE START
outletRoute.get(
  "/:outletId/inventory/get-raw-materials",
  isAuthMiddelware,
  errorHandler(getAllRawMaterials)
);
outletRoute.get(
  "/:outletId/inventory/get-raw-materials/:id",
  isAuthMiddelware,
  errorHandler(getRawMaterialById)
);
outletRoute.post(
  "/:outletId/inventory/create-raw-material",
  isAuthMiddelware,
  errorHandler(createRawMaterial)
);

outletRoute.patch(
  "/:outletId/inventory/update-raw-material/:id",
  isAuthMiddelware,
  errorHandler(updateRawMaterialById)
);

outletRoute.delete(
  "/:outletId/inventory/delete-raw-material/:id",
  isAuthMiddelware,
  errorHandler(deleteRawMaterialById)
);
// Raw Material POST,PATCH,DELETE END

//Category GETALL,GETBYID,POST,PATCH,DELETE START

outletRoute.get(
  "/:outletId/inventory/get-raw-material-categories",
  isAuthMiddelware,
  errorHandler(getAllRawMaterialCategory)
);
outletRoute.get(
  "/:outletId/inventory/get-raw-material-categories/:categoryId",
  isAuthMiddelware,
  errorHandler(getCategoryById)
);

outletRoute.post(
  "/:outletId/inventory/create-raw-material-category",
  isAuthMiddelware,
  errorHandler(createRawMaterialCategory)
);

outletRoute.patch(
  "/:outletId/inventory/update-raw-material-category/:categoryId",
  isAuthMiddelware,
  errorHandler(updateCategoryById)
);

outletRoute.delete(
  "/:outletId/inventory/delete-raw-material-category/:categoryId",
  isAuthMiddelware,
  errorHandler(deleteCategoryById)
);
//Category POST,PATCH,DELETE END

//Unit GETALL,GETBYID,POST,PATCH,DELETE START
outletRoute.get(
  "/:outletId/inventory/get-raw-material-units",
  isAuthMiddelware,
  errorHandler(getAllRawMaterialUnit)
);
outletRoute.get(
  "/:outletId/inventory/get-raw-material-unit/:unitId",
  isAuthMiddelware,
  errorHandler(getUnitById)
);
outletRoute.post(
  "/:outletId/inventory/create-raw-material-unit",
  isAuthMiddelware,
  errorHandler(createUnit)
);

outletRoute.patch(
  "/:outletId/inventory/update-raw-material-unit/:unitId",
  isAuthMiddelware,
  errorHandler(updateUnitById)
);

outletRoute.delete(
  "/:outletId/inventory/delete-raw-material-unit/:unitId",
  isAuthMiddelware,
  errorHandler(deleteUnitById)
);
//Unit POST,PATCH,DELETE END

//Purchase GET,CREATE START
outletRoute.get(
  "/:outletId/inventory/get-all-purchases",
  isAuthMiddelware,
  errorHandler(getAllPurcahses)
);
outletRoute.get(
  "/:outletId/inventory/get-purchase/:id",
  isAuthMiddelware,
  errorHandler(getPurchaseId)
);
outletRoute.post(
  "/:outletId/inventory/create-request-purchase",
  isAuthMiddelware,
  errorHandler(createRequestPurchase)
);
outletRoute.patch(
  "/:outletId/inventory/update-request-purchase/:id",
  isAuthMiddelware,
  errorHandler(updateRequestPurchase)
);
outletRoute.delete(
  "/:outletId/inventory/delete-request-purchase/:id",
  isAuthMiddelware,
  errorHandler(deleteRequestPurchase)
);
outletRoute.post(
  "/:outletId/inventory/validate-purchase/:id",
  isAuthMiddelware,
  errorHandler(validatePurchasenRestock)
);
//PURCHASE GET,CREATE END

//Vendors GET,CREATE START
outletRoute.get(
  "/:outletId/inventory/get-all-vendors",
  isAuthMiddelware,
  errorHandler(getAllVendors)
);
outletRoute.post(
  "/:outletId/inventory/create-vendor",
  isAuthMiddelware,
  errorHandler(createVendor)
);
outletRoute.patch(
  "/:outletId/inventory/update-vendor/:id",
  isAuthMiddelware,
  errorHandler(updateVendor)
);
outletRoute.delete(
  "/:outletId/inventory/delete-vendor/:id",
  isAuthMiddelware,
  errorHandler(deleteVendor)
);
//Vendors GET,CREATE END
outletRoute.get(
  "/:outletId/inventory/get-all-stocks",
  isAuthMiddelware,
  errorHandler(allStocks)
);

//Item REcipe CREATE START
outletRoute.post(
  "/:outletId/inventory/create-item-recipe",
  isAuthMiddelware,
  errorHandler(createItemRecipe)
);
outletRoute.get(
  "/:outletId/inventory/all-recipes",
  isAuthMiddelware,
  errorHandler(getAllItemRecipe)
);
outletRoute.get(
  "/:outletId/inventory/get-recipe/:id",
  isAuthMiddelware,
  errorHandler(getRecipeById)
);
outletRoute.patch(
  "/:outletId/inventory/update-recipe/:id",
  isAuthMiddelware,
  errorHandler(updateItemRecipe)
);

export default outletRoute;
