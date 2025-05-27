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
exports.billQueueWorker = void 0;
const bullmq_1 = require("bullmq");
const whatsapp_1 = require("../whatsapp");
const orderSessionController_1 = require("../../controllers/outlet/order/orderSession/orderSessionController");
const __1 = require("../..");
const config_1 = require("./config");
class BillQueueWorker {
    constructor() {
        this.whatsappService = new whatsapp_1.WhatsAppService({
            accessToken: process.env.META_ACCESS_TOKEN,
            phoneNumberId: process.env.META_PHONE_NUMBER_ID,
            businessAccountId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID,
            version: "v21.0",
        });
        this.worker = new bullmq_1.Worker(config_1.QUEUE_NAME, this.processJob.bind(this), {
            connection: config_1.connection,
            concurrency: 5,
            limiter: {
                max: 1000,
                duration: 1000,
            },
        });
        this.queueEvents = new bullmq_1.QueueEvents(config_1.QUEUE_NAME, { connection: config_1.connection });
        this.setupListeners();
    }
    processJob(job) {
        return __awaiter(this, void 0, void 0, function* () {
            const { invoiceData, outletId, phoneNumber, whatsappData, ownerPhone, paymentData, } = job.data;
            try {
                console.log(`Queue Job Started for ${job.id}`);
                // Generate PDF
                const { invoiceUrl } = yield (0, orderSessionController_1.generatePdfInvoice)(invoiceData);
                console.log(`Queue Job Completed for ${job.id}`);
                // Send WhatsApp messages in parallel if phone number exists
                // const promises = [];
                // if (phoneNumber) {
                //   promises.push(
                //     this.whatsappService.sendBillToCustomer({
                //       ...whatsappData,
                //       phoneNumber,
                //     })
                //   );
                // }
                // promises.push(
                //   this.whatsappService.sendPaymentNotificationToOwner({
                //     ...paymentData,
                //     phoneNumber: ownerPhone,
                //   })
                // );
                // await Promise.all(promises);
                // Update invoice URL in database
                yield __1.prismaDB.orderSession.update({
                    where: { id: invoiceData.orderSessionId },
                    data: { invoiceUrl },
                });
                console.log(`Invoice URL updated for ${invoiceData.orderSessionId}`);
                __1.logger.info("Bill processing completed successfully", {
                    orderSessionId: invoiceData.orderSessionId,
                    outletId,
                    jobId: job.id,
                });
                return { success: true, invoiceUrl };
            }
            catch (error) {
                console.log(`Bill processing failed for ${job.id}`);
                __1.logger.error("Bill processing failed", {
                    error,
                    orderSessionId: invoiceData.orderSessionId,
                    outletId,
                    jobId: job.id,
                });
                throw error;
            }
        });
    }
    setupListeners() {
        this.worker.on("failed", (job, error) => {
            __1.logger.error("Job failed", {
                jobId: job === null || job === void 0 ? void 0 : job.id,
                error,
                data: job === null || job === void 0 ? void 0 : job.data,
            });
        });
        this.worker.on("completed", (job) => {
            __1.logger.info("Job completed", {
                jobId: job.id,
                data: job.data,
            });
        });
        this.worker.on("error", (error) => {
            __1.logger.error("Worker error:", error);
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.worker.close();
            yield this.queueEvents.close();
        });
    }
}
// Create and export worker instance
exports.billQueueWorker = new BillQueueWorker();
// Graceful shutdown
process.on("SIGTERM", () => __awaiter(void 0, void 0, void 0, function* () {
    yield exports.billQueueWorker.close();
    yield config_1.connection.quit();
}));
process.on("SIGINT", () => __awaiter(void 0, void 0, void 0, function* () {
    yield exports.billQueueWorker.close();
    yield config_1.connection.quit();
}));
