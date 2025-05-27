import { Request, Response } from "express";
import { getOutletById } from "../../../lib/outlet";
import { BadRequestsException } from "../../../exceptions/bad-request";
import { ErrorCode } from "../../../exceptions/root";
import { prismaDB } from "../../..";
import { websocketManager } from "../../../services/ws";

export const getPendingPrintJobs = async (req: Request, res: Response) => {
  const { restaurantId } = req.query;

  const outlet = await getOutletById(restaurantId as string);

  if (!outlet) {
    throw new BadRequestsException(
      "Restaurant ID is required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const printJobs = await prismaDB.printJob.findMany({
    where: {
      restaurantId: outlet.id,
      status: "pending",
    },
    orderBy: {
      createdAt: "asc",
    },
    // take: 10, // Limit to 10 jobs at a time
  });

  // Mark these jobs as "processing" to prevent duplicate processing
  if (printJobs.length > 0) {
    await prismaDB.printJob.updateMany({
      where: {
        id: {
          in: printJobs.map((job) => job.id),
        },
      },
      data: {
        status: "processing",
        updatedAt: new Date(),
      },
    });
  }

  return res.json({
    success: true,
    message: "Print jobs fetched successfully",
    data: printJobs,
  });
};

// Update print job status
export const updatePrintJobStatus = async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const { success, error, formattedContent } = req.body;

  const findPrintJob = await prismaDB.printJob.findUnique({
    where: {
      id: jobId,
    },
  });

  if (!findPrintJob) {
    throw new BadRequestsException("Print job not found", ErrorCode.NOT_FOUND);
  }

  // Update data object based on what's provided
  const updateData: any = {
    status: success ? "completed" : "failed",
    updatedAt: new Date(),
  };

  // Only add error if it's provided
  if (error !== undefined) {
    updateData.error = error || null;
  }

  // Only add formattedContent if it's provided
  if (formattedContent !== undefined) {
    updateData.content = formattedContent;
  }

  const printJob = await prismaDB.printJob.update({
    where: {
      id: jobId,
    },
    data: updateData,
  });

  // Notify about job status update
  if (printJob.restaurantId) {
    websocketManager.notifyClients(printJob.restaurantId, "print_job_status", {
      type: "print_job_status",
      data: {
        jobId: printJob.id,
        status: printJob.status,
        error: printJob.error,
        formattedContent: printJob.content,
      },
    });
  }

  return res.json({
    success: true,
    message: "Print job updated successfully",
    data: printJob,
  });
};

// Update formatted content for a print job
export const updateFormattedContent = async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const { formattedContent } = req.body;

  if (!formattedContent) {
    throw new BadRequestsException(
      "Formatted content is required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const findPrintJob = await prismaDB.printJob.findUnique({
    where: {
      id: jobId,
    },
  });

  if (!findPrintJob) {
    throw new BadRequestsException("Print job not found", ErrorCode.NOT_FOUND);
  }

  try {
    const printJob = await prismaDB.printJob.update({
      where: {
        id: jobId,
      },
      data: {
        content: formattedContent,
        updatedAt: new Date(),
      },
    });

    // Notify about job update
    if (printJob.restaurantId) {
      websocketManager.notifyClients(
        printJob.restaurantId,
        "print_job_update",
        {
          type: "print_job_update",
          data: {
            jobId: printJob.id,
            content: printJob.content,
          },
        }
      );
    }

    return res.json({
      success: true,
      message: "Print job formatted content updated successfully",
      data: printJob,
    });
  } catch (error: any) {
    console.error("Error updating formatted content:", error);
    throw new BadRequestsException(
      `Failed to update formatted content: ${error.message}`,
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }
};

export const getPrintJobStatus = async (req: Request, res: Response) => {
  const { jobId } = req.params;

  const printJob = await prismaDB.printJob.findUnique({
    where: {
      id: jobId,
    },
  });

  if (!printJob) {
    return res.status(404).json({
      success: false,
      message: "Print job not found",
    });
  }

  return res.json({
    success: true,
    data: {
      id: printJob.id,
      status: printJob.status,
      error: printJob.error,
      createdAt: printJob.createdAt,
      updatedAt: printJob.updatedAt,
    },
  });
};

/**
 * Reset stalled print jobs
 * This should be called periodically to reset jobs that have been stuck in "processing" state
 */
export const resetStalledPrintJobs = async (req: Request, res: Response) => {
  // Find jobs that have been in "processing" state for more than 1 hour
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const stalledJobs = await prismaDB.printJob.updateMany({
    where: {
      status: "processing",
      updatedAt: {
        lt: oneHourAgo,
      },
    },
    data: {
      status: "pending",
      updatedAt: new Date(),
    },
  });

  console.log(`Reset ${stalledJobs.count} stalled print jobs`);
  return res.json({
    success: true,
    message: `Reset ${stalledJobs.count} stalled print jobs`,
    data: stalledJobs.count,
  });
};
