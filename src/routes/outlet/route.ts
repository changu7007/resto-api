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
  deleteOrderItem,
  existingOrderPatch,
  existingOrderPatchApp,
  getAllActiveSessionOrders,
  getAllOrderByStaff,
  getAllOrders,
  getAllSessionOrders,
  getLiveOrders,
  getTableAllOrders,
  getTableAllSessionOrders,
  getTodayOrdersCount,
  orderessionBatchDelete,
  orderessionCancelPatch,
  orderessionDeleteById,
  orderessionNamePatch,
  orderessionPaymentModePatch,
  orderItemModification,
  orderStatusPatch,
  postOrderForOwner,
  postOrderForStaf,
  postOrderForUser,
} from "../../controllers/outlet/order/orderOutletController";
import {
  addItemToUserFav,
  deleteItem,
  getAddONById,
  getAddonsForTable,
  getAllItem,
  getCategoriesForTable,
  getItemById,
  getItemForTable,
  getMenuVariants,
  getShortCodeStatus,
  getSingleAddons,
  getVariantById,
  getVariantsForTable,
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
  getAllAreasForTable,
  getAllTables,
  getAllTablesForTable,
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
  cashFlowStats,
  getDashboardMetrics,
  getFinancialMetrics,
  getRevenueAndExpenses,
  lastSixMonthsOrders,
  orderStatsForOutlet,
  orderStatsForOutletByStaff,
  outletTopSellingItems,
  totalInventory,
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
  getStaffsForTable,
  updateStaff,
} from "../../controllers/outlet/staffs/staffController";
import {
  bulkUpdatePayrollStatus,
  getThisMonthPayroll,
  updatePayrollStatus,
} from "../../controllers/outlet/payroll/payrollController";
import {
  getAllCustomer,
  getCustomersForTable,
} from "../../controllers/outlet/customers/customerController";
import {
  createVendorAccount,
  fetchBankAccountStatus,
} from "../../controllers/outlet/plans/planController";
import {
  allStocks,
  allTableStocks,
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
  getAllTableItemRecipe,
  getAllTablePurcahses,
  getAllTableRawMaterialCategory,
  getAllTableRawMaterials,
  getAllTableRawMaterialUnit,
  getAllVendors,
  getCategoryById,
  getPurchaseId,
  getRawMaterialById,
  getRecipeById,
  getUnitById,
  restockPurchase,
  settlePayForRaisedPurchase,
  updateCategoryById,
  updateItemRecipe,
  updateRawMaterialById,
  updateRequestPurchase,
  updateStockRawMaterial,
  updateUnitById,
  updateVendor,
  validatePurchasenRestock,
} from "../../controllers/outlet/inventory/inventory-controller";
import {
  getDashboardInvite,
  InviteUserToDashboard,
  resendInvite,
  verifyInvite,
} from "../../controllers/auth/owner/appAuthController";
import {
  createExpenses,
  deleteExpenses,
  getAllExpensesForTable,
  getCategoryExpensesStats,
  updateExpenses,
} from "../../controllers/outlet/expenses/expenseController";

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
outletRoute.post(
  "/:outletId/get-table-staffs",
  isAuthMiddelware,
  errorHandler(getStaffsForTable)
);
outletRoute.post(
  "/:outletId/get-table-customers",
  isAuthMiddelware,
  errorHandler(getCustomersForTable)
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
  "/:outletId/order-item-patch/:orderId",
  isAuthMiddelware,
  errorHandler(orderItemModification)
);
outletRoute.delete(
  "/:outletId/order-item-delete/:orderItemId",
  isAuthMiddelware,
  errorHandler(deleteOrderItem)
);
outletRoute.patch(
  "/:outletId/app-add-orders/:orderId",
  isAuthMiddelware,
  errorHandler(existingOrderPatchApp)
);
outletRoute.patch(
  "/:outletId/order-session-update-payment/:id",
  isAuthMiddelware,
  errorHandler(orderessionPaymentModePatch)
);
outletRoute.patch(
  "/:outletId/order-session-update-name/:id",
  isAuthMiddelware,
  errorHandler(orderessionNamePatch)
);
outletRoute.patch(
  "/:outletId/order-session-cancel/:id",
  isAuthMiddelware,
  errorHandler(orderessionCancelPatch)
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

outletRoute.patch(
  "/:outletId/order-session-bulk-delete",
  isAuthMiddelware,
  errorHandler(orderessionBatchDelete)
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
outletRoute.post(
  "/:outletId/all-table-session-orders",
  isAuthMiddelware,
  errorHandler(getTableAllSessionOrders)
);
outletRoute.post(
  "/:outletId/all-table-orders",
  isAuthMiddelware,
  errorHandler(getTableAllOrders)
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
outletRoute.post(
  "/:outletId/get-table-items",
  isAuthMiddelware,
  errorHandler(getItemForTable)
);
outletRoute.post(
  "/:outletId/get-table-categories",
  isAuthMiddelware,
  errorHandler(getCategoriesForTable)
);
outletRoute.post(
  "/:outletId/get-table-variants",
  isAuthMiddelware,
  errorHandler(getVariantsForTable)
);
outletRoute.post(
  "/:outletId/get-table-addons",
  isAuthMiddelware,
  errorHandler(getAddonsForTable)
);
outletRoute.post(
  "/:outletId/add-to-fav",
  isAuthMiddelware,
  errorHandler(addItemToUserFav)
);
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
  "/:outletId/get-table-tables",
  isAuthMiddelware,
  errorHandler(getAllTablesForTable)
);
outletRoute.post(
  "/:outletId/get-table-areas",
  isAuthMiddelware,
  errorHandler(getAllAreasForTable)
);
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
  "/:outletId/get-cashflow-stats",
  isAuthMiddelware,
  errorHandler(cashFlowStats)
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
outletRoute.post(
  "/:outletId/get-monthly-payroll",
  errorHandler(getThisMonthPayroll)
);
outletRoute.patch(
  "/:outletId/staff-payroll-status/:id",
  isAuthMiddelware,
  errorHandler(updatePayrollStatus)
);
outletRoute.patch(
  "/:outletId/bulk-payroll-status",
  isAuthMiddelware,
  errorHandler(bulkUpdatePayrollStatus)
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
outletRoute.post(
  "/:outletId/inventory/get-table-raw-materials",
  isAuthMiddelware,
  errorHandler(getAllTableRawMaterials)
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
outletRoute.patch(
  "/:outletId/inventory/current-stock-update/:id",
  isAuthMiddelware,
  errorHandler(updateStockRawMaterial)
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
outletRoute.post(
  "/:outletId/inventory/get-table-raw-material-categories",
  isAuthMiddelware,
  errorHandler(getAllTableRawMaterialCategory)
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
outletRoute.post(
  "/:outletId/inventory/get-table-raw-material-units",
  isAuthMiddelware,
  errorHandler(getAllTableRawMaterialUnit)
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
outletRoute.post(
  "/:outletId/inventory/get-all-table-purchases",
  isAuthMiddelware,
  errorHandler(getAllTablePurcahses)
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
outletRoute.post(
  "/:outletId/inventory/validate-purchase-for-settlement/:id",
  isAuthMiddelware,
  errorHandler(restockPurchase)
);
outletRoute.post(
  "/:outletId/inventory/settle-validate-purchase/:id",
  isAuthMiddelware,
  errorHandler(settlePayForRaisedPurchase)
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
outletRoute.post(
  "/:outletId/inventory/get-all-table-stocks",
  isAuthMiddelware,
  errorHandler(allTableStocks)
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
outletRoute.post(
  "/:outletId/inventory/all-table-recipes",
  // isAuthMiddelware,
  errorHandler(getAllTableItemRecipe)
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

outletRoute.post(
  "/:outletId/post-invite-email",
  isAuthMiddelware,
  errorHandler(InviteUserToDashboard)
);
outletRoute.get(
  "/:outletId/get-invites",
  isAuthMiddelware,
  errorHandler(getDashboardInvite)
);
outletRoute.get("/:outletId/verify-invite/:token", errorHandler(verifyInvite));
outletRoute.patch(
  "/:outletId/update-expiry",
  isAuthMiddelware,
  errorHandler(resendInvite)
);

outletRoute.get(
  "/:outletId/get-inventory-stats",
  isAuthMiddelware,
  errorHandler(totalInventory)
);
outletRoute.get(
  "/:outletId/get-dashboard-metrics",
  isAuthMiddelware,
  errorHandler(getDashboardMetrics)
);
outletRoute.get(
  "/:outletId/get-revenue-and-expenses",
  isAuthMiddelware,
  errorHandler(getRevenueAndExpenses)
);
outletRoute.get(
  "/:outletId/get-financial",
  isAuthMiddelware,
  errorHandler(getFinancialMetrics)
);

//EXPENSES GET,CREATE START
outletRoute.post(
  "/:outletId/expenses/get-all-table-expenses",
  isAuthMiddelware,
  errorHandler(getAllExpensesForTable)
);
outletRoute.get(
  "/:outletId/expenses/get-category-stats-expenses",
  isAuthMiddelware,
  errorHandler(getCategoryExpensesStats)
);
outletRoute.post(
  "/:outletId/expenses/create-expense",
  isAuthMiddelware,
  errorHandler(createExpenses)
);
outletRoute.patch(
  "/:outletId/expenses/update-expense/:id",
  isAuthMiddelware,
  errorHandler(updateExpenses)
);
outletRoute.delete(
  "/:outletId/expenses/delete-expense/:id",
  isAuthMiddelware,
  errorHandler(deleteExpenses)
);
//EXPENSES GET,CREATE END

export default outletRoute;
