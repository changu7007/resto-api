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
const outletRoute = (0, express_1.Router)();
outletRoute.get("/staff-outlet", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getStaffOutlet));
outletRoute.get("/:outletId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getByOutletId));
outletRoute.patch("/:outletId/add-fmc", (0, error_handler_1.errorHandler)(outletController_1.addFMCTokenToOutlet));
outletRoute.get("/:outletId/notifications", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.getAllNotifications));
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
outletRoute.patch("/:outletId/orders/:orderId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderOutletController_1.orderStatusPatch));
outletRoute.patch("/:outletId/orderSession/:orderSessionId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(orderSessionController_1.billingOrderSession));
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
outletRoute.get("/:outletId/get-categories", (0, error_handler_1.errorHandler)(outletCategories_1.getAllCategories));
outletRoute.get("/:outletId/items/:itemId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.getItemById));
outletRoute.patch("/:outletId/items/:itemId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.updateItembyId));
outletRoute.delete("/:outletId/items/:itemId", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(itemsController_1.deleteItem));
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
outletRoute.get("/:outletId/get-staff-outlet-stats", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.orderStatsForOutletByStaff));
outletRoute.get("/:outletId/get-outlet-top-items", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.outletTopSellingItems));
outletRoute.get("/:outletId/get-last-six-orderstats", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(statsController_1.lastSixMonthsOrders));
//domains
outletRoute.get("/:outletId/get-domain", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(domainController_1.getDomain));
outletRoute.post("/:outletId/create-sub-domain", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(domainController_1.createSubDomain));
//payroll
outletRoute.get("/:outletId/get-monthly-payroll", (0, error_handler_1.errorHandler)(payrollController_1.getThisMonthPayroll));
outletRoute.patch("/:outletId/staff-payroll-status/:id", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(payrollController_1.updatePayrollStatus));
//customers
outletRoute.get("/:outletId/get-customers", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(customerController_1.getAllCustomer));
//invoice
outletRoute.get("/:outletId/get-invoice-data", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.fetchInvoiceDetails));
outletRoute.post("/:outletId/create-invoice-data", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.createInvoiceDetails));
outletRoute.patch("/:outletId/update-invoice-data", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(outletController_1.updateInvoiceDetails));
exports.default = outletRoute;
