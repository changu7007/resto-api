// services/printer/printer-service.ts
import {
  PrinterConnectionType,
  PrinterSize,
  PrinterType,
  PrintResult,
} from "./types";
import * as net from "net";

interface PrinterConfig {
  connectionType: PrinterConnectionType;
  printerType: PrinterType;
  paperWidth: PrinterSize;
  ipAddress?: string;
  port?: number;
  macAddress?: string;
  usbVendorId?: string;
  usbProductId?: string;
}

interface PrintOptions {
  content: string;
  copies?: number;
  cutPaper?: boolean;
  openCashDrawer?: boolean;
}

export class PrinterService {
  private config: PrinterConfig;
  private lineWidth: number;

  constructor(config: PrinterConfig) {
    this.config = config;
    this.lineWidth = this.getPaperWidth();
  }

  private getPaperWidth(): number {
    switch (this.config.paperWidth) {
      case PrinterSize.MM_58:
        return 32; // 32 characters per line
      case PrinterSize.MM_76:
        return 42; // 42 characters per line
      case PrinterSize.MM_80:
        return 48; // 48 characters per line
      default:
        return 32;
    }
  }

  private formatText(text: string): string {
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

  async print(options: PrintOptions): Promise<PrintResult> {
    try {
      const formattedText = this.formatText(options.content);

      switch (this.config.connectionType) {
        case PrinterConnectionType.LAN:
        case PrinterConnectionType.WIFI:
          return await this.printNetwork(formattedText, options);
        case PrinterConnectionType.BLUETOOTH:
          return await this.printBluetooth(formattedText, options);
        case PrinterConnectionType.USB:
          return await this.printUSB(formattedText, options);
        default:
          throw new Error("Unsupported printer connection type");
      }
    } catch (error) {
      console.error("Print error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  private async printNetwork(
    content: string,
    options: PrintOptions
  ): Promise<PrintResult> {
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
  }

  private async printBluetooth(
    content: string,
    options: PrintOptions
  ): Promise<PrintResult> {
    // TODO: Implement Bluetooth printing using a Node.js Bluetooth library
    // For now, return not implemented
    return {
      success: false,
      error: "Bluetooth printing not implemented for backend service",
    };
  }

  private async printUSB(
    content: string,
    options: PrintOptions
  ): Promise<PrintResult> {
    // TODO: Implement USB printing using a Node.js USB library
    // For now, return not implemented
    return {
      success: false,
      error: "USB printing not implemented for backend service",
    };
  }
}
