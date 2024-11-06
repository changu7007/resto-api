import cron from "node-cron";
import { prismaDB } from "../..";
import { createPayrollForStaff } from "../../lib/payroll";

// Schedule payroll processing at the end of each month for monthly payrolls
cron.schedule("0 0 28-31 * *", async () => {
  try {
    const monthlyStaff = await prismaDB.staff.findMany({
      where: {
        payFrequency: "MONTHLY",
      },
    });

    for (const staff of monthlyStaff) {
      const response = await createPayrollForStaff(staff.id);
      console.log(`Payroll for ${staff.name}:`, response?.amountPaid);
    }
  } catch (error) {
    console.error("Error running payroll cron job:", error);
  }
});

// Schedule weekly payroll processing for weekly payrolls
cron.schedule("0 0 * * 0", async () => {
  try {
    const weeklyStaff = await prismaDB.staff.findMany({
      where: {
        payFrequency: "WEEKLY",
      },
    });

    for (const staff of weeklyStaff) {
      const response = await createPayrollForStaff(staff.id);
      console.log(`Payroll for ${staff.name}:`, response?.amountPaid);
    }
  } catch (error) {
    console.error("Error running payroll cron job:", error);
  }
});

// Schedule biweekly payroll processing for biweekly payrolls
cron.schedule("0 0 14,28 * *", async () => {
  try {
    const biweeklyStaff = await prismaDB.staff.findMany({
      where: {
        payFrequency: "BIWEEKLY",
      },
    });

    for (const staff of biweeklyStaff) {
      const response = await createPayrollForStaff(staff.id);
      console.log(`Payroll for ${staff.name}:`, response?.amountPaid);
    }
  } catch (error) {
    console.error("Error running payroll cron job:", error);
  }
});
