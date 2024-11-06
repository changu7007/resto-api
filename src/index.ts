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
import cron from "node-cron";

import { createPayrollForStaff } from "./lib/payroll";

const app: Express = express();
const server = http.createServer(app);
websocketManager.initialize(server);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use("/api", rootRouter);

export const prismaDB = new PrismaClient();

app.use(errorMiddelware);

server.listen(PORT, () => console.log(`Main Server Working on PORT:${PORT}`));
