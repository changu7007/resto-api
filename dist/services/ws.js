"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.websocketManager = void 0;
const ws_1 = __importDefault(require("ws"));
class WebSocketManager {
    constructor() {
        this.wss = null;
    }
    initialize(server) {
        this.wss = new ws_1.default.Server({ server });
        this.wss.on("connection", (ws) => {
            console.log("New WebSocket connection");
            ws.on("message", (message) => {
                console.log("Received:", message);
            });
        });
    }
    notifyClients(message) {
        if (!this.wss) {
            console.error("WebSocket server not initialized");
            return;
        }
        this.wss.clients.forEach((client) => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(message);
            }
        });
    }
}
exports.websocketManager = new WebSocketManager();
