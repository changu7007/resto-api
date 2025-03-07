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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrinterById = exports.getPrintersForLocation = exports.getPrintLocationsByTypes = exports.deletePrintLocation = exports.updatePrintLocation = exports.deletePrinter = exports.updatePrinter = exports.getPrinters = exports.getPrintLocations = exports.assignPrinterToLocation = exports.createPrintLocation = exports.createPrinter = void 0;
const z = __importStar(require("zod"));
const outlet_1 = require("../../../lib/outlet");
const not_found_1 = require("../../../exceptions/not-found");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const bad_request_1 = require("../../../exceptions/bad-request");
const client_1 = require("@prisma/client");
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
    paperWidth: z.nativeEnum(client_1.PrinterSize),
    dpi: z.coerce.number().int().optional(),
    defaultFont: z.string().optional(),
    cutPaper: z.boolean().default(true),
    openCashDrawer: z.boolean().default(false),
    isActive: z.boolean().default(true),
});
const printLocationSchema = z.object({
    name: z.string().min(1).max(50),
    type: z.nativeEnum(client_1.PrintLocationType),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
});
const printerLocationAssignmentSchema = z.object({
    printerId: z.string(),
    isDefault: z.boolean().default(false),
});
// Create printer
const createPrinter = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const validatedData = printerSchema.parse(req.body);
    // Validate connection details based on connection type
    if (validatedData.connectionType === "LAN" ||
        validatedData.connectionType === "WIFI") {
        if (!validatedData.ipAddress || !validatedData.port) {
            throw new bad_request_1.BadRequestsException("IP address and port are required for LAN/WIFI printers", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    else if (validatedData.connectionType === "BLUETOOTH") {
        if (!validatedData.macAddress) {
            throw new bad_request_1.BadRequestsException("MAC address is required for Bluetooth printers", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    else if (validatedData.connectionType === "USB") {
        if (!validatedData.usbVendorId || !validatedData.usbProductId) {
            throw new bad_request_1.BadRequestsException("USB vendor and product IDs are required for USB printers", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
    }
    const printer = yield __1.prismaDB.printer.create({
        data: Object.assign(Object.assign({}, validatedData), { restaurantId: outlet.id }),
    });
    return res.status(201).json(printer);
});
exports.createPrinter = createPrinter;
// Create print location
const createPrintLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const validatedData = printLocationSchema.parse(req.body);
    // Check for duplicate name
    const existingLocation = yield __1.prismaDB.printLocation.findFirst({
        where: {
            restaurantId: outlet.id,
            name: validatedData.name,
        },
    });
    if (existingLocation) {
        throw new bad_request_1.BadRequestsException("Print location with this name already exists", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const printLocation = yield __1.prismaDB.printLocation.create({
        data: Object.assign(Object.assign({}, validatedData), { restaurantId: outlet.id }),
    });
    return res.status(201).json(printLocation);
});
exports.createPrintLocation = createPrintLocation;
// Assign printer to location
const assignPrinterToLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, locationId } = req.params;
    const validatedData = printerLocationAssignmentSchema.parse(req.body);
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Verify printer and location exist and belong to the restaurant
    const [printer, location] = yield Promise.all([
        __1.prismaDB.printer.findFirst({
            where: { id: validatedData.printerId, restaurantId: outlet.id },
        }),
        __1.prismaDB.printLocation.findFirst({
            where: { id: locationId, restaurantId: outlet.id },
        }),
    ]);
    if (!printer || !location) {
        throw new not_found_1.NotFoundException("Printer or location not found", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Create or update the printer-location assignment
    const assignment = yield __1.prismaDB.printerToLocation.upsert({
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
});
exports.assignPrinterToLocation = assignPrinterToLocation;
// Get print locations with assigned printers
const getPrintLocations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const printLocations = yield __1.prismaDB.printLocation.findMany({
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
});
exports.getPrintLocations = getPrintLocations;
// Get all printers
const getPrinters = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const printers = yield __1.prismaDB.printer.findMany({
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
});
exports.getPrinters = getPrinters;
// Update printer
const updatePrinter = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, printerId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const validatedData = printerSchema.partial().parse(req.body);
    const printer = yield __1.prismaDB.printer.findFirst({
        where: {
            id: printerId,
            restaurantId: outlet.id,
        },
    });
    if (!printer) {
        throw new not_found_1.NotFoundException("Printer not found", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const updatedPrinter = yield __1.prismaDB.printer.update({
        where: {
            id: printerId,
        },
        data: validatedData,
    });
    return res.json({
        success: true,
        data: updatedPrinter,
    });
});
exports.updatePrinter = updatePrinter;
// Delete printer
const deletePrinter = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, printerId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const printer = yield __1.prismaDB.printer.findFirst({
        where: {
            id: printerId,
            restaurantId: outlet.id,
        },
    });
    if (!printer) {
        throw new not_found_1.NotFoundException("Printer not found", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.printer.delete({
        where: {
            id: printerId,
        },
    });
    return res.json({
        success: true,
        message: "Printer deleted successfully",
    });
});
exports.deletePrinter = deletePrinter;
// Update print location
const updatePrintLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, locationId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const validatedData = printLocationSchema.partial().parse(req.body);
    const printLocation = yield __1.prismaDB.printLocation.findFirst({
        where: {
            id: locationId,
            restaurantId: outlet.id,
        },
    });
    if (!printLocation) {
        throw new not_found_1.NotFoundException("Print location not found", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const updatedLocation = yield __1.prismaDB.printLocation.update({
        where: {
            id: locationId,
        },
        data: validatedData,
    });
    return res.json({
        success: true,
        data: updatedLocation,
    });
});
exports.updatePrintLocation = updatePrintLocation;
// Delete print location
const deletePrintLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, locationId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const printLocation = yield __1.prismaDB.printLocation.findFirst({
        where: {
            id: locationId,
            restaurantId: outlet.id,
        },
    });
    if (!printLocation) {
        throw new not_found_1.NotFoundException("Print location not found", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    yield __1.prismaDB.printLocation.delete({
        where: {
            id: locationId,
        },
    });
    return res.json({
        success: true,
        message: "Print location deleted successfully",
    });
});
exports.deletePrintLocation = deletePrintLocation;
const getPrintLocationsByTypes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId } = req.params;
    const { types } = req.query;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Validate types parameter
    if (!types || typeof types !== "string") {
        throw new bad_request_1.BadRequestsException("Types parameter is required and should be comma-separated", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Parse and validate location types
    const locationTypes = types.split(",").map((type) => {
        if (!Object.values(client_1.PrintLocationType).includes(type)) {
            throw new bad_request_1.BadRequestsException(`Invalid location type: ${type}`, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        return type;
    });
    const printLocations = yield __1.prismaDB.printLocation.findMany({
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
});
exports.getPrintLocationsByTypes = getPrintLocationsByTypes;
// Get printers for a specific location
const getPrintersForLocation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, locationId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    // Verify location exists and belongs to the restaurant
    const location = yield __1.prismaDB.printLocation.findFirst({
        where: {
            id: locationId,
            restaurantId: outlet.id,
        },
    });
    if (!location) {
        throw new not_found_1.NotFoundException("Print location not found", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    // Get printers assigned to this location
    const printers = yield __1.prismaDB.printer.findMany({
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
});
exports.getPrintersForLocation = getPrintersForLocation;
// Get printer by ID
const getPrinterById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { outletId, printerId } = req.params;
    const outlet = yield (0, outlet_1.getOutletById)(outletId);
    if (!outlet) {
        throw new not_found_1.NotFoundException("Outlet not found", root_1.ErrorCode.OUTLET_NOT_FOUND);
    }
    const printer = yield __1.prismaDB.printer.findFirst({
        where: {
            id: printerId,
            restaurantId: outlet.id,
        },
    });
    if (!printer) {
        throw new not_found_1.NotFoundException("Printer not found", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    return res.json({
        success: true,
        data: printer,
    });
});
exports.getPrinterById = getPrinterById;
