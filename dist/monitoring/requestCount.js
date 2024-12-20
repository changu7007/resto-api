"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeRequestsGauge = exports.httpRequestDurationMicroseconds = exports.requestCounter = void 0;
const prom_client_1 = __importDefault(require("prom-client"));
exports.requestCounter = new prom_client_1.default.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
});
exports.httpRequestDurationMicroseconds = new prom_client_1.default.Histogram({
    name: "http_request_duration_ms",
    help: "Duration of HTTP requests in ms",
    labelNames: ["method", "route", "code"],
    buckets: [0.1, 5, 15, 50, 100, 300, 500, 1000, 3000, 5000], // Define your own buckets here
});
exports.activeRequestsGauge = new prom_client_1.default.Gauge({
    name: "active_requests",
    help: "Number of active requests",
});
