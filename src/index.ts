import express, { Express, Request, Response } from "express";
import { PORT } from "./secrets";
import rootRouter from "./routes";
import { PrismaClient } from "@prisma/client";
import { errorMiddelware } from "./middlewares/errors";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import http from "http";
import { websocketManager } from "./services/ws";
import client from "prom-client";
import LokiTransport from "winston-loki";
import { createLogger } from "winston";
import { cleanupMiddleware } from "./monitoring";

const options = {
  transports: [
    new LokiTransport({
      labels: { appName: "RB-API" },
      host: "http://127.0.0.1:3100",
    }),
  ],
};

export const logger = createLogger(options);

const app: Express = express();
const server = http.createServer(app);

websocketManager.initialize(server);

app.use(cleanupMiddleware);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use("/api", rootRouter);
app.use(errorMiddelware);

export const prismaDB = new PrismaClient();

app.get("/health", async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "I am Healhty",
  });
});

app.get("/metrics", async (req, res) => {
  res.setHeader("Content-Type", client.register.contentType);
  const metrics = await client.register.metrics();
  res.send(metrics);
});

server.listen(PORT, () => console.log(`Main Server Working on PORT:${PORT}`));
