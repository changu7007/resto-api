import { Cron } from "croner";
import { prismaDB } from "..";
import { EodServices } from "../services/eodServices";

// Initialize EOD scheduler
export function initializeEodScheduler() {
  const eodService = new EodServices();

  // Schedule EOD process at 11:59 PM Indian time (UTC+5:30)
  // Cron expression: 59 23 * * * (for 11:59 PM)
  new Cron("59 23 * * *", async () => {
    try {
      console.log("Starting EOD process for all restaurants");

      // Get all restaurants
      const restaurants = await prismaDB.restaurant.findMany({
        select: { id: true },
      });

      // Process each restaurant
      for (const restaurant of restaurants) {
        try {
          const result = await eodService.processEndOfDay(restaurant.id);
          console.log(
            `EOD process completed for restaurant ${restaurant.id}:`,
            result
          );
        } catch (error) {
          console.error(
            `Error processing EOD for restaurant ${restaurant.id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("Error in EOD scheduler:", error);
    }
  });
}
