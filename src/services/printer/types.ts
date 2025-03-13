import {
  Printer as PrismaBasePrinter,
  PrinterSize as PrismaPrinterSize,
  PrinterConnectionType as PrismaConnectionType,
  PrinterType as PrismaType,
  PrintLocationType as PrismaLocationType,
} from "@prisma/client";

export {
  PrismaPrinterSize as PrinterSize,
  PrismaConnectionType as PrinterConnectionType,
  PrismaType as PrinterType,
  PrismaLocationType as PrintLocationType,
};

export enum PrinterStatus {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
  ERROR = "ERROR",
  CONNECTING = "CONNECTING",
  PAPER_OUT = "PAPER_OUT",
}

// Add printer formatting config interface
export interface PrinterFormatConfig {
  lineWidth: number;
  fontSizeNormal: number;
  fontSizeLarge: number;
  fontSizeSmall: number;
}

export interface Printer extends PrismaBasePrinter {
  locations?: Array<{ id: string; name: string }>;
}

export interface PrintContent {
  type: "KOT" | "BILL";
  content: {
    header: {
      restaurantName: string;
      customerName: string;
      orderType: string;
      date: string;
      invoice?: string;
      address?: string;
      gstin?: string;
    };
    items: Array<{
      name: string;
      quantity: number;
      price?: number;
    }>;
    summary?: {
      subTotal: number;
      rounded: number;
      sgst?: number;
      cgst?: number;
      total: number;
    };
    footer?: {
      totalItems: number;
    };
    payment?: {
      type: "SPLIT" | "SINGLE";
      details?: Array<{ method: string; amount: number }>;
    };
    note?: string;
  };
}

export interface PrintResult {
  success: boolean;
  error?: string;
  printerId?: string;
  locationId?: string;
  locationType?: PrismaLocationType;
}
