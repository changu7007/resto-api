"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prismaDB = exports.logger = void 0;
const express_1 = __importDefault(require("express"));
const secrets_1 = require("./secrets");
const routes_1 = __importDefault(require("./routes"));
const client_1 = require("@prisma/client");
const errors_1 = require("./middlewares/errors");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("./services/ws");
const prom_client_1 = __importDefault(require("prom-client"));
const winston_loki_1 = __importDefault(require("winston-loki"));
const winston_1 = require("winston");
const monitoring_1 = require("./monitoring");
const alert_service_1 = require("./lib/alert-service");
const eod_scheduler_1 = require("./lib/eod-scheduler");
const worker_1 = require("./services/bullmq/worker");
const statsController_1 = require("./controllers/outlet/stats/statsController");
const options = {
    transports: [
        new winston_loki_1.default({
            labels: { appName: "RB-API" },
            host: "http://127.0.0.1:3100",
        }),
    ],
};
exports.logger = (0, winston_1.createLogger)(options);
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
ws_1.websocketManager.initialize(server);
exports.logger.info("Worker process started");
// Keep the process running
process.on("SIGTERM", () => __awaiter(void 0, void 0, void 0, function* () {
    exports.logger.info("Worker process terminating...");
    yield worker_1.billQueueWorker.close();
    process.exit(0);
}));
process.on("SIGINT", () => __awaiter(void 0, void 0, void 0, function* () {
    exports.logger.info("Worker process interrupted...");
    yield worker_1.billQueueWorker.close();
    process.exit(0);
}));
// Log any unhandled errors
process.on("unhandledRejection", (error) => {
    exports.logger.error("Unhandled rejection in worker:", error);
});
process.on("uncaughtException", (error) => {
    exports.logger.error("Uncaught exception in worker:", error);
});
app.use(monitoring_1.cleanupMiddleware);
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use((0, morgan_1.default)("dev"));
app.use("/api", routes_1.default);
app.use(errors_1.errorMiddelware);
(0, statsController_1.setupCacheInvalidation)();
(0, alert_service_1.initializeAlertCrons)();
(0, eod_scheduler_1.initializeEodScheduler)();
exports.prismaDB = new client_1.PrismaClient();
app.get("/health", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json({
        success: true,
        message: "I am Healhty",
    });
}));
app.get("/metrics", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.setHeader("Content-Type", prom_client_1.default.register.contentType);
    const metrics = yield prom_client_1.default.register.metrics();
    res.send(metrics);
}));
server.listen(secrets_1.PORT, () => console.log(`Main Server Working on PORT:${secrets_1.PORT}`));
