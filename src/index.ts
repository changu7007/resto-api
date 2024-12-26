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
import responseTime from "response-time";
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
// const collectMetrics = client.collectDefaultMetrics;
// collectMetrics({ register: client.register });
websocketManager.initialize(server);

const reqResTime = new client.Histogram({
  name: "http_express_req_res_time",
  help: "This tells how much time is take by req & res",
  labelNames: ["method", "route", "status_code"],
  buckets: [1, 50, 100, 200, 400, 500, 800, 1000, 2000],
});

const totalReqCounter = new client.Counter({
  name: "total_req",
  help: "This tells total req",
});

// app.use(
//   responseTime((req, res, time) => {
//     totalReqCounter.inc();
//     reqResTime
//       .labels({
//         method: req.method,
//         route: req.url,
//         status_code: res.statusCode,
//       })
//       .observe(time);

//     // Log request metrics to Loki
//     logger.info({
//       message: "Request timing",
//       method: req.method,
//       path: req.url,
//       statusCode: res.statusCode,
//       responseTime: time,
//     });
//   })
// );
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
