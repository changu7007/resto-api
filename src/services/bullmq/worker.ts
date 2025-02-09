import { Worker, QueueEvents } from "bullmq";
import { WhatsAppService } from "../whatsapp";
import { generatePdfInvoice } from "../../controllers/outlet/order/orderSession/orderSessionController";
import { logger, prismaDB } from "../..";
import { BillQueueData, QUEUE_NAME, connection } from "./config";

class BillQueueWorker {
  private worker: Worker;
  private queueEvents: QueueEvents;
  private whatsappService: WhatsAppService;

  constructor() {
    this.whatsappService = new WhatsAppService({
      accessToken: process.env.META_ACCESS_TOKEN!,
      phoneNumberId: process.env.META_PHONE_NUMBER_ID!,
      businessAccountId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID!,
      version: "v21.0",
    });

    this.worker = new Worker<BillQueueData>(
      QUEUE_NAME,
      this.processJob.bind(this),
      {
        connection,
        concurrency: 5,
        limiter: {
          max: 1000,
          duration: 1000,
        },
      }
    );

    this.queueEvents = new QueueEvents(QUEUE_NAME, { connection });
    this.setupListeners();
  }

  private async processJob(job: any) {
    const {
      invoiceData,
      outletId,
      phoneNumber,
      whatsappData,
      ownerPhone,
      paymentData,
    } = job.data;

    try {
      console.log(`Queue Job Started for ${job.id}`);
      // Generate PDF
      const { invoiceUrl } = await generatePdfInvoice(invoiceData);
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
      await prismaDB.orderSession.update({
        where: { id: invoiceData.orderSessionId },
        data: { invoiceUrl },
      });
      console.log(`Invoice URL updated for ${invoiceData.orderSessionId}`);
      logger.info("Bill processing completed successfully", {
        orderSessionId: invoiceData.orderSessionId,
        outletId,
        jobId: job.id,
      });

      return { success: true, invoiceUrl };
    } catch (error) {
      console.log(`Bill processing failed for ${job.id}`);
      logger.error("Bill processing failed", {
        error,
        orderSessionId: invoiceData.orderSessionId,
        outletId,
        jobId: job.id,
      });
      throw error;
    }
  }

  private setupListeners() {
    this.worker.on("failed", (job, error) => {
      logger.error("Job failed", {
        jobId: job?.id,
        error,
        data: job?.data,
      });
    });

    this.worker.on("completed", (job) => {
      logger.info("Job completed", {
        jobId: job.id,
        data: job.data,
      });
    });

    this.worker.on("error", (error) => {
      logger.error("Worker error:", error);
    });
  }

  async close() {
    await this.worker.close();
    await this.queueEvents.close();
  }
}

// Create and export worker instance
export const billQueueWorker = new BillQueueWorker();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await billQueueWorker.close();
  await connection.quit();
});

process.on("SIGINT", async () => {
  await billQueueWorker.close();
  await connection.quit();
});
