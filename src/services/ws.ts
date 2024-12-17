import WebSocket from "ws";
import http from "http";

interface ClientData {
  ws: WebSocket;
  restaurantId: string;
}

class WebSocketManager {
  private wss: WebSocket.Server | null = null;
  private clients: Map<WebSocket, ClientData> = new Map();

  initialize(server: http.Server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on("connection", (ws) => {
      console.log("New WebSocket connection");

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data?.type === "register" && data?.restaurantId) {
            // Register client with their restaurantId
            this.clients.set(ws, { ws, restaurantId: data.restaurantId });
            console.log(
              `Client registered for restaurantId: ${data.restaurantId}`
            );
          }
        } catch (error) {
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

  notifyClients(restaurantId: string, message: string) {
    if (!this.wss) {
      console.error("WebSocket server not initialized");
      return;
    }

    this.clients.forEach((clientData) => {
      if (
        clientData.restaurantId === restaurantId &&
        clientData.ws.readyState === WebSocket.OPEN
      ) {
        clientData.ws.send(message);
      }
    });
  }
}

export const websocketManager = new WebSocketManager();
