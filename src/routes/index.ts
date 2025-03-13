import { Router } from "express";
import authRoute from "./auth";

import onboardingRoute from "./onboarding/route";
import appRoute from "./app/route";
import posRoute from "./pos";
import printJobRoute from "./printjob";
import outletRoute from "./outlet/route";

const rootRouter: Router = Router();

rootRouter.use("/auth", authRoute);
rootRouter.use("/outlet", outletRoute);
rootRouter.use("/onboarding", onboardingRoute);
rootRouter.use("/app", appRoute);
rootRouter.use("/pos", posRoute);
rootRouter.use("/printjob", printJobRoute);

export default rootRouter;
