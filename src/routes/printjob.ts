import { Router } from "express";
import { errorHandler } from "../error-handler";
import {
  getPendingPrintJobs,
  getPrintJobStatus,
  updatePrintJobStatus,
  updateFormattedContent,
} from "../controllers/outlet/printers/print-job-controller";

const printJobRoute: Router = Router();

printJobRoute.get("/print-jobs/pending", errorHandler(getPendingPrintJobs));
printJobRoute.put(
  "/print-jobs/:jobId/status",
  errorHandler(updatePrintJobStatus)
);
printJobRoute.put(
  "/print-jobs/:jobId/formatted-content",
  errorHandler(updateFormattedContent)
);
printJobRoute.get("/print-jobs/:jobId", errorHandler(getPrintJobStatus));
export default printJobRoute;
