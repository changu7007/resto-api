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
exports.initializeEodScheduler = void 0;
const croner_1 = require("croner");
const __1 = require("..");
const eodServices_1 = require("../services/eodServices");
// Initialize EOD scheduler
function initializeEodScheduler() {
    const eodService = new eodServices_1.EodServices();
    // Schedule EOD process at 11:59 PM Indian time (UTC+5:30)
    // Cron expression: 59 23 * * * (for 11:59 PM)
    new croner_1.Cron("59 23 * * *", () => __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("Starting EOD process for all restaurants");
            // Get all restaurants
            const restaurants = yield __1.prismaDB.restaurant.findMany({
                select: { id: true },
            });
            // Process each restaurant
            for (const restaurant of restaurants) {
                try {
                    const result = yield eodService.processEndOfDay(restaurant.id);
                    console.log(`EOD process completed for restaurant ${restaurant.id}:`, result);
                }
                catch (error) {
                    console.error(`Error processing EOD for restaurant ${restaurant.id}:`, error);
                }
            }
        }
        catch (error) {
            console.error("Error in EOD scheduler:", error);
        }
    }));
}
exports.initializeEodScheduler = initializeEodScheduler;
