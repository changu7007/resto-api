"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrinterStatus = exports.PrintLocationType = exports.PrinterType = exports.PrinterConnectionType = exports.PrinterSize = void 0;
const client_1 = require("@prisma/client");
Object.defineProperty(exports, "PrinterSize", { enumerable: true, get: function () { return client_1.PrinterSize; } });
Object.defineProperty(exports, "PrinterConnectionType", { enumerable: true, get: function () { return client_1.PrinterConnectionType; } });
Object.defineProperty(exports, "PrinterType", { enumerable: true, get: function () { return client_1.PrinterType; } });
Object.defineProperty(exports, "PrintLocationType", { enumerable: true, get: function () { return client_1.PrintLocationType; } });
var PrinterStatus;
(function (PrinterStatus) {
    PrinterStatus["ONLINE"] = "ONLINE";
    PrinterStatus["OFFLINE"] = "OFFLINE";
    PrinterStatus["ERROR"] = "ERROR";
    PrinterStatus["CONNECTING"] = "CONNECTING";
    PrinterStatus["PAPER_OUT"] = "PAPER_OUT";
})(PrinterStatus || (exports.PrinterStatus = PrinterStatus = {}));
