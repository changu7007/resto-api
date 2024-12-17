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
        this.clients = new Map();
    }
    initialize(server) {
        this.wss = new ws_1.default.Server({ server });
        this.wss.on("connection", (ws) => {
            console.log("New WebSocket connection");
            ws.on("message", (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    if ((data === null || data === void 0 ? void 0 : data.type) === "register" && (data === null || data === void 0 ? void 0 : data.restaurantId)) {
                        // Register client with their restaurantId
                        this.clients.set(ws, { ws, restaurantId: data.restaurantId });
                        console.log(`Client registered for restaurantId: ${data.restaurantId}`);
                    }
                }
                catch (error) {
                    console.error("Error parsing message:", error);
                }
            });
            // Handle connection close
            ws.on("close", () => {
                this.clients.delete(ws);
                console.log("WebSocket connection closed");
            });
        });
    }
    notifyClients(restaurantId, message) {
        if (!this.wss) {
            console.error("WebSocket server not initialized");
            return;
        }
        this.clients.forEach((clientData) => {
            if (clientData.restaurantId === restaurantId &&
                clientData.ws.readyState === ws_1.default.OPEN) {
                clientData.ws.send(message);
            }
        });
    }
}
exports.websocketManager = new WebSocketManager();
