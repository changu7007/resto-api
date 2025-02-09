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
import { initializeAlertCrons } from "./lib/alert-service";
import { billQueueWorker } from "./services/bullmq/worker";
import { setupCacheInvalidation } from "./controllers/outlet/stats/statsController";

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

logger.info("Worker process started");

// Keep the process running
process.on("SIGTERM", async () => {
  logger.info("Worker process terminating...");
  await billQueueWorker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("Worker process interrupted...");
  await billQueueWorker.close();
  process.exit(0);
});

// Log any unhandled errors
process.on("unhandledRejection", (error) => {
  logger.error("Unhandled rejection in worker:", error);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception in worker:", error);
});

app.use(cleanupMiddleware);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use("/api", rootRouter);
app.use(errorMiddelware);
setupCacheInvalidation();
initializeAlertCrons();

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
