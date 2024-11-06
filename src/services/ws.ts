import WebSocket from "ws";
import http from "http";

class WebSocketManager {
  private wss: WebSocket.Server | null = null;

  initialize(server: http.Server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on("connection", (ws) => {
      console.log("New WebSocket connection");

      ws.on("message", (message) => {
        console.log("Received:", message);
      });
    });
  }

  notifyClients(message: string) {
    if (!this.wss) {
      console.error("WebSocket server not initialized");
      return;
    }

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

export const websocketManager = new WebSocketManager();
