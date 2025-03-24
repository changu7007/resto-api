import { Router } from "express";
import {
  addFMCTokenToOutlet,
  createInvoiceDetails,
  createOutletFromOutletHub,
  deleteAllNotifications,
  deleteNotificationById,
  deleteOutlet,
  fetchInvoiceDetails,
  getAllNotifications,
  getAllOutlets,
  getByOutletId,
  getIntegration,
  getLocalPrintSetup,
  getPOSStaffOutlet,
  getrazorpayConfig,
  getStaffOutlet,
  patchOutletDetails,
  patchOutletOnlinePOrtalDetails,
  updateInvoiceDetails,
  updateOnlinePortalStatus,
  updateOrCreateOperatingHours,
  updateOutletType,
} from "../../controllers/outlet/outletController";
import { errorHandler } from "../../error-handler";
import { isAuthMiddelware } from "../../middlewares/auth";
import {
  deleteOrderItem,
  existingOrderPatchApp,
  getAllActiveSessionOrders,
  getAllOrderByStaff,
  getLiveOrders,
  getParentOrder,
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
  postOrderForUser,
} from "../../controllers/outlet/order/orderOutletController";
import {
  addItemToUserFav,
  deleteItem,
  disablePosStatus,
  duplicateItem,
  enablePosStatus,
  getAddONById,
  getAddonsForTable,
  getAllItem,
  getCategoriesForTable,
  getItemById,
  getItemForTable,
  getItemsByCategory,
  getItemsByCategoryForOnlineAndDelivery,
  getItemsBySearch,
  getItemsBySearchForOnlineAndDelivery,
  getItemsForOnlineAndDelivery,
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
  markTableAsUnoccupied,
  transferTableOrder,
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
  expenseMetrics,
  getCategoryContributionStats,
  getDashboardMetrics,
  getFinancialMetrics,
  getOrderHourWise,
  getRevenueAndExpenses,
  lastSixMonthsOrders,
  orderStatsForOutlet,
  orderStatsForOutletByStaff,
  outletTopSellingItems,
  totalInventory,
} from "../../controllers/outlet/stats/statsController";
import {
  checkDomain,
  createSubDomain,
  deleteSite,
  getDomain,
} from "../../controllers/outlet/domains/domainController";
import {
  bulkPosAccessDisable,
  bulkPosAccessEnable,
  createStaff,
  deleteStaff,
  getAllStaffs,
  getStaffAttendance,
  getStaffId,
  getStaffIds,
  getStaffsForTable,
  getTablesAssignedToWaiters,
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
  cancelRequestPurchase,
  createItemRecipe,
  createRaiseRequestPurchase,
  createRawMaterial,
  createRawMaterialCategory,
  createRequestPurchase,
  createUnit,
  createVendor,
  createVendorCategory,
  deleteCategoryById,
  deleteItemRecipe,
  deleteRawMaterialById,
  deleteRequestPurchase,
  deleteUnitById,
  deleteVendor,
  getAllCompletedTablePurcahses,
  getAllItemRecipe,
  getAllPurcahses,
  getAllRawMaterialCategory,
  getAllRawMaterials,
  getAllRawMaterialUnit,
  getAllRequestedTablePurcahses,
  getAllSettledTablePurcahses,
  getAllTableItemRecipe,
  getAllTableRawMaterialCategory,
  getAllTableRawMaterials,
  getAllTableRawMaterialUnit,
  getAllVendorCategories,
  getAllVendors,
  getAllVendorsForTable,
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
import {
  acknowledgeAlert,
  getAlerts,
} from "../../controllers/outlet/alerts/alert-controleer";
import {
  createReport,
  getReportsForTable,
} from "../../controllers/outlet/reports/reports-controller";
import {
  existingOrderPatchForStaff,
  getByStaffAllOrders,
  getByStaffLiveOrders,
  getStaffOrdersRecentTenOrders,
  getStaffOrderStats,
  orderItemModificationByStaff,
  orderStatusPatchByStaff,
  postOrderForStaf,
  acceptOrderFromPrime,
} from "../../controllers/outlet/order/staff-order-controller";
import {
  addStaffFavoriteMenu,
  getStaffFavoriteMenu,
  removeStaffFavoriteMenu,
} from "../../controllers/outlet/items/staffs-items-controller";
import {
  getAdminRegisterStatus,
  getAllCashRegisters,
  getTransactionHistory,
  getTransactionHistoryForRegister,
  recordIncome,
} from "../../controllers/outlet/cash-registers/registerController";
import {
  openAdminRegister,
  closeAdminRegister,
} from "../../controllers/outlet/cash-registers/adminRegisterController";
import {
  assignPrinterToLocation,
  createPrintDetails,
  createPrinter,
  createPrintLocation,
  deletePrinter,
  deletePrintLocation,
  getPrintDetails,
  getPrinterById,
  getPrinters,
  getPrintersForLocation,
  getPrintLocations,
  getPrintLocationsByTypes,
  getPrintLocationsByTypesForApp,
  printBill,
  printKOT,
  printTCP,
  updatePrintDetails,
  updatePrinter,
  updatePrintLocation,
} from "../../controllers/outlet/printers/printer-controller";
import { assignTablesForWaiters } from "../../controllers/outlet/staffs/staffController";
const outletRoute: Router = Router();

outletRoute.get("/get-all-outlets", errorHandler(getAllOutlets));
outletRoute.get(
  "/:outletId/get-admin-register-status",
  isAuthMiddelware,
  errorHandler(getAdminRegisterStatus)
);

outletRoute.patch(
  "/:outletId/update-outlet-type",
  isAuthMiddelware,
  errorHandler(updateOutletType)
);

outletRoute.get(
  "/staff-outlet",
  isAuthMiddelware,
  errorHandler(getStaffOutlet)
);
outletRoute.get(
  "/pos-staff-outlet",
  isAuthMiddelware,
  errorHandler(getPOSStaffOutlet)
);
outletRoute.get(
  "/:outletId/get-razorpay-config",
  isAuthMiddelware,
  errorHandler(getrazorpayConfig)
);
outletRoute.post(
  "/:outletId/create-outlet-from-copy",
  isAuthMiddelware,
  errorHandler(createOutletFromOutletHub)
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

outletRoute.post(
  "/:outletId/update-operating-hours",
  isAuthMiddelware,
  errorHandler(updateOrCreateOperatingHours)
);

outletRoute.patch(
  "/:outletId/online-portal-status",
  isAuthMiddelware,
  errorHandler(updateOnlinePortalStatus)
);

//staff
outletRoute.post(
  "/:outletId/accept-order-from-prime",
  isAuthMiddelware,
  errorHandler(acceptOrderFromPrime)
);

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

//staff order
outletRoute.get(
  "/:outletId/staff-live-orders",
  isAuthMiddelware,
  errorHandler(getByStaffLiveOrders)
);

outletRoute.get(
  "/:outletId/staff-order-stats",
  isAuthMiddelware,
  errorHandler(getStaffOrderStats)
);

outletRoute.get(
  "/:outletId/staff-recent-ten-orders",
  isAuthMiddelware,
  errorHandler(getStaffOrdersRecentTenOrders)
);

outletRoute.get(
  "/:outletId/staff-all-orders",
  isAuthMiddelware,
  errorHandler(getByStaffAllOrders)
);

outletRoute.patch(
  "/:outletId/staff-order-item-patch/:orderId",
  isAuthMiddelware,
  errorHandler(orderItemModificationByStaff)
);

outletRoute.patch(
  "/:outletId/staff-order-status-patch/:orderId",
  isAuthMiddelware,
  errorHandler(orderStatusPatchByStaff)
);

outletRoute.post(
  "/:outletId/get-staff-attendance",
  isAuthMiddelware,
  errorHandler(getStaffAttendance)
);

//online and delivery
outletRoute.get(
  "/:outletId/online-and-delivery-items",
  // isAuthMiddelware,
  errorHandler(getItemsByCategoryForOnlineAndDelivery)
);

outletRoute.get(
  "/:outletId/online-and-delivery-items-search",
  // isAuthMiddelware,
  errorHandler(getItemsBySearchForOnlineAndDelivery)
);

outletRoute.get(
  "/:outletId/online-and-delivery-all-items",
  // isAuthMiddelware,
  errorHandler(getItemsForOnlineAndDelivery)
);

//staff items
outletRoute.get(
  "/:outletId/staff-favorite-menu",
  isAuthMiddelware,
  errorHandler(getStaffFavoriteMenu)
);
outletRoute.post(
  "/:outletId/staff-favorite-menu",
  isAuthMiddelware,
  errorHandler(addStaffFavoriteMenu)
);
outletRoute.delete(
  "/:outletId/staff-favorite-menu/:itemId",
  isAuthMiddelware,
  errorHandler(removeStaffFavoriteMenu)
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
  "/:outletId/add-existing-orders-staff/:orderId",
  isAuthMiddelware,
  errorHandler(existingOrderPatchForStaff)
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
  "/:outletId/active-session-orders",
  errorHandler(getAllActiveSessionOrders)
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

outletRoute.post(
  "/:outletId/assign-tables-to-staff",
  isAuthMiddelware,
  errorHandler(assignTablesForWaiters)
);

outletRoute.get(
  "/:outletId/get-tables-assigned-to-waiters/:staffId",
  isAuthMiddelware,
  errorHandler(getTablesAssignedToWaiters)
);

outletRoute.patch(
  "/:outletId/bulk-pos-access-enable",
  isAuthMiddelware,
  errorHandler(bulkPosAccessEnable)
);
outletRoute.patch(
  "/:outletId/bulk-pos-access-disable",
  isAuthMiddelware,
  errorHandler(bulkPosAccessDisable)
);
//Items Route
outletRoute.post(
  "/:outletId/create-item",
  isAuthMiddelware,
  errorHandler(postItem)
);
outletRoute.post(
  "/:outletId/duplicate-item/:itemId",
  isAuthMiddelware,
  errorHandler(duplicateItem)
);
outletRoute.get(
  "/:outletId/get-items",
  isAuthMiddelware,
  errorHandler(getAllItem)
);
outletRoute.get(
  "/:outletId/menu-items",
  isAuthMiddelware,
  errorHandler(getItemsByCategory)
);
outletRoute.get(
  "/:outletId/menu-items-search",
  isAuthMiddelware,
  errorHandler(getItemsBySearch)
);
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
outletRoute.patch(
  "/:outletId/items/:itemId/enable-pos",
  isAuthMiddelware,
  errorHandler(enablePosStatus)
);
outletRoute.patch(
  "/:outletId/items/:itemId/disable-pos",
  isAuthMiddelware,
  errorHandler(disablePosStatus)
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
outletRoute.get(
  "/:outletId/get-expense-metrics",
  isAuthMiddelware,
  errorHandler(expenseMetrics)
);
outletRoute.get(
  "/:outletId/get-hour-wise-order-metrics",
  isAuthMiddelware,
  errorHandler(getOrderHourWise)
);

outletRoute.get(
  "/:outletId/get-category-order-contribution",
  isAuthMiddelware,
  errorHandler(getCategoryContributionStats)
);
outletRoute.post(
  "/:outletId/create-report",
  isAuthMiddelware,
  errorHandler(createReport)
);
outletRoute.post(
  "/:outletId/get-table-report",
  isAuthMiddelware,
  errorHandler(getReportsForTable)
);

//domains
outletRoute.get(
  "/:outletId/check-domain",
  isAuthMiddelware,
  errorHandler(checkDomain)
);
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
outletRoute.get(
  "/:outletId/get-staff-ids",
  isAuthMiddelware,
  errorHandler(getStaffIds)
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

//Vendor Categories GET,CREATE START
outletRoute.get(
  "/:outletId/inventory/get-all-vendor-categories",
  isAuthMiddelware,
  errorHandler(getAllVendorCategories)
);

outletRoute.post(
  "/:outletId/inventory/vendor-category",
  isAuthMiddelware,
  errorHandler(createVendorCategory)
);

outletRoute.post(
  "/:outletId/inventory/get-all-vendors-for-table",
  isAuthMiddelware,
  errorHandler(getAllVendorsForTable)
);

//Purchase GET,CREATE START
outletRoute.get(
  "/:outletId/inventory/get-all-purchases",
  isAuthMiddelware,
  errorHandler(getAllPurcahses)
);
outletRoute.post(
  "/:outletId/inventory/get-all-settled-purchases",
  isAuthMiddelware,
  errorHandler(getAllSettledTablePurcahses)
);
outletRoute.post(
  "/:outletId/inventory/get-all-completed-purchases",
  isAuthMiddelware,
  errorHandler(getAllCompletedTablePurcahses)
);
outletRoute.post(
  "/:outletId/inventory/get-all-requested-purchases",
  isAuthMiddelware,
  errorHandler(getAllRequestedTablePurcahses)
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
outletRoute.post(
  "/:outletId/inventory/raise-request-purchase",
  isAuthMiddelware,
  errorHandler(createRaiseRequestPurchase)
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
outletRoute.patch(
  "/:outletId/inventory/cancel-request-purchase/:id",
  isAuthMiddelware,
  errorHandler(cancelRequestPurchase)
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
outletRoute.delete(
  "/:outletId/inventory/delete-recipe/:id",
  isAuthMiddelware,
  errorHandler(deleteItemRecipe)
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

//Alerts Start GET

outletRoute.get(
  "/:outletId/alerts/get-all-alerts",
  isAuthMiddelware,
  errorHandler(getAlerts)
);
outletRoute.patch(
  "/:outletId/alerts/acknowledge",
  isAuthMiddelware,
  errorHandler(acknowledgeAlert)
);

//Cash Register
outletRoute.get(
  "/:outletId/cash-registers",
  isAuthMiddelware,
  errorHandler(getAllCashRegisters)
);

outletRoute.get(
  "/:outletId/transactions",
  isAuthMiddelware,
  errorHandler(getTransactionHistory)
);

outletRoute.post(
  "/:outletId/admin-register/open",
  isAuthMiddelware,
  errorHandler(openAdminRegister)
);

outletRoute.post(
  "/:outletId/admin-register/:registerId/close",
  isAuthMiddelware,
  errorHandler(closeAdminRegister)
);

outletRoute.get(
  "/:outletId/admin-register/status",
  isAuthMiddelware,
  errorHandler(getAdminRegisterStatus)
);

outletRoute.post(
  "/:outletId/admin-register/record-income",
  isAuthMiddelware,
  errorHandler(recordIncome)
);

outletRoute.get(
  "/:outletId/admin-register/transactions-for-register",
  isAuthMiddelware,
  errorHandler(getTransactionHistoryForRegister)
);

//Printers
outletRoute.post(
  "/:outletId/printers/create-printer",
  isAuthMiddelware,
  errorHandler(createPrinter)
);

outletRoute.get(
  "/:outletId/printers",
  isAuthMiddelware,
  errorHandler(getPrinters)
);

outletRoute.get(
  "/:outletId/printers/:printerId",
  isAuthMiddelware,
  errorHandler(getPrinterById)
);

outletRoute.patch(
  "/:outletId/printers/update-printer/:printerId",
  isAuthMiddelware,
  errorHandler(updatePrinter)
);

outletRoute.delete(
  "/:outletId/printers/delete-printer/:printerId",
  isAuthMiddelware,
  errorHandler(deletePrinter)
);

//Printers Location
outletRoute.post(
  "/:outletId/printers/create-print-location",
  isAuthMiddelware,
  errorHandler(createPrintLocation)
);

outletRoute.get(
  "/:outletId/locations/get-print-locations",
  isAuthMiddelware,
  errorHandler(getPrintLocations)
);

outletRoute.patch(
  "/:outletId/printers/update-print-location/:locationId",
  isAuthMiddelware,
  errorHandler(updatePrintLocation)
);

outletRoute.delete(
  "/:outletId/printers/delete-print-location/:locationId",
  isAuthMiddelware,
  errorHandler(deletePrintLocation)
);

outletRoute.post(
  "/:outletId/printers/locations/:locationId/assign",
  isAuthMiddelware,
  errorHandler(assignPrinterToLocation)
);

outletRoute.get(
  "/:outletId/print-locations",
  isAuthMiddelware,
  errorHandler(getPrintLocationsByTypesForApp)
);

outletRoute.get(
  "/:outletId/pos/print-locations",
  isAuthMiddelware,
  errorHandler(getPrintLocationsByTypes)
);

outletRoute.get(
  "/:outletId/printers/location/:locationId",
  isAuthMiddelware,
  errorHandler(getPrintersForLocation)
);

outletRoute.post(
  "/:outletId/print/kot",
  isAuthMiddelware,
  errorHandler(printKOT)
);

outletRoute.post(
  "/:outletId/print/bill",
  isAuthMiddelware,
  errorHandler(printBill)
);

outletRoute.post("/:outletId/print/tcp", errorHandler(printTCP));

outletRoute.get(
  "/:outletId/order-item/:orderItemId/parent-order",
  isAuthMiddelware,
  errorHandler(getParentOrder)
);

outletRoute.get(
  "/:outletId/settings/print-access",
  isAuthMiddelware,
  errorHandler(getLocalPrintSetup)
);

outletRoute.patch(
  "/:outletId/tables/:tableId/unoccupied",
  isAuthMiddelware,
  errorHandler(markTableAsUnoccupied)
);

outletRoute.patch(
  "/:outletId/tables/:tableId/transfer",
  isAuthMiddelware,
  errorHandler(transferTableOrder)
);

outletRoute.post(
  "/:outletId/print-details",
  isAuthMiddelware,
  errorHandler(createPrintDetails)
);

outletRoute.patch(
  "/:outletId/print-details",
  isAuthMiddelware,
  errorHandler(updatePrintDetails)
);

outletRoute.get(
  "/:outletId/print-details",
  isAuthMiddelware,
  errorHandler(getPrintDetails)
);

export default outletRoute;
