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
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderQueueProducer = exports.billQueueProducer = void 0;
const bullmq_1 = require("bullmq");
const __1 = require("../..");
const config_1 = require("./config");
class BillQueueProducer {
    constructor() {
        this.queue = new bullmq_1.Queue(config_1.QUEUE_NAME, {
            connection: config_1.connection,
            defaultJobOptions: config_1.defaultJobOptions,
        });
    }
    addJob(data, jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const job = yield this.queue.add("process-bill", data, Object.assign({ jobId }, config_1.defaultJobOptions));
                console.log(`Job added to queue`, {
                    jobId: job.id,
                    outletId: data.outletId,
                });
                __1.logger.info("Job added to queue", {
                    jobId: job.id,
                    outletId: data.outletId,
                });
                return job;
            }
            catch (error) {
                __1.logger.error("Failed to add job to queue", {
                    error,
                    outletId: data.outletId,
                });
                throw error;
            }
        });
    }
    getQueueStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            const [waiting, active, completed, failed, delayed] = yield Promise.all([
                this.queue.getWaitingCount(),
                this.queue.getActiveCount(),
                this.queue.getCompletedCount(),
                this.queue.getFailedCount(),
                this.queue.getDelayedCount(),
            ]);
            return {
                waiting,
                active,
                completed,
                failed,
                delayed,
            };
        });
    }
    retryFailedJobs() {
        return __awaiter(this, void 0, void 0, function* () {
            const failed = yield this.queue.getFailed();
            return Promise.all(failed.map((job) => job.retry()));
        });
    }
    cleanOldJobs(grace = 24 * 3600 * 1000) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.queue.clean(grace, 2);
            yield this.queue.clean(grace, 3);
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.queue.close();
        });
    }
}
exports.billQueueProducer = new BillQueueProducer();
class OrderQueueProducer {
    constructor() {
        this.queue = new bullmq_1.Queue(config_1.ORDER_QUEUE_NAME, {
            connection: config_1.connection,
            defaultJobOptions: config_1.defaultJobOptions,
        });
    }
    addJob(data, jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const job = yield this.queue.add("process-order", data, Object.assign({ jobId }, config_1.defaultJobOptions));
                console.log(`Order Job added to queue`, {
                    jobId: job.id,
                    outletId: data.outletId,
                });
                __1.logger.info("Order Job added to queue", {
                    jobId: job.id,
                    outletId: data.outletId,
                });
                return job;
            }
            catch (error) {
                __1.logger.error("Failed to add order job to queue", {
                    error,
                    outletId: data.outletId,
                });
                throw error;
            }
        });
    }
    getQueueStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            const [waiting, active, completed, failed, delayed] = yield Promise.all([
                this.queue.getWaitingCount(),
                this.queue.getActiveCount(),
                this.queue.getCompletedCount(),
                this.queue.getFailedCount(),
                this.queue.getDelayedCount(),
            ]);
            return {
                waiting,
                active,
                completed,
                failed,
                delayed,
            };
        });
    }
    retryFailedJobs() {
        return __awaiter(this, void 0, void 0, function* () {
            const failed = yield this.queue.getFailed();
            return Promise.all(failed.map((job) => job.retry()));
        });
    }
    cleanOldJobs(grace = 24 * 3600 * 1000) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.queue.clean(grace, 2);
            yield this.queue.clean(grace, 3);
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.queue.close();
        });
    }
}
exports.orderQueueProducer = new OrderQueueProducer();
