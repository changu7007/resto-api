"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = __importDefault(require("./auth"));
const route_1 = __importDefault(require("./outlet/route"));
const route_2 = __importDefault(require("./onboarding/route"));
const route_3 = __importDefault(require("./app/route"));
const pos_1 = __importDefault(require("./pos"));
const rootRouter = (0, express_1.Router)();
rootRouter.use("/auth", auth_1.default);
rootRouter.use("/outlet", route_1.default);
rootRouter.use("/onboarding", route_2.default);
rootRouter.use("/app", route_3.default);
rootRouter.use("/pos", pos_1.default);
exports.default = rootRouter;
