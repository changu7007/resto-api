"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const error_handler_1 = require("../../error-handler");
const onboardingController_1 = require("../../controllers/outlet/onboarding/onboardingController");
const planController_1 = require("../../controllers/outlet/plans/planController");
const utilsController_1 = require("../../controllers/utilsController");
const onboardingRoute = (0, express_1.Router)();
onboardingRoute.get("/", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(onboardingController_1.getOnBoarding));
onboardingRoute.post("/create-outlet", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(onboardingController_1.createOutlet));
onboardingRoute.patch("/save", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(onboardingController_1.saveOnBoarding));
onboardingRoute.patch("/update-onboarding-user", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(onboardingController_1.updateOnboardingStatus));
onboardingRoute.post("/create-razorpay-order", auth_1.isAuthMiddelware, (0, error_handler_1.errorHandler)(planController_1.CreateRazorPayOrder));
onboardingRoute.post("/verify-razorpay-payment", (0, error_handler_1.errorHandler)(planController_1.paymentRazorpayVerification));
onboardingRoute.post("/send-notification", (0, error_handler_1.errorHandler)(utilsController_1.sendFireBaseNotification));
exports.default = onboardingRoute;