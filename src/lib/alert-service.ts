import { AlertPriority, AlertType } from "@prisma/client";
import { prismaDB } from "..";
import { Cron } from "croner";
import { redis } from "../services/redis";
import { websocketManager } from "../services/ws";

export class AlertService {
  // Check for low stock items
  async checkLowStock(restaurantId: string) {
    const lowStockItems = await prismaDB.rawMaterial.findMany({
      where: {
        restaurantId,
        currentStock: {
          lte: prismaDB.rawMaterial.fields.minimumStockLevel,
        },
      },
      include: {
        consumptionUnit: true,
      },
    });

    for (const item of lowStockItems) {
      await this.createAlert({
        restaurantId,
        type: "LOW_STOCK",
        priority: "HIGH",
        message: `Low stock alert : ${item.name}. (${item.currentStock?.toFixed(
          2
        )} ${item.purchasedUnit}) remaining`,
        metadata: { itemId: item.id, name: item.name },
      });
    }
  }

  // Check for delayed orders
  async checkDelayedOrders(restaurantId: string) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const delayedOrders = await prismaDB.order.findMany({
      where: {
        restaurantId,
        orderStatus: {
          in: ["INCOMMING", "PREPARING"],
        },
        createdAt: {
          lte: fiveMinutesAgo,
        },
      },
    });

    for (const order of delayedOrders) {
      await this.createAlert({
        restaurantId,
        type: "ORDER_DELAY",
        priority: "CRITICAL",
        message: `KOT #${order.generatedOrderId} is delayed by more than 5 minutes`,
        metadata: { orderId: order.id },
      });
    }
  }

  // Check for not served Orders
  async checkNotServedOrders(restaurantId: string) {
    const oneMinutesAgo = new Date(Date.now() - 1 * 60 * 1000);

    const delayedNotServedOrders = await prismaDB.order.findMany({
      where: {
        restaurantId,
        orderStatus: {
          in: ["FOODREADY"],
        },
        createdAt: {
          lte: oneMinutesAgo,
        },
      },
      include: {
        orderSession: {
          include: {
            table: true,
          },
        },
      },
    });

    for (const order of delayedNotServedOrders) {
      await this.createAlert({
        restaurantId,
        type: "ORDER_NOTSERVED",
        priority: "HIGH",
        message: `Order #${order.generatedOrderId} is not yet served to the ${
          order?.orderType === "DINEIN"
            ? order.orderSession?.table?.name
            : order.orderSession?.username
        }`,
        metadata: {
          orderId: order?.id,
          generatedOrderId: order?.generatedOrderId,
        },
      });
    }
  }

  // Check for pending payrolls
  async checkPendingPayrolls(restaurantId: string) {
    const pendingPayrolls = await prismaDB.payroll.findMany({
      where: {
        staff: {
          restaurantId,
        },
        status: "PENDING",
      },
      include: {
        staff: true,
      },
    });

    for (const payroll of pendingPayrolls) {
      await this.createAlert({
        restaurantId,
        type: "PAYROLL_PENDING",
        priority: "MEDIUM",
        message: `Pending payroll for ${payroll.staff.name}`,
        metadata: {
          payrollId: payroll.id,
          staffId: payroll.staff.id,
          name: payroll?.staff?.name,
        },
      });
    }
  }

  // Check for purchase settlements
  async checkPurchaseSettlements(restaurantId: string) {
    const pendingSettlements = await prismaDB.purchase.findMany({
      where: {
        restaurantId,
        purchaseStatus: "SETTLEMENT",
      },
      include: {
        vendor: true,
      },
    });

    for (const purchase of pendingSettlements) {
      await this.createAlert({
        restaurantId,
        type: "PURCHASE_SETTLEMENT",
        priority: "HIGH",
        message: `Purchase settlement pending for vendor ${purchase.vendor.name}`,
        metadata: { purchaseId: purchase.id, vendorId: purchase.vendor.id },
      });
    }
  }

  // Check for purchase settlements
  async checkPurchaseProcessed(restaurantId: string) {
    const pendingSettlements = await prismaDB.purchase.findMany({
      where: {
        restaurantId,
        purchaseStatus: { in: ["PROCESSED", "REQUESTED"] },
      },
      include: {
        vendor: true,
      },
    });

    for (const purchase of pendingSettlements) {
      await this.createAlert({
        restaurantId,
        type: "PURCHASE_ACTION_REQUIRED",
        priority: "MEDIUM",
        message: `Purchase Processed/Requested action required for vendor ${purchase.vendor.name}`,
        metadata: { purchaseId: purchase.id, vendorId: purchase.vendor.id },
      });
    }
  }

  // Create alert
  private async createAlert({
    restaurantId,
    type,
    priority,
    message,
    metadata,
  }: {
    restaurantId: string;
    type: AlertType;
    priority: AlertPriority;
    message: string;
    metadata?: any;
  }) {
    const { orderId, itemId, payrollId, purchaseId, generatedOrderId, name } =
      metadata || {};

    // Generate href link based on metadata
    const href = this.generateHref({
      restaurantId,
      priority,
      orderId,
      generatedOrderId,
      itemId,
      payrollId,
      name,
      purchaseId,
    });
    // Check if similar alert exists and is still pending
    const existingAlert = await prismaDB.alert.findFirst({
      where: {
        restaurantId,
        type,
        status: { in: ["PENDING", "ACKNOWLEDGED"] },
        ...(orderId && { orderId }), // Query specific fields
        ...(itemId && { itemId }),
        ...(payrollId && { payrollId }), // Query specific fields
        ...(purchaseId && { purchaseId }),
      },
    });

    if (!existingAlert) {
      await prismaDB.alert.create({
        data: {
          restaurantId,
          type,
          priority,
          message,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
          orderId,
          itemId,
          href: href,
          payrollId,
          purchaseId,
          status: "PENDING",
        },
      });

      websocketManager.notifyClients(restaurantId, "NEW_ALERT");

      const alerts = await prismaDB.alert.findMany({
        where: {
          restaurantId: restaurantId,
          status: {
            in: ["PENDING"],
          },
        },
        select: {
          id: true,
          type: true,
          status: true,
          priority: true,
          href: true,
          message: true,
          createdAt: true,
        },
      });

      await redis.set(`alerts-${restaurantId}`, JSON.stringify(alerts));
    }
  }

  // Utility to generate href based on metadata
  private generateHref({
    restaurantId,
    priority,
    orderId,
    generatedOrderId,
    itemId,
    payrollId,
    name,
    purchaseId,
  }: {
    restaurantId: string;
    priority: AlertPriority;
    orderId?: string;
    generatedOrderId?: string;
    itemId?: string;
    payrollId?: string;
    name?: string;
    purchaseId?: string;
  }): string {
    if (itemId) {
      return `/${restaurantId}/inventory/stocks?search=${name}`;
    }
    if (orderId) {
      if (priority === "HIGH") {
        return `/${restaurantId}/orders?search=${generatedOrderId}`;
      } else {
        return `/${restaurantId}/kitchen-view`;
      }
    }
    if (payrollId) {
      return `/${restaurantId}/payroll?search=${name}`; // Modify if "respective staff name" logic is needed
    }
    if (purchaseId) {
      if (priority === "HIGH") {
        return `/${restaurantId}/inventory/purchases`;
      } else {
        return `/${restaurantId}/inventory/purchases?tabs=request-purchases`;
      }
    }
    return "/";
  }
}

// Initialize cron jobs
export function initializeAlertCrons() {
  // Get all restaurants
  async function processAllRestaurants(
    callback: (restaurantId: string) => Promise<void>
  ) {
    const restaurants = await prismaDB.restaurant.findMany({
      select: { id: true },
    });

    for (const restaurant of restaurants) {
      await callback(restaurant.id);
    }
  }

  const alertService = new AlertService();

  // Check low stock every hour
  new // Check low stock every hour
  Cron("* * * * *", async () => {
    console.log("Checked Low Stock every hour");
    await processAllRestaurants((id) => alertService.checkLowStock(id));
  });

  // Check delayed orders every minute
  new // Check delayed orders every minute
  Cron("* * * * *", async () => {
    console.log("Checked Delayed Orders Every Min");
    await processAllRestaurants((id) => alertService.checkDelayedOrders(id));
  });

  // Check delayed orders every minute
  new // Check delayed orders every minute
  Cron("* * * * *", async () => {
    console.log("Checked NOt Served Orders Every Min");
    await processAllRestaurants((id) => alertService.checkNotServedOrders(id));
  });

  // Check pending payrolls daily
  new // Check pending payrolls daily
  Cron("0 0 * * *", async () => {
    console.log("Checked Pending Payrolls Daily");
    await processAllRestaurants((id) => alertService.checkPendingPayrolls(id));
  });

  // Check purchase settlements every 4 hours
  new // Check purchase settlements every 4 hours
  Cron("0 */4 * * *", async () => {
    console.log("Checked Purchase Settlement every hour");

    await processAllRestaurants((id) =>
      alertService.checkPurchaseSettlements(id)
    );
  });

  new // Check purchase settlements every 4 hours
  Cron("0 */4 * * *", async () => {
    console.log("Checked Purchase Processed/Requested every hour");

    await processAllRestaurants((id) =>
      alertService.checkPurchaseProcessed(id)
    );
  });
}
