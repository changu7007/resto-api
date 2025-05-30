"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchBankAccountStatus = exports.createVendorAccount = exports.getAllPlans = exports.buyPlan = exports.paymentWebhookVerification = exports.paymentRazorpayVerification = exports.CreateRazorPayOrderForOutlet = exports.statusPhonePeCheck = exports.createPhonePeOrder = exports.CreateRazorPayOrder = exports.API = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importStar(require("crypto"));
const bad_request_1 = require("../../../exceptions/bad-request");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const not_found_1 = require("../../../exceptions/not-found");
const secrets_1 = require("../../../secrets");
const outlet_1 = require("../../../lib/outlet");
const unauthorized_1 = require("../../../exceptions/unauthorized");
const get_users_1 = require("../../../lib/get-users");
const pg_sdk_node_1 = require("pg-sdk-node");
const razorpay = new razorpay_1.default({
    key_id: secrets_1.RAZORPAY_KEY_ID,
    key_secret: secrets_1.RAZORPAY_KEY_SECRET,
});
exports.API = secrets_1.ENV === "production"
    ? "https://api.restobytes.in/api"
    : "http://localhost:8080/api";
const FRONTEND = secrets_1.ENV === "production" ? "https://app.restobytes.in" : "http://localhost:4000";
const clientId = secrets_1.PHONE_PE_CLIENT_ID;
const clientSecret = secrets_1.PHONE_PE_CLIENT_SECRET;
const clientVersion = 1;
const env = secrets_1.ENV === "development" ? pg_sdk_node_1.Env.SANDBOX : pg_sdk_node_1.Env.PRODUCTION;
const phonePeClient = pg_sdk_node_1.StandardCheckoutClient.getInstance(clientId, clientSecret, clientVersion, env);
function CreateRazorPayOrder(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { amount } = req.body;
        const order = yield razorpay.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: "receipt_" + Math.random().toString(36).substring(7),
        });
        return res.json({
            success: true,
            orderId: order.id,
        });
    });
}
exports.CreateRazorPayOrder = CreateRazorPayOrder;
function createPhonePeOrder(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { amount, subscriptionId } = req.body;
        // @ts-ignore
        const userId = req.user.id;
        if (!amount) {
            throw new not_found_1.NotFoundException("Amount is Required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        const merchantOrderId = (0, crypto_1.randomUUID)();
        const redirectUrl = `${exports.API}/onboarding/check-status?merchantOrderId=${merchantOrderId}&subId=${subscriptionId}&userId=${userId}`;
        const request = pg_sdk_node_1.StandardCheckoutPayRequest.builder()
            .merchantOrderId(merchantOrderId)
            .amount(amount)
            .redirectUrl(redirectUrl)
            .build();
        const response = yield phonePeClient.pay(request);
        return res.json({
            success: true,
            redirectUrl: response.redirectUrl,
        });
    });
}
exports.createPhonePeOrder = createPhonePeOrder;
function statusPhonePeCheck(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { merchantOrderId, subId, userId } = req.query;
        if (!merchantOrderId) {
            throw new not_found_1.NotFoundException("MerchantORderId is Missing", root_1.ErrorCode.UNAUTHORIZED);
        }
        const response = yield phonePeClient.getOrderStatus(merchantOrderId);
        const status = response.state;
        if (status === "COMPLETED") {
            // Create subscription similar to buyPlan function
            if (!subId || !userId) {
                throw new bad_request_1.BadRequestsException("Subscription ID or User ID is missing", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
            }
            const findOwner = yield __1.prismaDB.user.findFirst({
                where: {
                    id: userId,
                },
            });
            if (!(findOwner === null || findOwner === void 0 ? void 0 : findOwner.id)) {
                throw new not_found_1.NotFoundException("User Not Found", root_1.ErrorCode.NOT_FOUND);
            }
            const findSubscription = yield __1.prismaDB.subsciption.findFirst({
                where: {
                    id: subId,
                },
            });
            if (!findSubscription) {
                throw new bad_request_1.BadRequestsException("No Subscription Found", root_1.ErrorCode.NOT_FOUND);
            }
            let validDate = new Date();
            const paidAmount = response.amount / 100 || 0;
            if (paidAmount === 0) {
                // Set validDate to 15 days from today for free trial
                validDate.setDate(validDate.getDate() + 15);
            }
            else if (findSubscription.planType === "MONTHLY") {
                validDate.setMonth(validDate.getMonth() + 1);
            }
            else if (findSubscription.planType === "ANNUALLY") {
                validDate.setFullYear(validDate.getFullYear() + 1);
            }
            yield __1.prismaDB.subscriptionBilling.create({
                data: {
                    userId: findOwner.id,
                    isSubscription: true,
                    paymentId: (response === null || response === void 0 ? void 0 : response.orderId) || merchantOrderId,
                    paidAmount: paidAmount,
                    subscribedDate: new Date(),
                    planType: findSubscription.planType,
                    subscriptionPlan: findSubscription.subscriptionPlan,
                    validDate: validDate,
                },
            });
            yield (0, get_users_1.getFormatUserAndSendToRedis)(findOwner === null || findOwner === void 0 ? void 0 : findOwner.id);
            return res.redirect(`${FRONTEND}/thankyou?status=success`);
        }
        else {
            return res.redirect(`${FRONTEND}/thankyou?status=failure`);
        }
    });
}
exports.statusPhonePeCheck = statusPhonePeCheck;
function CreateRazorPayOrderForOutlet(req, res) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const { outletId } = req.params;
        const outlet = yield (0, outlet_1.getOutletById)(outletId);
        if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
            throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
        }
        const { amount } = req.body;
        const comission = amount * 0.02;
        console.log("Comission", comission);
        const order = yield razorpay.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: "receipt_" + Math.random().toString(36).substring(7),
            transfers: [
                {
                    account: (_a = outlet === null || outlet === void 0 ? void 0 : outlet.razorpayInfo) === null || _a === void 0 ? void 0 : _a.acc_id,
                    amount: (amount - comission) * 100,
                    currency: "INR",
                    on_hold: 0,
                },
            ],
        });
        return res.json({
            success: true,
            orderId: order.id,
        });
    });
}
exports.CreateRazorPayOrderForOutlet = CreateRazorPayOrderForOutlet;
// export async function CreateRazorPaySubscriptionForOutlet(
//   req: Request,
//   res: Response
// ) {
//   const { outletId } = req.params;
//   // @ts-ignore
//   const userId = req.user.id;
//   const {razorpayPlanId,id}=req.body;
//   if(!razorpayPlanId || !id) {
//     throw new NotFoundException("Please select your plan",ErrorCode.NOT_FOUND)
//   }
//   const outlet = await getOutletById(outletId);
//   if (!outlet?.id) {
//     throw new NotFoundException("Outlet Not Found", ErrorCode.OUTLET_NOT_FOUND);
//   }
//   if (outlet.adminId !== userId) {
//     throw new NotFoundException(
//       "Only Restaurant Owner/manager Can Subscribe",
//       ErrorCode.UNAUTHORIZED
//     );
//   }
//   const user = await prismaDB.user.findFirst({
//     where: {
//       id: userId,
//     },
//   });
//   if (!user?.id) {
//     throw new NotFoundException("Admin Not Found", ErrorCode.UNAUTHORIZED);
//   }
//   const subs = await razorpay.subscriptions.create({
//     plan_id: razorpayPlanId,
//     customer_notify: 1,
//     quantity: 1,
//     total_count: 12,
//   });
//   const findSubscription = await prismaDB.subsciption.findFirst({
//     where: {
//       id: id,
//     },
//   });
//   if (!findSubscription) {
//     throw new BadRequestsException(
//       "No Subscription Found",
//       ErrorCode.NOT_FOUND
//     );
//   }
//   const userUpdate = await prismaDB.user.update({
//     where:{
//       id: user.id
//     },
//     data:{
//       billings:{
//         create:{
//           isSubscription: false,
//           planType: findSubscription.planType,
//           subscriptionPlan: findSubscription.subscriptionPlan,
//           subscriptionLink: subs?.short_url,
//           subscriptionStatus: subs?.status
//         }
//       }
//     }
//   })
//   return res.json({
//     success: true,
//     shortUrl : subs?.short_url
//   });
// }
const paymentRazorpayVerification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto_1.default
        .createHmac("sha256", secrets_1.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");
    const isAuthentic = expectedSignature === razorpaySignature;
    if (isAuthentic) {
        console.log(razorpayPaymentId);
        return res.json({ success: true, message: "Payment Successfull" });
    }
    else {
        return res.json({
            success: false,
            message: "Payment Failed",
        });
    }
});
exports.paymentRazorpayVerification = paymentRazorpayVerification;
const paymentWebhookVerification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const secret = secrets_1.ENCRYPT_KEY;
    const shasum = crypto_1.default
        .createHmac("sha256", secret)
        .update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");
    if (digest === req.headers["x-razorpay-signature"]) {
        console.log("Request is legit");
        return res.json({
            success: true,
            message: "legit",
        });
    }
    else {
        console.log("Messing");
        return res.json({
            success: false,
            message: "not-legit",
        });
    }
});
exports.paymentWebhookVerification = paymentWebhookVerification;
const buyPlan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { paymentId, subscriptionId, paidAmount } = req.body;
    // @ts-ignore
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    console.log("Plan", req.body);
    if (!paymentId || !subscriptionId) {
        throw new bad_request_1.BadRequestsException("Payment ID not Verfied", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const findOwner = yield __1.prismaDB.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!(findOwner === null || findOwner === void 0 ? void 0 : findOwner.id)) {
        throw new not_found_1.NotFoundException("User Not Found", root_1.ErrorCode.NOT_FOUND);
    }
    const findSubscription = yield __1.prismaDB.subsciption.findFirst({
        where: {
            id: subscriptionId,
        },
    });
    if (!findSubscription) {
        throw new bad_request_1.BadRequestsException("No Subscription Found", root_1.ErrorCode.NOT_FOUND);
    }
    let validDate = new Date();
    if (paymentId === "FREETRIAL" && paidAmount === 0) {
        // Set validDate to 15 days from today for free trial
        validDate.setDate(validDate.getDate() + 15);
    }
    else if (findSubscription.planType === "MONTHLY") {
        validDate.setMonth(validDate.getMonth() + 1);
    }
    else if (findSubscription.planType === "ANNUALLY") {
        validDate.setFullYear(validDate.getFullYear() + 1);
    }
    yield __1.prismaDB.subscriptionBilling.create({
        data: {
            userId: findOwner.id,
            isSubscription: true,
            paymentId: paymentId,
            paidAmount: paidAmount,
            subscribedDate: new Date(),
            planType: findSubscription.planType,
            subscriptionPlan: findSubscription.subscriptionPlan,
            validDate: validDate,
        },
    });
    yield (0, get_users_1.getFormatUserAndSendToRedis)(findOwner === null || findOwner === void 0 ? void 0 : findOwner.id);
    return res.json({
        success: true,
        message: "Your Subscription is now Active",
    });
});
exports.buyPlan = buyPlan;
const getAllPlans = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const plans = yield __1.prismaDB.subsciption.findMany();
    return res.json({
        success: true,
        plans,
    });
});
exports.getAllPlans = getAllPlans;
const createVendorAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const { outletId } = req.params;
    const { account_number, ifsc_code } = req.body;
    // @ts-ignore
    const userId = (_b = req === null || req === void 0 ? void 0 : req.user) === null || _b === void 0 ? void 0 : _b.id;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    if ((outlet === null || outlet === void 0 ? void 0 : outlet.adminId) !== userId) {
        throw new unauthorized_1.UnauthorizedException("Your Not Authorized", root_1.ErrorCode.UNAUTHORIZED);
    }
    const getOwner = yield __1.prismaDB.user.findFirst({
        where: {
            id: userId,
        },
    });
    const razorpayInfo = yield __1.prismaDB.razorpayIntegration.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    });
    let vendor;
    if (!(razorpayInfo === null || razorpayInfo === void 0 ? void 0 : razorpayInfo.acc_id)) {
        // Create Razorpay account if it doesn't exist
        const data = {
            email: getOwner === null || getOwner === void 0 ? void 0 : getOwner.email,
            phone: getOwner === null || getOwner === void 0 ? void 0 : getOwner.phoneNo,
            type: "route",
            reference_id: Math.random().toString(36).substring(7),
            legal_business_name: outlet === null || outlet === void 0 ? void 0 : outlet.restaurantName,
            business_type: outlet === null || outlet === void 0 ? void 0 : outlet.businessType,
            contact_name: getOwner === null || getOwner === void 0 ? void 0 : getOwner.name,
            profile: {
                category: "food",
                subcategory: "restaurant",
                addresses: {
                    registered: {
                        street1: outlet === null || outlet === void 0 ? void 0 : outlet.address,
                        street2: outlet === null || outlet === void 0 ? void 0 : outlet.address,
                        city: outlet === null || outlet === void 0 ? void 0 : outlet.city,
                        postal_code: outlet === null || outlet === void 0 ? void 0 : outlet.pincode,
                        state: outlet === null || outlet === void 0 ? void 0 : outlet.state,
                        country: outlet === null || outlet === void 0 ? void 0 : outlet.country,
                    },
                },
            },
            // legal_info: {
            //   pan: getOwner?.pan!,
            //   gst: outlet?.GSTIN!,
            // },
        };
        const response = yield razorpay.accounts.create(data);
        // const response = await axios.post(
        //   "https://api.razorpay.com/v2/accounts",
        //   data,
        //   {
        //     auth: {
        //       username: RAZORPAY_KEY_ID, // Replace with your Razorpay Key ID
        //       password: RAZORPAY_KEY_SECRET, // Replace with your Razorpay Secret
        //     },
        //     headers: {
        //       "Content-Type": "application/json",
        //     },
        //   }
        // );
        console.log("Response Vendor", response);
        vendor = { id: response === null || response === void 0 ? void 0 : response.id };
        if (vendor === null || vendor === void 0 ? void 0 : vendor.id) {
            // Store Razorpay account info
            yield __1.prismaDB.razorpayIntegration.create({
                data: {
                    restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                    acc_id: vendor === null || vendor === void 0 ? void 0 : vendor.id,
                },
            });
        }
    }
    else {
        const response = yield razorpay.accounts.fetch(razorpayInfo === null || razorpayInfo === void 0 ? void 0 : razorpayInfo.acc_id);
        console.log("Account", response);
        vendor = { id: razorpayInfo === null || razorpayInfo === void 0 ? void 0 : razorpayInfo.acc_id };
    }
    // Create or update stakeholder
    if (vendor === null || vendor === void 0 ? void 0 : vendor.id) {
        const stakeholder = yield razorpay.stakeholders.create(vendor === null || vendor === void 0 ? void 0 : vendor.id, {
            name: getOwner === null || getOwner === void 0 ? void 0 : getOwner.name,
            email: getOwner === null || getOwner === void 0 ? void 0 : getOwner.email,
            phone: {
                primary: getOwner === null || getOwner === void 0 ? void 0 : getOwner.phoneNo,
            },
            addresses: {
                residential: {
                    street: outlet === null || outlet === void 0 ? void 0 : outlet.address,
                    city: outlet === null || outlet === void 0 ? void 0 : outlet.city,
                    country: outlet === null || outlet === void 0 ? void 0 : outlet.country,
                    postal_code: outlet === null || outlet === void 0 ? void 0 : outlet.pincode,
                    state: outlet === null || outlet === void 0 ? void 0 : outlet.state,
                },
            },
            kyc: {
                pan: getOwner === null || getOwner === void 0 ? void 0 : getOwner.pan,
            },
        });
        console.log("Stakeholder created");
        // Update Razorpay integration with stakeholder ID
        yield __1.prismaDB.razorpayIntegration.update({
            where: {
                acc_id: vendor === null || vendor === void 0 ? void 0 : vendor.id,
                restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
            },
            data: {
                stakeholderId: stakeholder === null || stakeholder === void 0 ? void 0 : stakeholder.id,
            },
        });
    }
    // Configure product for vendor
    if (vendor === null || vendor === void 0 ? void 0 : vendor.id) {
        const product = yield razorpay.products.requestProductConfiguration(vendor.id, {
            product_name: "route",
            tnc_accepted: true,
        });
        if (product === null || product === void 0 ? void 0 : product.id) {
            yield __1.prismaDB.razorpayIntegration.update({
                where: { acc_id: vendor === null || vendor === void 0 ? void 0 : vendor.id, restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id },
                data: { productId: product.id },
            });
            const beneficaryName = (outlet === null || outlet === void 0 ? void 0 : outlet.businessType) === "individual" ||
                (outlet === null || outlet === void 0 ? void 0 : outlet.businessType) === "propreitorship"
                ? getOwner === null || getOwner === void 0 ? void 0 : getOwner.name
                : outlet === null || outlet === void 0 ? void 0 : outlet.restaurantName;
            const up = yield razorpay.products.edit(vendor.id, product.id, {
                settlements: {
                    account_number: account_number,
                    ifsc_code: ifsc_code,
                    beneficiary_name: beneficaryName,
                },
                tnc_accepted: true,
            });
            if (up === null || up === void 0 ? void 0 : up.id) {
                yield __1.prismaDB.razorpayIntegration.update({
                    where: {
                        acc_id: vendor === null || vendor === void 0 ? void 0 : vendor.id,
                        restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                    },
                    data: {
                        account_number: account_number,
                        ifsc_code: ifsc_code,
                        activation_status: up.activation_status,
                    },
                });
                const update = yield __1.prismaDB.integration.findFirst({
                    where: {
                        name: "RAZORAPY",
                        restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
                    },
                });
                yield __1.prismaDB.integration.update({
                    where: {
                        id: update === null || update === void 0 ? void 0 : update.id,
                    },
                    data: {
                        connected: true,
                    },
                });
            }
        }
    }
    return res.json({ success: true });
});
exports.createVendorAccount = createVendorAccount;
const fetchBankAccountStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!(outlet === null || outlet === void 0 ? void 0 : outlet.id)) {
        throw new not_found_1.NotFoundException("Outlet Not Found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const razorpayInfo = yield __1.prismaDB.razorpayIntegration.findFirst({
        where: {
            restaurantId: outlet === null || outlet === void 0 ? void 0 : outlet.id,
        },
    });
    if (!(razorpayInfo === null || razorpayInfo === void 0 ? void 0 : razorpayInfo.id) || !(razorpayInfo === null || razorpayInfo === void 0 ? void 0 : razorpayInfo.acc_id) || !(razorpayInfo === null || razorpayInfo === void 0 ? void 0 : razorpayInfo.productId)) {
        throw new not_found_1.NotFoundException("You have not Added your Bank Account", root_1.ErrorCode.INTERNAL_EXCEPTION);
    }
    const razorpayAccount = yield razorpay.accounts.fetch(razorpayInfo === null || razorpayInfo === void 0 ? void 0 : razorpayInfo.acc_id);
    console.log("Linked ACcount", razorpayAccount);
    const razorpayProduct = yield razorpay.products.fetch(razorpayInfo.acc_id, razorpayInfo.productId);
    console.log("PRoduct ACcount", razorpayProduct);
    yield __1.prismaDB.razorpayIntegration.update({
        where: {
            id: razorpayInfo === null || razorpayInfo === void 0 ? void 0 : razorpayInfo.id,
        },
        data: {
            activation_status: razorpayProduct === null || razorpayProduct === void 0 ? void 0 : razorpayProduct.activation_status,
        },
    });
    // if (razorpayProduct.activation_status === "under_review") {
    //   if (razorpayAccount.business_type === "partnership") {
    //     await razorpay.products.edit(
    //       razorpayInfo.acc_id,
    //       razorpayInfo?.productId,
    //       {
    //         settlements: {
    //           account_number:
    //             razorpayProduct?.active_configuration?.settlements
    //               ?.account_number,
    //           ifsc_code:
    //             razorpayProduct?.active_configuration?.settlements?.ifsc_code,
    //           beneficiary_name: razorpayAccount?.legal_business_name,
    //         },
    //         tnc_accepted: true,
    //       }
    //     );
    //     console.log("Done updating based on businesstype");
    //   }
    // }
    // if (razorpayProduct.activation_status === "needs_clarification") {
    //   if (razorpayAccount.business_type === "partnership") {
    //     await razorpay.accounts.edit(razorpayInfo?.acc_id, {
    //       type: "individual",
    //     });
    //     await razorpay.products.edit(
    //       razorpayInfo.acc_id,
    //       razorpayInfo?.productId,
    //       {
    //         settlements: {
    //           account_number:
    //             razorpayProduct?.active_configuration?.settlements
    //               ?.account_number,
    //           ifsc_code:
    //             razorpayProduct?.active_configuration?.settlements?.ifsc_code,
    //           beneficiary_name: razorpayAccount?.contact_name,
    //         },
    //         tnc_accepted: true,
    //       }
    //     );
    //     console.log("Done updating based on businesstype");
    //   }
    // }
    return res.json({
        success: true,
        message: razorpayProduct.activation_status === "under_review"
            ? "UNDER REVIEW"
            : "ACCOUNT ACTIVATED",
    });
});
exports.fetchBankAccountStatus = fetchBankAccountStatus;
// async function createVendorAccount(data) ===???? acc_PQ10D2tzRS6kmh
//   const options = {
//     method: 'POST',
//     url: 'https://api.razorpay.com/v1/partners/contacts',
//     headers: {
//       Authorization: `Basic ${Buffer.from('YOUR_KEY_ID:YOUR_KEY_SECRET').toString('base64')}`,
//       'Content-Type': 'application/json'
//     },
//     data
//   };
//   return axios.request(options);
// }
