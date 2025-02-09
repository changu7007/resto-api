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
exports.rawMaterialSchema = exports.outletOnlinePortalSchema = exports.userSchema = exports.staffSchema = void 0;
const z = __importStar(require("zod"));
exports.staffSchema = z.object({
    email: z.string().min(1, { message: "Provide email address" }),
    password: z.string(),
});
exports.userSchema = z.object({
    email: z.string().min(1, { message: "Provide email address" }),
    password: z.string(),
});
const timeSchema = z.object({
    time: z
        .string()
        .min(1, "Time is required")
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
});
exports.outletOnlinePortalSchema = z.object({
    subdomain: z.string().min(1, "SubDomain is Required"),
    openTime: timeSchema, // Changed from nested timings
    closeTime: timeSchema, // Changed from nested timings
    areaLat: z.string().min(1, "Area Latitude is required"),
    areaLong: z.string().min(1, "Area Longitude is required"),
    orderRadius: z.number().min(1, "Order Radius in KM for Customer is Required"),
    isDelivery: z.boolean().optional(),
    isPickUp: z.boolean().optional(),
    isDineIn: z.boolean().optional(),
});
exports.rawMaterialSchema = z.object({
    name: z.string().min(1, "Name is required"),
    barcode: z.string().min(1, "ShortCode / Barcode is required"),
    categoryId: z.string().min(1, "Category is required"),
    conversionFactor: z.coerce.number().min(0, "Conversion Factor is required"),
    consumptionUnitId: z.string().min(1, "Consumption unit is required"),
    minimumStockLevelUnitId: z
        .string()
        .min(1, "Minimum stock level unit is required"),
    minimumStockLevel: z.coerce
        .number()
        .min(0, "Minimum stock level is required"),
});
