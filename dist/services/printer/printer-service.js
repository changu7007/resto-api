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
exports.PrinterService = void 0;
// services/printer/printer-service.ts
const types_1 = require("./types");
const net = __importStar(require("net"));
class PrinterService {
    constructor(config) {
        this.config = config;
        this.lineWidth = this.getPaperWidth();
    }
    getPaperWidth() {
        switch (this.config.paperWidth) {
            case types_1.PrinterSize.MM_58:
                return 32; // 32 characters per line
            case types_1.PrinterSize.MM_76:
                return 42; // 42 characters per line
            case types_1.PrinterSize.MM_80:
                return 48; // 48 characters per line
            default:
                return 32;
        }
    }
    formatText(text) {
        // Add basic ESC/POS commands
        let buffer = "";
        // Initialize printer
        buffer += "\x1B\x40"; // ESC @ - Initialize printer
        // Add text
        buffer += text;
        // Add line feeds
        buffer += "\x0A\x0A"; // Two line feeds
        return buffer;
    }
    print(options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const formattedText = this.formatText(options.content);
                switch (this.config.connectionType) {
                    case types_1.PrinterConnectionType.LAN:
                    case types_1.PrinterConnectionType.WIFI:
                        return yield this.printNetwork(formattedText, options);
                    case types_1.PrinterConnectionType.BLUETOOTH:
                        return yield this.printBluetooth(formattedText, options);
                    case types_1.PrinterConnectionType.USB:
                        return yield this.printUSB(formattedText, options);
                    default:
                        throw new Error("Unsupported printer connection type");
                }
            }
            catch (error) {
                console.error("Print error:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error occurred",
                };
            }
        });
    }
    printNetwork(content, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { ipAddress, port } = this.config;
            if (!ipAddress || !port) {
                throw new Error("IP address and port are required for network printing");
            }
            return new Promise((resolve) => {
                const client = new net.Socket();
                client.connect(port, ipAddress, () => {
                    console.log("Connected to printer");
                    // Send content
                    client.write(content);
                    // Add paper cut command if requested
                    if (options.cutPaper) {
                        client.write("\x1D\x56\x41\x00"); // GS V A - Paper cut
                    }
                    // Add cash drawer command if requested
                    if (options.openCashDrawer) {
                        client.write("\x1B\x70\x00\x19\xFA"); // ESC p 0 25 250 - Open cash drawer
                    }
                    client.end();
                });
                client.on("error", (error) => {
                    console.error("Network printer error:", error);
                    resolve({
                        success: false,
                        error: error.message,
                    });
                });
                client.on("close", () => {
                    resolve({
                        success: true,
                    });
                });
            });
        });
    }
    printBluetooth(content, options) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Implement Bluetooth printing using a Node.js Bluetooth library
            // For now, return not implemented
            return {
                success: false,
                error: "Bluetooth printing not implemented for backend service",
            };
        });
    }
    printUSB(content, options) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Implement USB printing using a Node.js USB library
            // For now, return not implemented
            return {
                success: false,
                error: "USB printing not implemented for backend service",
            };
        });
    }
}
exports.PrinterService = PrinterService;
