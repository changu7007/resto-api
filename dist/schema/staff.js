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
Object.defineProperty(exports, "__esModule", { value: true });
exports.outletOnlinePortalSchema = exports.userSchema = exports.staffSchema = void 0;
const z = __importStar(require("zod"));
exports.staffSchema = z.object({
    email: z.string().min(1, { message: "Provide email address" }),
    password: z.string(),
});
exports.userSchema = z.object({
    email: z.string().min(1, { message: "Provide email address" }),
    password: z.string(),
});
exports.outletOnlinePortalSchema = z.object({
    subdomain: z.string().min(1, "SubDomain is Required"),
    openTime: z.string().min(1, "Open Time is Required"),
    closeTime: z.string().min(1, "Close Time is Required"),
    areaLat: z.string().min(1, "Area Latitude is required"),
    areaLong: z.string().min(1, "Area Longitude is required"),
    orderRadius: z.string().min(1, "Order Radius in KM for Customer is Required"),
    isDelivery: z.boolean().optional(),
    isPickUp: z.boolean().optional(),
    isDineIn: z.boolean().optional(),
});
