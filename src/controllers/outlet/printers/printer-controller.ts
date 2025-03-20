import { Request, Response } from "express";
import * as z from "zod";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { PrinterSize, PrintLocationType } from "@prisma/client";
import { PrintManager } from "../../../services/printer/print-manager";
import { PrintContent, PrintResult } from "../../../services/printer/types";
import net from "net";
import { websocketManager } from "../../../services/ws";

// Validation schemas
const printerSchema = z.object({
  name: z.string({ required_error: "Name is required" }).min(1).max(50),
  description: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  connectionType: z.enum(["LAN", "WIFI", "BLUETOOTH", "USB"]),
  printerType: z.enum(["THERMAL", "DOT_MATRIX", "INKJET"]).default("THERMAL"),

  // Connection details based on type
  ipAddress: z
    .string({ required_error: "IP Address is required" })
    .ip()
    .optional(),
  port: z.coerce
    .number({ required_error: "Port is required" })
    .int()
    .min(1)
    .max(65535)
    .optional(),
  macAddress: z
    .string({ required_error: "MAC Address is required" })
    .optional(),
  bluetoothName: z
    .string({ required_error: "Bluetooth Name is required" })
    .optional(),
  usbVendorId: z
    .string({ required_error: "USB Vendor ID is required" })
    .optional(),
  usbProductId: z
    .string({ required_error: "USB Product ID is required" })
    .optional(),

  // Printer settings
  paperWidth: z.nativeEnum(PrinterSize),
  dpi: z.coerce.number({ required_error: "DPI is required" }).int().optional(),
  defaultFont: z
    .string({ required_error: "Default Font is required" })
    .optional(),
  cutPaper: z.boolean().default(true),
  openCashDrawer: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const printLocationSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.nativeEnum(PrintLocationType),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const printerLocationAssignmentSchema = z.object({
  printerId: z.string(),
  isDefault: z.boolean().default(false),
});

// Create printer
export const createPrinter = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const validatedData = printerSchema.parse(req.body);

  // Validate connection details based on connection type
  if (
    validatedData.connectionType === "LAN" ||
    validatedData.connectionType === "WIFI"
  ) {
    if (!validatedData.ipAddress || !validatedData.port) {
      throw new BadRequestsException(
        "IP address and port are required for LAN/WIFI printers",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  } else if (validatedData.connectionType === "BLUETOOTH") {
    if (!validatedData.macAddress) {
      throw new BadRequestsException(
        "MAC address is required for Bluetooth printers",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  } else if (validatedData.connectionType === "USB") {
    if (!validatedData.usbVendorId || !validatedData.usbProductId) {
      throw new BadRequestsException(
        "USB vendor and product IDs are required for USB printers",
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
  }

  const printer = await prismaDB.printer.create({
    data: {
      ...validatedData,
      restaurantId: outlet.id,
    },
  });

  return res.status(201).json(printer);
};

// Create print location
export const createPrintLocation = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const validatedData = printLocationSchema.parse(req.body);

  // Check for duplicate name
  const existingLocation = await prismaDB.printLocation.findFirst({
    where: {
      restaurantId: outlet.id,
      name: validatedData.name,
    },
  });

  if (existingLocation) {
    throw new BadRequestsException(
      "Print location with this name already exists",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const printLocation = await prismaDB.printLocation.create({
    data: {
      ...validatedData,
      restaurantId: outlet.id,
    },
  });

  return res.status(201).json(printLocation);
};

// Assign printer to location
export const assignPrinterToLocation = async (req: Request, res: Response) => {
  const { outletId, locationId } = req.params;
  const validatedData = printerLocationAssignmentSchema.parse(req.body);

  const outlet = await getOutletById(outletId);
  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Verify printer and location exist and belong to the restaurant
  const [printer, location] = await Promise.all([
    prismaDB.printer.findFirst({
      where: { id: validatedData.printerId, restaurantId: outlet.id },
    }),
    prismaDB.printLocation.findFirst({
      where: { id: locationId, restaurantId: outlet.id },
    }),
  ]);

  if (!printer || !location) {
    throw new NotFoundException(
      "Printer or location not found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Create or update the printer-location assignment
  const assignment = await prismaDB.printerToLocation.upsert({
    where: {
      printerId_printLocationId: {
        printerId: validatedData.printerId,
        printLocationId: locationId,
      },
    },
    update: {
      isDefault: validatedData.isDefault,
    },
    create: {
      printerId: validatedData.printerId,
      printLocationId: locationId,
      isDefault: validatedData.isDefault,
    },
  });

  return res.json(assignment);
};

// Get print locations with assigned printers
export const getPrintLocations = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const printLocations = await prismaDB.printLocation.findMany({
    where: {
      restaurantId: outlet.id,
    },
    include: {
      printers: {
        include: {
          printer: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.json({
    success: true,
    data: printLocations,
  });
};

// Get all printers
export const getPrinters = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const printers = await prismaDB.printer.findMany({
    where: {
      restaurantId: outlet.id,
    },
    include: {
      printLocations: {
        include: {
          printLocation: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.json({
    success: true,
    data: printers,
  });
};

const formSchema = z.object({
  name: z.string().min(1, "Printer name is required"),
  description: z.string().optional(),
  connectionType: z.enum(["LAN", "WIFI", "BLUETOOTH", "USB"]),
  printerType: z.enum(["THERMAL", "DOT_MATRIX", "INKJET"]).default("THERMAL"),
  ipAddress: z.string().ip().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  isActive: z.boolean().default(true),
  printLocationIds: z.array(z.string()).optional(),
});

// Update printer
export const updatePrinter = async (req: Request, res: Response) => {
  const { outletId, printerId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const { data: validatedData, error } = formSchema.safeParse(req.body);

  if (error) {
    throw new BadRequestsException(
      error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const printer = await prismaDB.printer.findFirst({
    where: {
      id: printerId,
      restaurantId: outlet.id,
    },
    include: {
      printLocations: {
        include: {
          printLocation: true,
        },
      },
    },
  });

  if (!printer) {
    throw new NotFoundException(
      "Printer not found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const existingPrintLocations = printer.printLocations.map(
    (location) => location.printLocationId
  );

  const newPrintLocations = validatedData.printLocationIds?.filter(
    (id) => !existingPrintLocations.includes(id)
  );

  const updatedPrinter = await prismaDB.printer.update({
    where: {
      id: printerId,
    },
    data: {
      name: validatedData.name,
      description: validatedData.description,
      connectionType: validatedData.connectionType,
      printerType: validatedData.printerType,
      ipAddress: validatedData.ipAddress,
      port: validatedData.port,
      isActive: validatedData.isActive,
    },
  });

  if (newPrintLocations && newPrintLocations.length > 0) {
    await prismaDB.printerToLocation.createMany({
      data: newPrintLocations.map((id) => ({
        printerId: printerId,
        printLocationId: id,
      })),
    });
  }

  if (existingPrintLocations && existingPrintLocations.length > 0) {
    await prismaDB.printerToLocation.deleteMany({
      where: {
        printerId: printerId,
      },
    });
  }

  return res.json({
    success: true,
    data: updatedPrinter,
  });
};

// Delete printer
export const deletePrinter = async (req: Request, res: Response) => {
  const { outletId, printerId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const printer = await prismaDB.printer.findFirst({
    where: {
      id: printerId,
      restaurantId: outlet.id,
    },
  });

  if (!printer) {
    throw new NotFoundException(
      "Printer not found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.printer.delete({
    where: {
      id: printerId,
    },
  });

  return res.json({
    success: true,
    message: "Printer deleted successfully",
  });
};

// Update print location
export const updatePrintLocation = async (req: Request, res: Response) => {
  const { outletId, locationId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const validatedData = printLocationSchema.partial().parse(req.body);

  const printLocation = await prismaDB.printLocation.findFirst({
    where: {
      id: locationId,
      restaurantId: outlet.id,
    },
  });

  if (!printLocation) {
    throw new NotFoundException(
      "Print location not found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const updatedLocation = await prismaDB.printLocation.update({
    where: {
      id: locationId,
    },
    data: validatedData,
  });

  return res.json({
    success: true,
    data: updatedLocation,
  });
};

// Delete print location
export const deletePrintLocation = async (req: Request, res: Response) => {
  const { outletId, locationId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const printLocation = await prismaDB.printLocation.findFirst({
    where: {
      id: locationId,
      restaurantId: outlet.id,
    },
  });

  if (!printLocation) {
    throw new NotFoundException(
      "Print location not found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  await prismaDB.printLocation.delete({
    where: {
      id: locationId,
    },
  });

  return res.json({
    success: true,
    message: "Print location deleted successfully",
  });
};

export const getPrintLocationsByTypesForApp = async (
  req: Request,
  res: Response
) => {
  const { outletId } = req.params;
  const { types } = req.query;

  const outlet = await getOutletById(outletId);
  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Validate types parameter
  if (!types || typeof types !== "string") {
    throw new BadRequestsException(
      "Types parameter is required and should be comma-separated",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Parse and validate location types
  const locationTypes = types.split(",").map((type) => {
    if (!Object.values(PrintLocationType).includes(type as PrintLocationType)) {
      throw new BadRequestsException(
        `Invalid location type: ${type}`,
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
    return type as PrintLocationType;
  });

  const printLocations = await prismaDB.printLocation.findMany({
    where: {
      restaurantId: outlet.id,
      type: {
        in: locationTypes,
      },
      isActive: true,
    },
    include: {
      printers: {
        include: {
          printer: true,
        },
      },
    },
  });

  const formattedPrinterConfig = printLocations.flatMap((location) =>
    location.printers.map((printer) => ({
      id: printer.printer.id,
      name: printer.printer.name,
      status: printer.printer.status,
      connectionType: printer.printer.connectionType,
      ipAddress: printer.printer.ipAddress,
      port: printer.printer.port,
      macAddress: printer.printer.macAddress,
      usbVendorId: printer.printer.usbVendorId,
      usbProductId: printer.printer.usbProductId,
    }))
  );

  return res.json({
    success: true,
    data: formattedPrinterConfig,
  });
};

export const getPrintLocationsByTypes = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const { types } = req.query;

  const outlet = await getOutletById(outletId);
  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Validate types parameter
  if (!types || typeof types !== "string") {
    throw new BadRequestsException(
      "Types parameter is required and should be comma-separated",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Parse and validate location types
  const locationTypes = types.split(",").map((type) => {
    if (!Object.values(PrintLocationType).includes(type as PrintLocationType)) {
      throw new BadRequestsException(
        `Invalid location type: ${type}`,
        ErrorCode.UNPROCESSABLE_ENTITY
      );
    }
    return type as PrintLocationType;
  });

  const printLocations = await prismaDB.printLocation.findMany({
    where: {
      restaurantId: outlet.id,
      type: {
        in: locationTypes,
      },
      isActive: true,
    },
    include: {
      printers: {
        include: {
          printer: true,
        },
      },
    },
  });

  return res.json({
    success: true,
    data: printLocations,
  });
};

// Get printers for a specific location
export const getPrintersForLocation = async (req: Request, res: Response) => {
  const { outletId, locationId } = req.params;

  const outlet = await getOutletById(outletId);
  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Verify location exists and belongs to the restaurant
  const location = await prismaDB.printLocation.findFirst({
    where: {
      id: locationId,
      restaurantId: outlet.id,
    },
  });

  if (!location) {
    throw new NotFoundException(
      "Print location not found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  // Get printers assigned to this location
  const printers = await prismaDB.printer.findMany({
    where: {
      restaurantId: outlet.id,
      printLocations: {
        some: {
          printLocationId: locationId,
        },
      },
      isActive: true,
    },
    include: {
      printLocations: {
        where: {
          printLocationId: locationId,
        },
      },
    },
  });

  return res.json({
    success: true,
    data: printers,
  });
};

// Get printer by ID
export const getPrinterById = async (req: Request, res: Response) => {
  const { outletId, printerId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const printer = await prismaDB.printer.findFirst({
    where: {
      id: printerId,
      restaurantId: outlet.id,
    },
  });

  if (!printer) {
    throw new NotFoundException(
      "Printer not found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  return res.json({
    success: true,
    data: printer,
  });
};

// Print KOT
export const printKOT = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Get printers for KOT location type
  const kotPrinters = await prismaDB.printer.findMany({
    where: {
      restaurantId: outlet.id,
      isActive: true,
      printLocations: {
        some: {
          printLocation: {
            type: PrintLocationType.KITCHEN,
            isActive: true,
          },
        },
      },
    },
    include: {
      printLocations: {
        include: {
          printLocation: true,
        },
      },
    },
  });

  if (!kotPrinters || kotPrinters.length === 0) {
    throw new BadRequestsException(
      "No active KOT printers found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  try {
    const printData = req.body;
    const printManager = new PrintManager();

    // Format the content for KOT printing
    const printContent: PrintContent = {
      type: "KOT",
      content: {
        header: {
          restaurantName: printData.restaurantName,
          customerName: printData.name,
          orderType: printData.orderType,
          date: printData.date,
        },
        items: printData.items,
        footer: {
          totalItems: printData.totalItems,
        },
        note: printData.note,
      },
    };

    // Print to all KOT printers
    const printResults = await Promise.all(
      kotPrinters.map((printer) => printManager.print(printer, printContent))
    );

    // Check if at least one printer succeeded
    const success = printResults.some((result: PrintResult) => result.success);

    if (!success) {
      throw new Error("Failed to print to any KOT printer");
    }

    return res.json({
      success: true,
      message: "KOT printed successfully",
    });
  } catch (error) {
    console.error("KOT Print error:", error);
    throw new BadRequestsException(
      "Failed to print KOT",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
};

// Print Bill
export const printBill = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  // Get printers for BILL location type
  const billPrinters = await prismaDB.printer.findMany({
    where: {
      restaurantId: outlet.id,
      isActive: true,
      printLocations: {
        some: {
          printLocation: {
            type: PrintLocationType.BILLDESK,
            isActive: true,
          },
        },
      },
    },
    include: {
      printLocations: {
        include: {
          printLocation: true,
        },
      },
    },
  });

  if (!billPrinters || billPrinters.length === 0) {
    throw new BadRequestsException(
      "No active bill printers found",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  try {
    const printData = req.body;
    const printManager = new PrintManager();

    // Format the content for bill printing
    const printContent: PrintContent = {
      type: "BILL",
      content: {
        header: {
          restaurantName: printData.restaurantName,
          customerName: printData.name,
          orderType: printData.orderType,
          date: printData.date,
        },
        items: printData.items,
        summary: {
          subTotal: printData.totalPrice - printData.gst,
          sgst: printData.gst / 2,
          cgst: printData.gst / 2,
          total: printData.totalPrice,
          rounded: Math.round(printData.totalPrice),
        },
        payment: printData.isSplitPayment
          ? {
              type: "SPLIT",
              details: printData.splitPayments,
            }
          : {
              type: "SINGLE",
              details: [
                {
                  method: printData.paymentMethod || "CASH",
                  amount: printData.totalPrice,
                },
              ],
            },
        note: printData.note,
      },
    };

    // Print to all bill printers
    const printResults = await Promise.all(
      billPrinters.map((printer) => printManager.print(printer, printContent))
    );

    // Check if at least one printer succeeded
    const success = printResults.some((result: PrintResult) => result.success);

    if (!success) {
      throw new Error("Failed to print to any bill printer");
    }

    return res.json({
      success: true,
      message: "Bill printed successfully",
    });
  } catch (error) {
    console.error("Bill Print error:", error);
    throw new BadRequestsException(
      "Failed to print bill",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
};

export const printTCP = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const { printerId, data, content, rawData, options } = req.body;

  // Check if we have either data or content
  if (!printerId || (!data && !content && !rawData)) {
    throw new BadRequestsException(
      "Missing parameters: printerId and either data or content are required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  try {
    // Determine what data to store in the print job
    // If we have structured content, use that for better formatting
    // Otherwise, fall back to raw data
    // IMPORTANT: Convert content to string as required by Prisma schema
    const jobContent = content
      ? JSON.stringify(content)
      : typeof data === "string"
      ? data
      : JSON.stringify(data);

    // Create a print job in the database
    // Note: Store all additional data in options
    const printJobOptions = {
      ...options,
      // Store raw data in options if it's provided
      ...(rawData ? { rawData } : {}),
      // Store the original structured content in options for the print agent to use
      ...(content ? { structuredContent: content } : {}),
    };

    const printJob = await prismaDB.printJob.create({
      data: {
        restaurantId: outlet.id,
        printerId: printerId,
        content: jobContent, // Now this is a string as required by Prisma
        options: printJobOptions || {},
        status: "pending",
      },
    });

    // Notify connected clients via WebSocket
    websocketManager.notifyClients(outlet.id, "print_job", {
      type: "print_job",
      data: printJob,
    });

    return res.json({
      success: true,
      message: "Print job created successfully",
      jobId: printJob.id,
    });
  } catch (error: any) {
    console.error("Error creating print job:", error);
    throw new BadRequestsException(
      `Failed to create print job: ${error.message}`,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
};

const printDetailsSchema = z.object({
  restaurantName: z.string().min(1),
  description: z.string().optional(),
  address: z.string().min(1),
  GSTIN: z.string().optional(),
  fssaiNo: z.string().optional(),
  phoneNo: z.string().min(1),
  email: z.string().min(1),
  website: z.string().optional(),
  logo: z.string().optional(),
  footer: z.string().optional(),
  googleReviewUrl: z.string().optional(),
});

export const createPrintDetails = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const validatedData = printDetailsSchema.safeParse(req.body);

  if (!validatedData.success) {
    throw new BadRequestsException(
      validatedData.error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  const printDetails = await prismaDB.printDetails.create({
    data: {
      restaurantName: validatedData.data.restaurantName,
      description: validatedData.data.description,
      address: validatedData.data.address,
      GSTIN: validatedData.data.GSTIN,
      fssaiNo: validatedData.data.fssaiNo,
      phoneNo: validatedData.data.phoneNo,
      email: validatedData.data.email,
      website: validatedData.data.website,
      logo: validatedData.data.logo,
      footer: validatedData.data.footer,
      googleReviewUrl: validatedData.data.googleReviewUrl,
      restaurantId: outlet.id,
    },
  });

  return res.json({
    success: true,
    message: "Print details created successfully",
    data: printDetails,
  });
};

export const updatePrintDetails = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const validatedData = printDetailsSchema.safeParse(req.body);

  if (!validatedData.success) {
    throw new BadRequestsException(
      validatedData.error.errors[0].message,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
  const printDetails = await prismaDB.printDetails.update({
    where: {
      restaurantId: outlet.id,
    },
    data: validatedData.data,
  });

  return res.json({
    success: true,
    message: "Print details updated successfully",
    data: printDetails,
  });
};

export const getPrintDetails = async (req: Request, res: Response) => {
  const { outletId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const printDetails = await prismaDB.printDetails.findUnique({
    where: {
      restaurantId: outlet.id,
    },
  });

  return res.json({
    success: true,
    message: "Print details fetched successfully",
    data: printDetails,
  });
};
