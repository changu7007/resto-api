import { Staff, UserRole } from "@prisma/client";
import { prismaDB } from "../index";
import { Expo } from "expo-server-sdk";

const expo = new Expo();

/**
 * Sends a push notification to a specific Expo push token
 * @param expoPushToken The Expo push token to send the notification to
 * @param title The title of the notification
 * @param body The body of the notification
 * @param data Additional data to include in the notification
 */
export async function sendExpoPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
) {
  try {
    const message = {
      to: expoPushToken,
      sound: "default",
      title,
      body,
      data,
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log("Push notification sent:", result);
    return result;
  } catch (error) {
    console.error("Error sending push notification:", error);
    throw error;
  }
}

/**
 * Sends a notification to all waiters and captains of a restaurant
 * @param restaurantId The ID of the restaurant
 * @param title The title of the notification
 * @param body The body of the notification
 * @param data Additional data to include in the notification
 */
export async function sendNotificationToRestaurantStaff(
  restaurantId: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
) {
  try {
    // Get all waiters and captains for the restaurant
    const staffMembers = await prismaDB.staff.findMany({
      where: {
        restaurantId,
        role: {
          in: [UserRole.WAITER, UserRole.CAPTAIN],
        },
        active: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        role: true,
        pushToken: true,
      },
    });

    // Filter out staff members without a push token
    const staffWithTokens = staffMembers.filter(
      (staff) => staff.pushToken && staff.pushToken.length > 0
    );

    if (staffWithTokens.length === 0) {
      console.log("No staff members with push tokens found");
      return;
    }

    // Send notifications to all staff members
    const notificationPromises = staffWithTokens.map((staff) =>
      sendExpoPushNotification(staff.pushToken as string, title, body, {
        ...data,
        staffId: staff.id,
        staffName: staff.name,
        staffRole: staff.role,
      })
    );

    await Promise.all(notificationPromises);
    console.log(
      `Sent notifications to ${staffWithTokens.length} staff members`
    );
  } catch (error) {
    console.error("Error sending notifications to restaurant staff:", error);
    throw error;
  }
}

interface NewOrderNotification {
  restaurantId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  tableId: string;
}

export const sendNewOrderNotification = async ({
  restaurantId,
  orderId,
  orderNumber,
  customerName,
  tableId,
}: NewOrderNotification) => {
  try {
    // Check if the table is assigned to any staff member
    let assignedStaffName;
    let tableName;

    if (tableId) {
      // Find the table and check if it has an assigned staff
      const table = await prismaDB.table.findUnique({
        where: { id: tableId },
        include: { staff: true },
      });

      if (table?.staff) {
        assignedStaffName = table.staff.name;
        tableName = table?.name;
      } else {
        // Check if any staff has this table in their assignedTables
        const staffWithTable = await prismaDB.staff.findFirst({
          where: {
            restaurantId,
            assignedTables: {
              has: tableId,
            },
          },
          select: {
            name: true,
          },
        });

        if (staffWithTable) {
          assignedStaffName = staffWithTable.name;
          tableName = table?.name;
        } else {
          assignedStaffName = "Needs to be assigned";
        }
      }
    }

    // Get all staff members of the restaurant who have push tokens
    const staffMembers = await prismaDB.staff.findMany({
      where: {
        restaurantId,
        pushToken: {
          not: null,
        },
      },
      select: {
        pushToken: true,
        name: true,
      },
    });

    // Filter out staff members with null or empty push tokens
    const staffWithTokens = staffMembers.filter(
      (staff) => staff.pushToken && staff.pushToken.length > 0
    );

    if (staffWithTokens.length === 0) {
      console.log("No staff members with push tokens found");
      return;
    }

    // Create notification message
    const message = {
      to: staffWithTokens.map((staff) => staff.pushToken as string),
      sound: "default",
      title: `${tableName} - New Order`,
      body: `New KOT Order #${orderNumber} from ${customerName}. Table Assigned to - ${
        assignedStaffName ? ` ${assignedStaffName}` : ""
      }`,
      data: {
        type: "NEW_ORDER",
        orderId,
        orderNumber,
        customerName,
        assignedStaff: assignedStaffName,
      },
    };

    // Send notifications
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error("Error sending push notification:", error);
      }
    }

    return tickets;
  } catch (error) {
    console.error("Error in sendNewOrderNotification:", error);
    throw error;
  }
};
