import * as z from "zod";

export const staffSchema = z.object({
  email: z.string().min(1, { message: "Provide email address" }),
  password: z.string(),
});

export const userSchema = z.object({
  email: z.string().min(1, { message: "Provide email address" }),
  password: z.string(),
});

export const outletOnlinePortalSchema = z.object({
  subdomain: z.string().min(1, "SubDomain is Required"),
  openTime: z.string().min(1, "Open Time is Required"),
  closeTime: z.string().min(1, "Close Time is Required"),
  areaLat: z.string().min(1, "Area Latitude is required"),
  areaLong: z.string().min(1, "Area Longitude is required"),
  orderRadius: z.number().min(1, "Order Radius in KM for Customer is Required"),
  isDelivery: z.boolean().optional(),
  isPickUp: z.boolean().optional(),
  isDineIn: z.boolean().optional(),
});

export const rawMaterialSchema = z.object({
  name: z.string().min(1, "Name is required"),
  barcode: z.string().min(1, "ShortCode / Barcode is required"),
  categoryId: z.string().min(1, "Category is required"),
  conversionFactor: z.string().min(1, "Conversion Factor is required"),
  consumptionUnitId: z.string().min(1, "Consumption unit is required"),
  minimumStockLevelUnitId: z
    .string()
    .min(1, "Minimum stock level unit is required"),
  minimumStockLevel: z.string().min(1, "Minimum stock level is required"),
});
