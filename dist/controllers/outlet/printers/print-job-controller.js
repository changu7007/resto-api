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
exports.resetStalledPrintJobs = exports.getPrintJobStatus = exports.updateFormattedContent = exports.updatePrintJobStatus = exports.getPendingPrintJobs = void 0;
const outlet_1 = require("../../../lib/outlet");
const bad_request_1 = require("../../../exceptions/bad-request");
const root_1 = require("../../../exceptions/root");
const __1 = require("../../..");
const ws_1 = require("../../../services/ws");
const getPendingPrintJobs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { restaurantId } = req.query;
    const outlet = yield (0, outlet_1.getOutletById)(restaurantId);
    if (!outlet) {
        throw new bad_request_1.BadRequestsException("Restaurant ID is required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const printJobs = yield __1.prismaDB.printJob.findMany({
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
        yield __1.prismaDB.printJob.updateMany({
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
});
exports.getPendingPrintJobs = getPendingPrintJobs;
// Update print job status
const updatePrintJobStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { jobId } = req.params;
    const { success, error, formattedContent } = req.body;
    const findPrintJob = yield __1.prismaDB.printJob.findUnique({
        where: {
            id: jobId,
        },
    });
    if (!findPrintJob) {
        throw new bad_request_1.BadRequestsException("Print job not found", root_1.ErrorCode.NOT_FOUND);
    }
    // Update data object based on what's provided
    const updateData = {
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
    const printJob = yield __1.prismaDB.printJob.update({
        where: {
            id: jobId,
        },
        data: updateData,
    });
    // Notify about job status update
    if (printJob.restaurantId) {
        ws_1.websocketManager.notifyClients(printJob.restaurantId, "print_job_status", {
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
});
exports.updatePrintJobStatus = updatePrintJobStatus;
// Update formatted content for a print job
const updateFormattedContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { jobId } = req.params;
    const { formattedContent } = req.body;
    if (!formattedContent) {
        throw new bad_request_1.BadRequestsException("Formatted content is required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
    const findPrintJob = yield __1.prismaDB.printJob.findUnique({
        where: {
            id: jobId,
        },
    });
    if (!findPrintJob) {
        throw new bad_request_1.BadRequestsException("Print job not found", root_1.ErrorCode.NOT_FOUND);
    }
    try {
        const printJob = yield __1.prismaDB.printJob.update({
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
            ws_1.websocketManager.notifyClients(printJob.restaurantId, "print_job_update", {
                type: "print_job_update",
                data: {
                    jobId: printJob.id,
                    content: printJob.content,
                },
            });
        }
        return res.json({
            success: true,
            message: "Print job formatted content updated successfully",
            data: printJob,
        });
    }
    catch (error) {
        console.error("Error updating formatted content:", error);
        throw new bad_request_1.BadRequestsException(`Failed to update formatted content: ${error.message}`, root_1.ErrorCode.UNPROCESSABLE_ENTITY);
    }
});
exports.updateFormattedContent = updateFormattedContent;
const getPrintJobStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { jobId } = req.params;
    const printJob = yield __1.prismaDB.printJob.findUnique({
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
});
exports.getPrintJobStatus = getPrintJobStatus;
/**
 * Reset stalled print jobs
 * This should be called periodically to reset jobs that have been stuck in "processing" state
 */
const resetStalledPrintJobs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Find jobs that have been in "processing" state for more than 1 hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const stalledJobs = yield __1.prismaDB.printJob.updateMany({
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
});
exports.resetStalledPrintJobs = resetStalledPrintJobs;
