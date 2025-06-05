"use strict";
// // // migration-script.ts
// import { PrismaClient } from "@prisma/client";
// import { createLogger, format, transports } from "winston";
// import * as fs from "fs";
// const logger = createLogger({
//   format: format.combine(format.timestamp(), format.json()),
//   transports: [
//     new transports.File({ filename: "migration-error.log", level: "error" }),
//     new transports.File({ filename: "migration-combined.log" }),
//     new transports.Console({
//       format: format.simple(),
//     }),
//   ],
// });
// const prisma = new PrismaClient();
// interface MigrationStats {
//   totalRestaurants: number;
//   restaurantsWithSites: number;
//   restaurantsWithMultipleSites: number;
//   restaurantsWithOneSite: number;
//   restaurantsSkipped: number;
//   errors: number;
// }
// async function migrateSites() {
//   const stats: MigrationStats = {
//     totalRestaurants: 0,
//     restaurantsWithSites: 0,
//     restaurantsWithMultipleSites: 0,
//     restaurantsWithOneSite: 0,
//     restaurantsSkipped: 0,
//     errors: 0,
//   };
//   try {
//     // Load backup data
//     const backupData = JSON.parse(
//       fs.readFileSync("site-relationships-backup.json", "utf-8")
//     );
//     stats.totalRestaurants = backupData.length;
//     logger.info(`Starting migration for ${backupData.length} restaurants`);
//     // Start transaction
//     await prisma.$transaction(async (tx) => {
//       for (const restaurantData of backupData) {
//         try {
//           if (restaurantData.siteIds.length === 0) {
//             // Skip restaurants with no sites
//             stats.restaurantsSkipped++;
//             logger.info(
//               `Skipping restaurant ${restaurantData.restaurantName} - no sites found`
//             );
//             continue;
//           }
//           if (restaurantData.siteIds.length > 1) {
//             // Case: Restaurant has multiple sites
//             stats.restaurantsWithMultipleSites++;
//             logger.info(
//               `Handling multiple sites for restaurant: ${restaurantData.restaurantName}`
//             );
//             // Use the first site as primary
//             const primarySiteId = restaurantData.siteIds[0];
//             // Update restaurant to use primary site
//             await tx.restaurant.update({
//               where: { id: restaurantData.restaurantId },
//               data: {
//                 siteId: primarySiteId,
//               },
//             });
//             // Log other sites for review
//             logger.info(
//               `Restaurant ${restaurantData.restaurantName} had ${
//                 restaurantData.siteIds.length - 1
//               } additional sites`
//             );
//           } else {
//             // Case: Restaurant has exactly one site
//             stats.restaurantsWithOneSite++;
//             logger.info(
//               `Updating single site relationship for restaurant: ${restaurantData.restaurantName}`
//             );
//             await tx.restaurant.update({
//               where: { id: restaurantData.restaurantId },
//               data: {
//                 siteId: restaurantData.siteIds[0],
//               },
//             });
//           }
//           stats.restaurantsWithSites++;
//         } catch (error) {
//           stats.errors++;
//           logger.error(
//             `Error processing restaurant ${restaurantData.restaurantName}:`,
//             error
//           );
//           continue;
//         }
//       }
//     });
//     // Verify migration
//     const verificationResults = await verifyMigration();
//     logger.info("Migration verification results:", verificationResults);
//     // Log final statistics
//     logger.info("Migration completed with stats:", stats);
//   } catch (error) {
//     logger.error("Migration failed:", error);
//     throw error;
//   } finally {
//     await prisma.$disconnect();
//   }
// }
// async function verifyMigration() {
//   const results = {
//     totalRestaurants: 0,
//     restaurantsWithSites: 0,
//     restaurantsWithoutSites: 0,
//     duplicateSubdomains: 0,
//   };
//   // Check all restaurants
//   const restaurants = await prisma.restaurant.findMany({
//     include: {
//       site: true,
//     },
//   });
//   results.totalRestaurants = restaurants.length;
//   results.restaurantsWithSites = restaurants.filter((r) => r.siteId).length;
//   results.restaurantsWithoutSites = restaurants.filter((r) => !r.siteId).length;
//   // Check for duplicate subdomains
//   const sites = await prisma.site.findMany({
//     select: {
//       subdomain: true,
//       _count: {
//         select: {
//           restaurants: true,
//         },
//       },
//     },
//   });
//   results.duplicateSubdomains = sites.filter(
//     (site) => site._count.restaurants > 1
//   ).length;
//   return results;
// }
// // Run the migration
// migrateSites()
//   .then(() => {
//     logger.info("Migration completed successfully");
//     process.exit(0);
//   })
//   .catch((error) => {
//     logger.error("Migration failed:", error);
//     process.exit(1);
//   });
