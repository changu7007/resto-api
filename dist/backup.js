"use strict";
// // // backup-sites.ts
// import { PrismaClient } from "@prisma/client";
// import * as fs from "fs";
// const prisma = new PrismaClient();
// async function backupSiteRelationships() {
//   try {
//     // Get all restaurants with their sites
//     const restaurants = await prisma.restaurant.findMany({
//       include: {
//         sites: true,
//       },
//     });
//     // Create backup data structure
//     const backupData = restaurants.map((restaurant) => ({
//       restaurantId: restaurant.id,
//       siteIds: restaurant.sites.map((site) => site.id),
//       restaurantName: restaurant.name,
//     }));
//     // Save to file
//     fs.writeFileSync(
//       "site-relationships-backup.json",
//       JSON.stringify(backupData, null, 2)
//     );
//     console.log("Backup completed successfully");
//     console.log(
//       `Backed up ${restaurants.length} restaurant-site relationships`
//     );
//   } catch (error) {
//     console.error("Backup failed:", error);
//   } finally {
//     await prisma.$disconnect();
//   }
// }
// backupSiteRelationships();
