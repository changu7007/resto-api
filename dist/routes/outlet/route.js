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
const outletRoute = (0, express_1.Router)();
outletRoute.get("/staff-outlet", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getStaffOutlet));
outletRoute.get("/:outletId/get-razorpay-config", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getrazorpayConfig));
outletRoute.get("/:outletId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getByOutletId));
outletRoute.patch("/:outletId/add-fmc", (0, error_handler_1.errorHandler)(outletController_1.addFMCTokenToOutlet));
outletRoute.get("/:outletId/notifications", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getAllNotifications));
outletRoute.delete("/:outletId/delete-all-notification", (0, error_handler_1.errorHandler)(outletController_1.deleteAllNotifications));
outletRoute.delete("/:outletId/delete-notification/:id", (0, error_handler_1.errorHandler)(outletController_1.deleteNotificationById));
outletRoute.delete("/:outletId/delete-outlet", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.deleteOutlet));
//integration
outletRoute.get("/:outletId/get-integrations", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getIntegration));
outletRoute.post("/:outletId/patch-online-hub", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.patchOutletOnlinePOrtalDetails));
//staff
outletRoute.get("/:outletId/get-staffs", (0, error_handler_1.errorHandler)(staffController_1.getAllStaffs));
outletRoute.get("/:outletId/get-staff/:staffId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.getStaffId));
outletRoute.post("/:outletId/create-staff", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.createStaff));
outletRoute.patch("/:outletId/update-staff/:staffId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.updateStaff));
outletRoute.patch("/:outletId/outlet-personal", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.patchOutletDetails));
outletRoute.delete("/:outletId/delete-staff/:staffId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(staffController_1.deleteStaff));
//Orders Routes
outletRoute.post("/:outletId/staff-post-order", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.postOrderForStaf));
outletRoute.post("/:outletId/app-post-order", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.postOrderForOwner));
outletRoute.post("/:outletId/user-post-order", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.postOrderForUser));
outletRoute.patch("/:outletId/add-orders/:orderId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.existingOrderPatch));
outletRoute.patch("/:outletId/app-add-orders/:orderId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.existingOrderPatchApp));
outletRoute.patch("/:outletId/order-session-update-payment/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.orderessionPaymentModePatch));
outletRoute.patch("/:outletId/orders/:orderId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.orderStatusPatch));
outletRoute.patch("/:outletId/orderSession/:orderSessionId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderSessionController_1.billingOrderSession));
outletRoute.delete("/:outletId/order-session-delete/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.orderessionDeleteById));
outletRoute.patch("/:outletId/order-session-bulk-delete", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.orderessionBatchDelete));
outletRoute.get("/:outletId/today-order-count", (0, error_handler_1.errorHandler)(orderOutletController_1.getTodayOrdersCount));
outletRoute.get("/:outletId/live-orders", (0, error_handler_1.errorHandler)(orderOutletController_1.getLiveOrders));
outletRoute.get("/:outletId/all-orders", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.getAllOrders));
outletRoute.get("/:outletId/active-session-orders", (0, error_handler_1.errorHandler)(orderOutletController_1.getAllActiveSessionOrders));
outletRoute.get("/:outletId/all-session-orders", (0, error_handler_1.errorHandler)(orderOutletController_1.getAllSessionOrders));
outletRoute.get("/:outletId/all-staff-orders", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.getAllOrderByStaff));
outletRoute.get("/:outletId/table/:tableId/customer/:customerId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.getTableCurrentOrders));
//Items Route
outletRoute.post("/:outletId/create-item", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.postItem));
outletRoute.get("/:outletId/get-items", (0, error_handler_1.errorHandler)(itemsController_1.getAllItem));
outletRoute.post("/:outletId/add-to-fav", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.addItemToUserFav));
outletRoute.get("/:outletId/get-categories", (0, error_handler_1.errorHandler)(outletCategories_1.getAllCategories));
outletRoute.get("/:outletId/get-menu-variants", (0, error_handler_1.errorHandler)(itemsController_1.getMenuVariants));
outletRoute.get("/:outletId/get-addons-items", (0, error_handler_1.errorHandler)(itemsController_1.getSingleAddons));
outletRoute.get("/:outletId/items/:itemId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.getItemById));
outletRoute.patch("/:outletId/items/:itemId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.updateItembyId));
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
outletRoute.post("/:outletId/create-table", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletTableController_1.createTable));
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
//domains
outletRoute.get("/:outletId/get-domain", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(domainController_1.getDomain));
outletRoute.post("/:outletId/create-sub-domain", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(domainController_1.createSubDomain));
outletRoute.delete("/:outletId/delete-domain-settings/:siteId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(domainController_1.deleteSite));
//payroll
outletRoute.get("/:outletId/get-monthly-payroll", (0, error_handler_1.errorHandler)(payrollController_1.getThisMonthPayroll));
outletRoute.patch("/:outletId/staff-payroll-status/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(payrollController_1.updatePayrollStatus));
outletRoute.patch("/:outletId/bulk-payroll-status", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(payrollController_1.bulkUpdatePayrollStatus));
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
outletRoute.get("/:outletId/inventory/get-raw-materials/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getRawMaterialById));
outletRoute.post("/:outletId/inventory/create-raw-material", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createRawMaterial));
outletRoute.patch("/:outletId/inventory/update-raw-material/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateRawMaterialById));
outletRoute.delete("/:outletId/inventory/delete-raw-material/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.deleteRawMaterialById));
// Raw Material POST,PATCH,DELETE END
//Category GETALL,GETBYID,POST,PATCH,DELETE START
outletRoute.get("/:outletId/inventory/get-raw-material-categories", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllRawMaterialCategory));
outletRoute.get("/:outletId/inventory/get-raw-material-categories/:categoryId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getCategoryById));
outletRoute.post("/:outletId/inventory/create-raw-material-category", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createRawMaterialCategory));
outletRoute.patch("/:outletId/inventory/update-raw-material-category/:categoryId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateCategoryById));
outletRoute.delete("/:outletId/inventory/delete-raw-material-category/:categoryId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.deleteCategoryById));
//Category POST,PATCH,DELETE END
//Unit GETALL,GETBYID,POST,PATCH,DELETE START
outletRoute.get("/:outletId/inventory/get-raw-material-units", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllRawMaterialUnit));
outletRoute.get("/:outletId/inventory/get-raw-material-unit/:unitId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getUnitById));
outletRoute.post("/:outletId/inventory/create-raw-material-unit", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createUnit));
outletRoute.patch("/:outletId/inventory/update-raw-material-unit/:unitId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateUnitById));
outletRoute.delete("/:outletId/inventory/delete-raw-material-unit/:unitId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.deleteUnitById));
//Unit POST,PATCH,DELETE END
//Purchase GET,CREATE START
outletRoute.get("/:outletId/inventory/get-all-purchases", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllPurcahses));
outletRoute.get("/:outletId/inventory/get-purchase/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getPurchaseId));
outletRoute.post("/:outletId/inventory/create-request-purchase", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createRequestPurchase));
outletRoute.patch("/:outletId/inventory/update-request-purchase/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateRequestPurchase));
outletRoute.delete("/:outletId/inventory/delete-request-purchase/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.deleteRequestPurchase));
outletRoute.post("/:outletId/inventory/validate-purchase/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.validatePurchasenRestock));
//PURCHASE GET,CREATE END
//Vendors GET,CREATE START
outletRoute.get("/:outletId/inventory/get-all-vendors", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllVendors));
outletRoute.post("/:outletId/inventory/create-vendor", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createVendor));
outletRoute.patch("/:outletId/inventory/update-vendor/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateVendor));
outletRoute.delete("/:outletId/inventory/delete-vendor/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.deleteVendor));
//Vendors GET,CREATE END
outletRoute.get("/:outletId/inventory/get-all-stocks", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.allStocks));
//Item REcipe CREATE START
outletRoute.post("/:outletId/inventory/create-item-recipe", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.createItemRecipe));
outletRoute.get("/:outletId/inventory/all-recipes", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getAllItemRecipe));
outletRoute.get("/:outletId/inventory/get-recipe/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.getRecipeById));
outletRoute.patch("/:outletId/inventory/update-recipe/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(inventory_controller_1.updateItemRecipe));
outletRoute.post("/:outletId/post-invite-email", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(appAuthController_1.InviteUserToDashboard));
outletRoute.get("/:outletId/get-invites", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(appAuthController_1.getDashboardInvite));
outletRoute.get("/:outletId/verify-invite/:token", (0, error_handler_1.errorHandler)(appAuthController_1.verifyInvite));
outletRoute.patch("/:outletId/update-expiry", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(appAuthController_1.resendInvite));
outletRoute.get("/:outletId/get-inventory-stats", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.totalInventory));
outletRoute.get("/:outletId/get-dashboard-metrics", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.getDashboardMetrics));
outletRoute.get("/:outletId/get-revenue-and-expenses", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.getRevenueAndExpenses));
outletRoute.get("/:outletId/get-financial", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.getFinancialMetrics));
exports.default = outletRoute;
