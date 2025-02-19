import { Router } from "express";
import authRoute from "./auth";
import outletRoute from "./outlet/route";
import onboardingRoute from "./onboarding/route";
import appRoute from "./app/route";
import posRoute from "./pos";

const rootRouter: Router = Router();

rootRouter.use("/auth", authRoute);
rootRouter.use("/outlet", outletRoute);
rootRouter.use("/onboarding", onboardingRoute);
rootRouter.use("/app", appRoute);
rootRouter.use("/pos", posRoute);

export default rootRouter;
