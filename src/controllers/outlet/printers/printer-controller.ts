import { Request, Response } from "express";
import * as z from "zod";
import { getOutletById } from "../../../lib/outlet";
import { NotFoundException } from "../../../exceptions/not-found";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { PrinterSize, PrintLocationType } from "@prisma/client";

// Validation schemas
const printerSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  connectionType: z.enum(["LAN", "WIFI", "BLUETOOTH", "USB"]),
  printerType: z.enum(["THERMAL", "DOT_MATRIX", "INKJET"]).default("THERMAL"),

  // Connection details based on type
  ipAddress: z.string().ip().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  macAddress: z.string().optional(),
  bluetoothName: z.string().optional(),
  usbVendorId: z.string().optional(),
  usbProductId: z.string().optional(),

  // Printer settings
  paperWidth: z.nativeEnum(PrinterSize),
  dpi: z.coerce.number().int().optional(),
  defaultFont: z.string().optional(),
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

// Update printer
export const updatePrinter = async (req: Request, res: Response) => {
  const { outletId, printerId } = req.params;
  const outlet = await getOutletById(outletId);

  if (!outlet) {
    throw new NotFoundException("Outlet not found", ErrorCode.OUTLET_NOT_FOUND);
  }

  const validatedData = printerSchema.partial().parse(req.body);

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

  const updatedPrinter = await prismaDB.printer.update({
    where: {
      id: printerId,
    },
    data: validatedData,
  });

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
