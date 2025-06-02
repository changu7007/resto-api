"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const outletController_1 = require("../../controllers/outlet/outletController");
const error_handler_1 = require("../../error-handler");
const auth_1 = require("../../middlewares/auth");
const orderOutletController_1 = require("../../controllers/outlet/order/orderOutletController");
const itemsController_1 = require("../../controllers/outlet/items/itemsController");
const outletCategories_1 = require("../../controllers/outlet/categories/outletCategories");
const outletTableController_1 = require("../../controllers/outlet/tables/outletTableController");
const orderSessionController_1 = require("../../controllers/outlet/order/orderSession/orderSessionController");
const addonsController_1 = require("../../controllers/outlet/addons/addonsController");
const variantsController_1 = require("../../controllers/outlet/variants/variantsController");
const s3Upload_1 = require("../../controllers/s3Upload");
const statsController_1 = require("../../controllers/outlet/stats/statsController");
const domainController_1 = require("../../controllers/outlet/domains/domainController");
const staffController_1 = require("../../controllers/outlet/staffs/staffController");
const payrollController_1 = require("../../controllers/outlet/payroll/payrollController");
const customerController_1 = require("../../controllers/outlet/customers/customerController");
const planController_1 = require("../../controllers/outlet/plans/planController");
const inventory_controller_1 = require("../../controllers/outlet/inventory/inventory-controller");
const appAuthController_1 = require("../../controllers/auth/owner/appAuthController");
const expenseController_1 = require("../../controllers/outlet/expenses/expenseController");
const alert_controleer_1 = require("../../controllers/outlet/alerts/alert-controleer");
const reports_controller_1 = require("../../controllers/outlet/reports/reports-controller");
const staff_order_controller_1 = require("../../controllers/outlet/order/staff-order-controller");
const staffs_items_controller_1 = require("../../controllers/outlet/items/staffs-items-controller");
const registerController_1 = require("../../controllers/outlet/cash-registers/registerController");
const adminRegisterController_1 = require("../../controllers/outlet/cash-registers/adminRegisterController");
const printer_controller_1 = require("../../controllers/outlet/printers/printer-controller");
const staffController_2 = require("../../controllers/outlet/staffs/staffController");
const aiMenuController_1 = require("../../controllers/outlet/items/aiMenuController");
const loyaltyController_1 = require("../../controllers/outlet/loyalty/loyaltyController");
const intergation_controller_1 = require("../../controllers/outlet/integration/intergation-controller");
const outletPhonePeController_1 = require("../../controllers/outlet/plans/outletPhonePeController");
const outletRoute = (0, express_1.Router)();
outletRoute.get("/get-all-outlets", (0, error_handler_1.errorHandler)(outletController_1.getAllOutlets));
outletRoute.get("/:outletId/get-admin-register-status", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(registerController_1.getAdminRegisterStatus));
outletRoute.patch("/:outletId/update-outlet-type", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.updateOutletType));
outletRoute.get("/staff-outlet", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getStaffOutlet));
outletRoute.get("/pos-staff-outlet", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getPOSStaffOutlet));
outletRoute.get("/:outletId/get-razorpay-config", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getrazorpayConfig));
outletRoute.post("/:outletId/create-outlet-from-copy", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.createOutletFromOutletHub));
outletRoute.get("/:outletId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getByOutletId));
outletRoute.patch("/:outletId/add-fmc", (0, error_handler_1.errorHandler)(outletController_1.addFMCTokenToOutlet));
outletRoute.get("/:outletId/notifications", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getAllNotifications));
outletRoute.delete("/:outletId/delete-all-notification", (0, error_handler_1.errorHandler)(outletController_1.deleteAllNotifications));
outletRoute.delete("/:outletId/delete-notification/:id", (0, error_handler_1.errorHandler)(outletController_1.deleteNotificationById));
outletRoute.delete("/:outletId/delete-outlet", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.deleteOutlet));
//integration
outletRoute.get("/:outletId/get-integrations", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getIntegration));
outletRoute.post("/:outletId/patch-online-hub", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.patchOutletOnlinePOrtalDetails));
outletRoute.post("/:outletId/update-operating-hours", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.updateOrCreateOperatingHours));
outletRoute.patch("/:outletId/online-portal-status", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.updateOnlinePortalStatus));
//staff
outletRoute.post("/:outletId/accept-order-from-prime", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staff_order_controller_1.acceptOrderFromPrime));
outletRoute.get("/:outletId/get-staffs", (0, error_handler_1.errorHandler)(staffController_1.getAllStaffs));
outletRoute.get("/:outletId/get-staff/:staffId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.getStaffId));
outletRoute.post("/:outletId/create-staff", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.createStaff));
outletRoute.post("/:outletId/get-table-staffs", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.getStaffsForTable));
outletRoute.post("/:outletId/get-table-customers", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(customerController_1.getCustomersForTable));
outletRoute.patch("/:outletId/update-staff/:staffId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.updateStaff));
outletRoute.patch("/:outletId/outlet-personal", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.patchOutletDetails));
outletRoute.delete("/:outletId/delete-staff/:staffId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.deleteStaff));
//staff order
outletRoute.get("/:outletId/staff-live-orders", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staff_order_controller_1.getByStaffLiveOrders));
outletRoute.get("/:outletId/staff-order-stats", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staff_order_controller_1.getStaffOrderStats));
outletRoute.get("/:outletId/staff-recent-ten-orders", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staff_order_controller_1.getStaffOrdersRecentTenOrders));
outletRoute.get("/:outletId/staff-all-orders", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staff_order_controller_1.getByStaffAllOrders));
outletRoute.patch("/:outletId/staff-order-item-patch/:orderId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staff_order_controller_1.orderItemModificationByStaff));
outletRoute.patch("/:outletId/staff-order-status-patch/:orderId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staff_order_controller_1.orderStatusPatchByStaff));
outletRoute.post("/:outletId/get-staff-attendance", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.getStaffAttendance));
//online and delivery
outletRoute.get("/:outletId/online-and-delivery-items", 
// isAuthMiddelware,
(0, error_handler_1.errorHandler)(itemsController_1.getItemsByCategoryForOnlineAndDelivery));
outletRoute.get("/:outletId/online-and-delivery-categories", 
// isAuthMiddelware,
(0, error_handler_1.errorHandler)(outletCategories_1.getAllDomainCategories));
outletRoute.get("/:outletId/veg-online-and-delivery-items", 
// isAuthMiddelware,
(0, error_handler_1.errorHandler)(itemsController_1.getVegItemsForOnlineAndDelivery));
outletRoute.get("/:outletId/online-and-delivery-items-search", 
// isAuthMiddelware,
(0, error_handler_1.errorHandler)(itemsController_1.getItemsBySearchForOnlineAndDelivery));
outletRoute.get("/:outletId/online-and-delivery-all-items", 
// isAuthMiddelware,
(0, error_handler_1.errorHandler)(itemsController_1.getItemsForOnlineAndDelivery));
//staff items
outletRoute.get("/:outletId/staff-favorite-menu", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffs_items_controller_1.getStaffFavoriteMenu));
outletRoute.post("/:outletId/staff-favorite-menu", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffs_items_controller_1.addStaffFavoriteMenu));
outletRoute.delete("/:outletId/staff-favorite-menu/:itemId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffs_items_controller_1.removeStaffFavoriteMenu));
//Orders Routes
outletRoute.post("/:outletId/staff-post-order", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staff_order_controller_1.postOrderForStaf));
outletRoute.post("/:outletId/app-post-order", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.postOrderForOwner));
outletRoute.post("/:outletId/user-post-order", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.postOrderForUser));
outletRoute.patch("/:outletId/add-existing-orders-staff/:orderId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staff_order_controller_1.existingOrderPatchForStaff));
outletRoute.patch("/:outletId/order-item-patch/:orderId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.orderItemModification));
outletRoute.delete("/:outletId/order-item-delete/:orderItemId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.deleteOrderItem));
outletRoute.patch("/:outletId/app-add-orders/:orderId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.existingOrderPatchApp));
outletRoute.patch("/:outletId/order-session-update-payment/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.orderessionPaymentModePatch));
outletRoute.patch("/:outletId/order-session-update-name/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.orderessionNamePatch));
outletRoute.patch("/:outletId/order-session-cancel/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.orderessionCancelPatch));
outletRoute.patch("/:outletId/orders/:orderId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.orderStatusPatch));
outletRoute.patch("/:outletId/orderSession/:orderSessionId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderSessionController_1.billingOrderSession));
outletRoute.patch("/:outletId/complete-orderSession/:orderSessionId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderSessionController_1.completebillingOrderSession));
outletRoute.patch("/:outletId/order-session-bulk-delete", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.orderessionBatchDelete));
outletRoute.get("/:outletId/today-order-count", (0, error_handler_1.errorHandler)(orderOutletController_1.getTodayOrdersCount));
outletRoute.get("/:outletId/live-orders", (0, error_handler_1.errorHandler)(orderOutletController_1.getLiveOrders));
outletRoute.get("/:outletId/active-session-orders", (0, error_handler_1.errorHandler)(orderOutletController_1.getAllActiveSessionOrders));
outletRoute.get("/:outletId/active-staff-session-orders", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.getAllActiveStaffSessionOrders));
outletRoute.post("/:outletId/all-table-session-orders", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.getTableAllSessionOrders));
outletRoute.post("/:outletId/all-table-orders", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.getTableAllOrders));
outletRoute.get("/:outletId/all-staff-orders", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.getAllOrderByStaff));
outletRoute.get("/:outletId/table/:tableId/customer/:customerId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.getTableCurrentOrders));
outletRoute.post("/:outletId/assign-tables-to-staff", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_2.assignTablesForWaiters));
outletRoute.get("/:outletId/get-tables-assigned-to-waiters/:staffId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.getTablesAssignedToWaiters));
outletRoute.patch("/:outletId/bulk-pos-access-enable", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.bulkPosAccessEnable));
outletRoute.patch("/:outletId/bulk-pos-access-disable", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.bulkPosAccessDisable));
//Items Route
outletRoute.post("/:outletId/create-item", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.postItem));
outletRoute.post("/:outletId/ai-generate-menu", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(aiMenuController_1.generateMenuFromImage));
outletRoute.post("/:outletId/duplicate-item/:itemId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.duplicateItem));
outletRoute.get("/:outletId/get-items", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.getAllItem));
outletRoute.get("/:outletId/menu-items", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.getItemsByCategory));
outletRoute.get("/:outletId/menu-items-search", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.getItemsBySearch));
outletRoute.post("/:outletId/get-table-items", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.getItemForTable));
outletRoute.post("/:outletId/get-table-categories", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.getCategoriesForTable));
outletRoute.post("/:outletId/get-table-variants", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.getVariantsForTable));
outletRoute.post("/:outletId/get-table-addons", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.getAddonsForTable));
outletRoute.post("/:outletId/add-to-fav", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.addItemToUserFav));
outletRoute.get("/:outletId/get-categories", (0, error_handler_1.errorHandler)(outletCategories_1.getAllCategories));
outletRoute.get("/:outletId/get-menu-variants", (0, error_handler_1.errorHandler)(itemsController_1.getMenuVariants));
outletRoute.get("/:outletId/get-addons-items", (0, error_handler_1.errorHandler)(itemsController_1.getSingleAddons));
outletRoute.get("/:outletId/items/:itemId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.getItemById));
outletRoute.patch("/:outletId/items/:itemId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.updateItembyId));
outletRoute.patch("/:outletId/items/:itemId/enable-pos", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.enablePosStatus));
outletRoute.patch("/:outletId/items/:itemId/enable-online", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.enableOnline));
outletRoute.patch("/:outletId/items/:itemId/disable-online", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.disableOnline));
outletRoute.patch("/:outletId/items/:itemId/enable-featured", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.enableFeaturedStatus));
outletRoute.patch("/:outletId/items/:itemId/enable-in-stock", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.enableInStockStatus));
outletRoute.patch("/:outletId/items/:itemId/disable-featured", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.disableFeaturedStatus));
outletRoute.patch("/:outletId/items/:itemId/disable-in-stock", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.disableInStockStatus));
outletRoute.patch("/:outletId/items/:itemId/disable-pos", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.disablePosStatus));
outletRoute.delete("/:outletId/items/:itemId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.deleteItem));
outletRoute.post("/:outletId/check-short-code", (0, error_handler_1.errorHandler)(itemsController_1.getShortCodeStatus));
//categories
outletRoute.post("/:outletId/create-category", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletCategories_1.createCategory));
outletRoute.patch("/:outletId/category/:categoryId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletCategories_1.updateCategory));
outletRoute.delete("/:outletId/category/:categoryId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletCategories_1.deleteCategory));
//adons & Variants
outletRoute.get("/:outletId/get-addons", (0, error_handler_1.errorHandler)(addonsController_1.getAddon));
outletRoute.get("/:outletId/get-variants", (0, error_handler_1.errorHandler)(variantsController_1.getVariants));
outletRoute.get("/:outletId/variants/:variantId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.getVariantById));
outletRoute.get("/:outletId/addons/:addOnId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.getAddONById));
outletRoute.patch("/:outletId/variants/:variantId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(variantsController_1.updateVariant));
outletRoute.delete("/:outletId/variants/:variantId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(variantsController_1.deleteVariant));
outletRoute.post("/:outletId/create-variant", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(variantsController_1.createVariant));
outletRoute.patch("/:outletId/addons/:addOnId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(addonsController_1.updateAddon));
outletRoute.delete("/:outletId/addons/:addOnId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(addonsController_1.deleteAddon));
outletRoute.post("/:outletId/create-addon", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(addonsController_1.createAddOn));
//aws
outletRoute.post("/s3-upload", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(s3Upload_1.s3Upload));
//area-table
outletRoute.get("/:outletId/tables", (0, error_handler_1.errorHandler)(outletTableController_1.getAllTables));
outletRoute.get("/:outletId/areas", (0, error_handler_1.errorHandler)(outletTableController_1.getAllAreas));
outletRoute.post("/:outletId/get-table-tables", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.getAllTablesForTable));
outletRoute.post("/:outletId/get-table-areas", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.getAllAreasForTable));
outletRoute.post("/:outletId/create-table", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.createTable));
outletRoute.post("/:outletId/create-bulk-tables", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.createBulkTables));
outletRoute.patch("/:outletId/update-table/:tableId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.updateTable));
outletRoute.delete("/:outletId/delete-table/:tableId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.deleteTable));
outletRoute.post("/:outletId/create-area", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.createArea));
outletRoute.get("/:outletId/get-table/:uniqueId", (0, error_handler_1.errorHandler)(outletTableController_1.getTableByUniqueId));
outletRoute.post("/:outletId/verify-table/:tableId", (0, error_handler_1.errorHandler)(outletTableController_1.verifyTable));
outletRoute.post("/:outletId/connect-table/:tableId", (0, error_handler_1.errorHandler)(outletTableController_1.connectTable));
outletRoute.patch("/:outletId/update-area/:areaId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.updateArea));
outletRoute.delete("/:outletId/delete-area/:areaId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.deleteArea));
//stats
outletRoute.get("/:outletId/get-outlet-stats", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.orderStatsForOutlet));
outletRoute.get("/:outletId/get-cashflow-stats", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.cashFlowStats));
outletRoute.get("/:outletId/get-staff-outlet-stats", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.orderStatsForOutletByStaff));
outletRoute.get("/:outletId/get-outlet-top-items", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.outletTopSellingItems));
outletRoute.get("/:outletId/get-last-six-orderstats", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.lastSixMonthsOrders));
outletRoute.get("/:outletId/get-expense-metrics", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.expenseMetrics));
outletRoute.get("/:outletId/get-hour-wise-order-metrics", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.getOrderHourWise));
outletRoute.get("/:outletId/get-category-order-contribution", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.getCategoryContributionStats));
outletRoute.post("/:outletId/create-report", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(reports_controller_1.createReport));
outletRoute.post("/:outletId/get-table-report", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(reports_controller_1.getReportsForTable));
//domains
outletRoute.get("/:outletId/check-domain", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(domainController_1.checkDomain));
outletRoute.get("/:outletId/get-domain", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(domainController_1.getDomain));
outletRoute.post("/:outletId/create-sub-domain", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(domainController_1.createSubDomain));
outletRoute.delete("/:outletId/delete-domain-settings/:siteId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(domainController_1.deleteSite));
//payroll
outletRoute.post("/:outletId/get-monthly-payroll", (0, error_handler_1.errorHandler)(payrollController_1.getThisMonthPayroll));
outletRoute.patch("/:outletId/staff-payroll-status/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(payrollController_1.updatePayrollStatus));
outletRoute.patch("/:outletId/bulk-payroll-status", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(payrollController_1.bulkUpdatePayrollStatus));
outletRoute.get("/:outletId/get-staff-ids", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.getStaffIds));
//customers
outletRoute.get("/:outletId/get-customers", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(customerController_1.getAllCustomer));
//invoice
outletRoute.get("/:outletId/get-invoice-data", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.fetchInvoiceDetails));
outletRoute.post("/:outletId/create-invoice-data", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.createInvoiceDetails));
outletRoute.patch("/:outletId/update-invoice-data", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.updateInvoiceDetails));
//create-vendor-account
outletRoute.post("/:outletId/create-vendor-account", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(planController_1.createVendorAccount));
outletRoute.get("/:outletId/bank-account-status", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(planController_1.fetchBankAccountStatus));
// Raw Material GETALL,GETBYID,POST,PATCH,DELETE START
outletRoute.get("/:outletId/inventory/get-raw-materials", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllRawMaterials));
outletRoute.post("/:outletId/inventory/get-table-raw-materials", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllTableRawMaterials));
outletRoute.get("/:outletId/inventory/get-raw-materials/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getRawMaterialById));
outletRoute.post("/:outletId/inventory/create-raw-material", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createRawMaterial));
outletRoute.patch("/:outletId/inventory/update-raw-material/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateRawMaterialById));
outletRoute.patch("/:outletId/inventory/current-stock-update/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateStockRawMaterial));
outletRoute.delete("/:outletId/inventory/delete-raw-material/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.deleteRawMaterialById));
// Raw Material POST,PATCH,DELETE END
//Category GETALL,GETBYID,POST,PATCH,DELETE START
outletRoute.get("/:outletId/inventory/get-raw-material-categories", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllRawMaterialCategory));
outletRoute.post("/:outletId/inventory/get-table-raw-material-categories", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllTableRawMaterialCategory));
outletRoute.get("/:outletId/inventory/get-raw-material-categories/:categoryId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getCategoryById));
outletRoute.post("/:outletId/inventory/create-raw-material-category", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createRawMaterialCategory));
outletRoute.patch("/:outletId/inventory/update-raw-material-category/:categoryId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateCategoryById));
outletRoute.delete("/:outletId/inventory/delete-raw-material-category/:categoryId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.deleteCategoryById));
//Category POST,PATCH,DELETE END
//Unit GETALL,GETBYID,POST,PATCH,DELETE START
outletRoute.get("/:outletId/inventory/get-raw-material-units", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllRawMaterialUnit));
outletRoute.post("/:outletId/inventory/get-table-raw-material-units", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllTableRawMaterialUnit));
outletRoute.get("/:outletId/inventory/get-raw-material-unit/:unitId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getUnitById));
outletRoute.post("/:outletId/inventory/create-raw-material-unit", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createUnit));
outletRoute.patch("/:outletId/inventory/update-raw-material-unit/:unitId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateUnitById));
outletRoute.delete("/:outletId/inventory/delete-raw-material-unit/:unitId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.deleteUnitById));
//Unit POST,PATCH,DELETE END
//Vendor Categories GET,CREATE START
outletRoute.get("/:outletId/inventory/get-all-vendor-categories", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllVendorCategories));
outletRoute.post("/:outletId/inventory/vendor-category", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createVendorCategory));
outletRoute.post("/:outletId/inventory/get-all-vendors-for-table", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllVendorsForTable));
//Purchase GET,CREATE START
outletRoute.get("/:outletId/inventory/get-all-purchases", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllPurcahses));
outletRoute.post("/:outletId/inventory/get-all-settled-purchases", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllSettledTablePurcahses));
outletRoute.post("/:outletId/inventory/get-all-completed-purchases", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllCompletedTablePurcahses));
outletRoute.post("/:outletId/inventory/get-all-requested-purchases", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllRequestedTablePurcahses));
outletRoute.get("/:outletId/inventory/get-purchase/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getPurchaseId));
outletRoute.post("/:outletId/inventory/create-request-purchase", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createRequestPurchase));
outletRoute.post("/:outletId/inventory/raise-request-purchase", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createRaiseRequestPurchase));
outletRoute.patch("/:outletId/inventory/update-request-purchase/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateRequestPurchase));
outletRoute.delete("/:outletId/inventory/delete-request-purchase/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.deleteRequestPurchase));
outletRoute.patch("/:outletId/inventory/cancel-request-purchase/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.cancelRequestPurchase));
outletRoute.post("/:outletId/inventory/validate-purchase/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.validatePurchasenRestock));
outletRoute.post("/:outletId/inventory/validate-purchase-for-settlement/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.restockPurchase));
outletRoute.post("/:outletId/inventory/settle-validate-purchase/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.settlePayForRaisedPurchase));
//PURCHASE GET,CREATE END
//Vendors GET,CREATE START
outletRoute.get("/:outletId/inventory/get-all-vendors", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllVendors));
outletRoute.post("/:outletId/inventory/create-vendor", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createVendor));
outletRoute.patch("/:outletId/inventory/update-vendor/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateVendor));
outletRoute.delete("/:outletId/inventory/delete-vendor/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.deleteVendor));
//Vendors GET,CREATE END
outletRoute.get("/:outletId/inventory/get-all-stocks", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.allStocks));
outletRoute.post("/:outletId/inventory/get-all-table-stocks", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.allTableStocks));
//Item REcipe CREATE START
outletRoute.post("/:outletId/inventory/create-item-recipe", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createItemRecipe));
outletRoute.get("/:outletId/inventory/all-recipes", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllItemRecipe));
outletRoute.post("/:outletId/inventory/all-table-recipes", 
// isAuthMiddelware,
(0, error_handler_1.errorHandler)(inventory_controller_1.getAllTableItemRecipe));
outletRoute.get("/:outletId/inventory/get-recipe/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getRecipeById));
outletRoute.patch("/:outletId/inventory/update-recipe/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateItemRecipe));
outletRoute.delete("/:outletId/inventory/delete-recipe/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.deleteItemRecipe));
outletRoute.post("/:outletId/post-invite-email", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(appAuthController_1.InviteUserToDashboard));
outletRoute.get("/:outletId/get-invites", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(appAuthController_1.getDashboardInvite));
outletRoute.get("/:outletId/verify-invite/:token", (0, error_handler_1.errorHandler)(appAuthController_1.verifyInvite));
outletRoute.patch("/:outletId/update-expiry", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(appAuthController_1.resendInvite));
outletRoute.get("/:outletId/get-inventory-stats", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.totalInventory));
outletRoute.get("/:outletId/get-dashboard-metrics", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.getDashboardMetrics));
outletRoute.get("/:outletId/get-revenue-and-expenses", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.getRevenueAndExpenses));
outletRoute.get("/:outletId/get-financial", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.getFinancialMetrics));
//EXPENSES GET,CREATE START
outletRoute.post("/:outletId/expenses/get-all-table-expenses", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(expenseController_1.getAllExpensesForTable));
outletRoute.get("/:outletId/expenses/get-category-stats-expenses", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(expenseController_1.getCategoryExpensesStats));
outletRoute.post("/:outletId/expenses/create-expense", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(expenseController_1.createExpenses));
outletRoute.patch("/:outletId/expenses/update-expense/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(expenseController_1.updateExpenses));
outletRoute.delete("/:outletId/expenses/delete-expense/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(expenseController_1.deleteExpenses));
//EXPENSES GET,CREATE END
//Alerts Start GET
outletRoute.get("/:outletId/alerts/get-all-alerts", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(alert_controleer_1.getAlerts));
outletRoute.patch("/:outletId/alerts/acknowledge", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(alert_controleer_1.acknowledgeAlert));
//Cash Register
outletRoute.get("/:outletId/cash-registers", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(registerController_1.getAllCashRegisters));
outletRoute.get("/:outletId/transactions", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(registerController_1.getTransactionHistory));
outletRoute.post("/:outletId/admin-register/open", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(adminRegisterController_1.openAdminRegister));
outletRoute.post("/:outletId/admin-register/:registerId/close", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(adminRegisterController_1.closeAdminRegister));
outletRoute.get("/:outletId/admin-register/status", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(registerController_1.getAdminRegisterStatus));
outletRoute.post("/:outletId/admin-register/record-income", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(registerController_1.recordIncome));
outletRoute.get("/:outletId/admin-register/transactions-for-register", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(registerController_1.getTransactionHistoryForRegister));
//Printers
outletRoute.post("/:outletId/printers/create-printer", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.createPrinter));
outletRoute.get("/:outletId/printers", 
// isAuthMiddelware,
(0, error_handler_1.errorHandler)(printer_controller_1.getPrinters));
outletRoute.get("/:outletId/printers/:printerId", 
// isAuthMiddelware,
(0, error_handler_1.errorHandler)(printer_controller_1.getPrinterById));
outletRoute.patch("/:outletId/printers/update-printer/:printerId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.updatePrinter));
outletRoute.delete("/:outletId/printers/delete-printer/:printerId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.deletePrinter));
//Printers Location
outletRoute.post("/:outletId/printers/create-print-location", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.createPrintLocation));
outletRoute.get("/:outletId/locations/get-print-locations", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.getPrintLocations));
outletRoute.patch("/:outletId/printers/update-print-location/:locationId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.updatePrintLocation));
outletRoute.delete("/:outletId/printers/delete-print-location/:locationId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.deletePrintLocation));
outletRoute.post("/:outletId/printers/locations/:locationId/assign", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.assignPrinterToLocation));
outletRoute.get("/:outletId/print-locations", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.getPrintLocationsByTypesForApp));
outletRoute.get("/:outletId/pos/print-locations", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.getPrintLocationsByTypes));
outletRoute.get("/:outletId/printers/location/:locationId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.getPrintersForLocation));
outletRoute.post("/:outletId/print/tcp", (0, error_handler_1.errorHandler)(printer_controller_1.printTCP));
outletRoute.get("/:outletId/order-item/:orderItemId/parent-order", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.getParentOrder));
outletRoute.get("/:outletId/settings/print-access", 
// isAuthMiddelware,
(0, error_handler_1.errorHandler)(outletController_1.getLocalPrintSetup));
outletRoute.patch("/:outletId/tables/:tableId/unoccupied", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.markTableAsUnoccupied));
outletRoute.patch("/:outletId/tables/:tableId/transfer", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.transferTableOrder));
outletRoute.post("/:outletId/print-details", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.createPrintDetails));
outletRoute.patch("/:outletId/print-details", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(printer_controller_1.updatePrintDetails));
outletRoute.get("/:outletId/print-details", 
// isAuthMiddelware,
(0, error_handler_1.errorHandler)(printer_controller_1.getPrintDetails));
outletRoute.patch("/:outletId/print-details/update-local-print-url", (0, error_handler_1.errorHandler)(printer_controller_1.updateLocalPrintUrl));
outletRoute.get("/:outletId/get-todays-cash-transactions", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.getTodaysTransaction));
// Overview routes
outletRoute.get("/:restaurantId/loyalty/overview", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(loyaltyController_1.getLoyaltyOverview));
// Program routes
outletRoute.get("/:restaurantId/loyalty/programs", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(loyaltyController_1.getLoyaltyPrograms));
outletRoute.post("/:restaurantId/loyalty/programs", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(loyaltyController_1.createLoyaltyProgram));
outletRoute.patch("/:restaurantId/loyalty/programs/:programId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(loyaltyController_1.updateLoyaltyProgram));
outletRoute.delete("/:restaurantId/loyalty/programs/:programId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(loyaltyController_1.deleteLoyaltyProgram));
// Customer routes
outletRoute.get("/:restaurantId/loyalty/customers", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(loyaltyController_1.getLoyaltyCustomers));
outletRoute.post("/:restaurantId/loyalty/customers", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(loyaltyController_1.addCustomerToLoyaltyProgram));
outletRoute.post("/:restaurantId/loyalty/customers/award-points", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(loyaltyController_1.awardPointsToCustomer));
// Campaign routes
outletRoute.get("/:restaurantId/loyalty/campaigns", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(loyaltyController_1.getCampaigns));
outletRoute.post("/:restaurantId/loyalty/campaigns", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(loyaltyController_1.createCampaign));
outletRoute.get("/:outletId/search-customers", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(customerController_1.searchCustomers));
outletRoute.post("/:outletId/create-customers", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(customerController_1.createCustomer));
outletRoute.patch("/:outletId/app-integration-phonepe", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(intergation_controller_1.phonePeDetails));
outletRoute.post("/:outletId/outlet-phonepe", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletPhonePeController_1.createDomainPhonePeOrder));
outletRoute.get("/:outletId/check-phonepe-status", (0, error_handler_1.errorHandler)(outletPhonePeController_1.orderAmountPhoneCheck));
outletRoute.post("/:outletId/pos-phonepe", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletPhonePeController_1.posOutletPhonePeOrder));
outletRoute.get("/:outletId/check-pos-phonepe-status", (0, error_handler_1.errorHandler)(outletPhonePeController_1.posAmountPhoneCheck));
outletRoute.get("/:outletId/item-serves/:recipeId", (0, error_handler_1.errorHandler)(inventory_controller_1.calculateItemServes));
outletRoute.patch("/:outletId/order-session/:orderSessionId/assign-customer", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderSessionController_1.assignCustomerToOrder));
outletRoute.post("/:outletId/verify-franchise-domain", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(domainController_1.verifyFranchiseCode));
outletRoute.post("/:outletId/link-franchise-domain", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(domainController_1.linkFranchiseDomain));
outletRoute.patch("/:outletId/unlink-franchise-domain/:siteId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(domainController_1.unlinkDomainForRestaurant));
outletRoute.post("/:outletId/pos-generate-report", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(reports_controller_1.posGenerateReport));
outletRoute.post("/:outletId/clear-phonepe-cache", 
// isAuthMiddelware,
(0, error_handler_1.errorHandler)(outletPhonePeController_1.clearPhonePeCache));
exports.default = outletRoute;
