import * as z from "zod";

export const staffSchema = z.object({
  email: z.string().min(1, { message: "Provide email address" }),
  password: z.string(),
});

export const userSchema = z.object({
  email: z.string().min(1, { message: "Provide email address" }),
  password: z.string(),
});

const timeSchema = z.object({
  time: z
    .string()
    .min(1, "Time is required")
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
});

export const outletOnlinePortalSchema = z.object({
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

export const operatingHoursSchema = z.object({
  openTime: timeSchema, // Changed from nested timings
  closeTime: timeSchema, // Changed from nested timings
});

export const rawMaterialSchema = z.object({
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

export interface ColumnSort {
  desc: boolean;
  id: string;
}

export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

export interface ColumnFilters {
  id: string;
  value: string[];
}
