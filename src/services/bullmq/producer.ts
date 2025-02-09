import { Queue } from "bullmq";
import { logger } from "../..";
import {
  BillQueueData,
  QUEUE_NAME,
  connection,
  defaultJobOptions,
} from "./config";

class BillQueueProducer {
  private queue: Queue<BillQueueData>;

  constructor() {
    this.queue = new Queue<BillQueueData>(QUEUE_NAME, {
      connection,
      defaultJobOptions,
    });
  }

  async addJob(data: BillQueueData, jobId: string) {
    try {
      const job = await this.queue.add("process-bill", data, {
        jobId,
        ...defaultJobOptions,
      });
      console.log(`Job added to queue`, {
        jobId: job.id,
        outletId: data.outletId,
      });
      logger.info("Job added to queue", {
        jobId: job.id,
        outletId: data.outletId,
      });

      return job;
    } catch (error) {
      logger.error("Failed to add job to queue", {
        error,
        outletId: data.outletId,
      });
      throw error;
    }
  }

  async getQueueStatus() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
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
  }

  async retryFailedJobs() {
    const failed = await this.queue.getFailed();
    return Promise.all(failed.map((job) => job.retry()));
  }

  async cleanOldJobs(grace: number = 24 * 3600 * 1000) {
    await this.queue.clean(grace, 2);
    await this.queue.clean(grace, 3);
  }

  async close() {
    await this.queue.close();
  }
}

export const billQueueProducer = new BillQueueProducer();
