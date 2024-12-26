import client, { Histogram } from "prom-client";

export const requestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

export const httpRequestDurationMicroseconds = new client.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "code"],
  buckets: [0.1, 5, 15, 50, 100, 300, 500, 1000, 3000, 5000], // Define your own buckets here
});

export const activeRequestsGauge = new client.Gauge({
  name: "active_requests",
  help: "Number of active requests",
});

export const histogram = new Histogram({
  name: "request_time",
  help: "Time it took for a request to be handled",
  buckets: [0.1, 1, 5, 10, 100, 1000, 3000],
});
