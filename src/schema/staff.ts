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

export const outletOnlinePortalSchema = z
  .object({
    openTime: z
      .string()
      .min(1, "Opening time is required")
      .regex(
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Invalid time format (HH:MM)"
      ),
    closeTime: z
      .string()
      .min(1, "Closing time is required")
      .regex(
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Invalid time format (HH:MM)"
      ),
    isDelivery: z.boolean().default(false),
    isPickUp: z.boolean().default(false),
    isDineIn: z.boolean().default(false),
    areaLat: z
      .string()
      .min(1, "Latitude is required")
      .regex(/^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)$/, "Invalid latitude format"),
    areaLong: z
      .string()
      .min(1, "Longitude is required")
      .regex(
        /^[-+]?((1[0-7]\d)|([1-9]?\d))(\.\d+)?|180(\.0+)?$/,
        "Invalid longitude format"
      ),
    orderRadius: z.coerce
      .number()
      .min(1, "Order radius must be at least 1 km")
      .max(50, "Order radius cannot exceed 50 km"),
    deliveryFee: z.coerce
      .number()
      .min(0, "Delivery fee cannot be negative")
      .max(100, "Delivery fee cannot exceed $100"),
    packagingFee: z.coerce
      .number()
      .min(0, "Packaging fee cannot be negative")
      .max(100, "Packaging fee cannot exceed 100"),
    googlePlaceId: z
      .string()
      .min(1, "Google Place ID is required")
      .regex(/^ChIJ[A-Za-z0-9_-]+$/, "Invalid Google Place ID format"),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters")
      .max(500, "Description cannot exceed 500 characters"),
  })
  .refine(
    (data) => {
      // Validate that at least one service is selected
      return data.isDelivery || data.isPickUp || data.isDineIn;
    },
    {
      message: "At least one service must be selected",
      path: ["isDelivery"], // This will show the error on the delivery checkbox
    }
  )
  .refine(
    (data) => {
      // Validate that closing time is after opening time
      const openTime = new Date(`1970-01-01T${data.openTime}:00`);
      const closeTime = new Date(`1970-01-01T${data.closeTime}:00`);
      return closeTime > openTime;
    },
    {
      message: "Closing time must be after opening time",
      path: ["closeTime"],
    }
  );

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
