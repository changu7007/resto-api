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
exports.sendNewOrderNotification = exports.sendNotificationToRestaurantStaff = exports.sendExpoPushNotification = void 0;
const client_1 = require("@prisma/client");
const index_1 = require("../index");
const expo_server_sdk_1 = require("expo-server-sdk");
const expo = new expo_server_sdk_1.Expo();
/**
 * Sends a push notification to a specific Expo push token
 * @param expoPushToken The Expo push token to send the notification to
 * @param title The title of the notification
 * @param body The body of the notification
 * @param data Additional data to include in the notification
 */
function sendExpoPushNotification(expoPushToken, title, body, data = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const message = {
                to: expoPushToken,
                sound: "default",
                title,
                body,
                data,
            };
            const response = yield fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Accept-encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(message),
            });
            const result = yield response.json();
            console.log("Push notification sent:", result);
            return result;
        }
        catch (error) {
            console.error("Error sending push notification:", error);
            throw error;
        }
    });
}
exports.sendExpoPushNotification = sendExpoPushNotification;
/**
 * Sends a notification to all waiters and captains of a restaurant
 * @param restaurantId The ID of the restaurant
 * @param title The title of the notification
 * @param body The body of the notification
 * @param data Additional data to include in the notification
 */
function sendNotificationToRestaurantStaff(restaurantId, title, body, data = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get all waiters and captains for the restaurant
            const staffMembers = yield index_1.prismaDB.staff.findMany({
                where: {
                    restaurantId,
                    role: {
                        in: [client_1.UserRole.WAITER, client_1.UserRole.CAPTAIN],
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
            const staffWithTokens = staffMembers.filter((staff) => staff.pushToken && staff.pushToken.length > 0);
            if (staffWithTokens.length === 0) {
                console.log("No staff members with push tokens found");
                return;
            }
            // Send notifications to all staff members
            const notificationPromises = staffWithTokens.map((staff) => sendExpoPushNotification(staff.pushToken, title, body, Object.assign(Object.assign({}, data), { staffId: staff.id, staffName: staff.name, staffRole: staff.role })));
            yield Promise.all(notificationPromises);
            console.log(`Sent notifications to ${staffWithTokens.length} staff members`);
        }
        catch (error) {
            console.error("Error sending notifications to restaurant staff:", error);
            throw error;
        }
    });
}
exports.sendNotificationToRestaurantStaff = sendNotificationToRestaurantStaff;
const sendNewOrderNotification = ({ restaurantId, orderId, orderNumber, customerName, tableId, }) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Check if the table is assigned to any staff member
        let assignedStaffName;
        let tableName;
        if (tableId) {
            // Find the table and check if it has an assigned staff
            const table = yield index_1.prismaDB.table.findUnique({
                where: { id: tableId },
                include: { staff: true },
            });
            if (table === null || table === void 0 ? void 0 : table.staff) {
                assignedStaffName = table.staff.name;
                tableName = table === null || table === void 0 ? void 0 : table.name;
            }
            else {
                // Check if any staff has this table in their assignedTables
                const staffWithTable = yield index_1.prismaDB.staff.findFirst({
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
                    tableName = table === null || table === void 0 ? void 0 : table.name;
                }
                else {
                    assignedStaffName = "Needs to be assigned";
                }
            }
        }
        // Get all staff members of the restaurant who have push tokens
        const staffMembers = yield index_1.prismaDB.staff.findMany({
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
        const staffWithTokens = staffMembers.filter((staff) => staff.pushToken && staff.pushToken.length > 0);
        if (staffWithTokens.length === 0) {
            console.log("No staff members with push tokens found");
            return;
        }
        // Create notification message
        const message = {
            to: staffWithTokens.map((staff) => staff.pushToken),
            sound: "default",
            title: `${tableName} - New Order`,
            body: `New KOT Order #${orderNumber} from ${customerName}. Table Assigned to - ${assignedStaffName ? ` ${assignedStaffName}` : ""}`,
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
                const ticketChunk = yield expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            }
            catch (error) {
                console.error("Error sending push notification:", error);
            }
        }
        return tickets;
    }
    catch (error) {
        console.error("Error in sendNewOrderNotification:", error);
        throw error;
    }
});
exports.sendNewOrderNotification = sendNewOrderNotification;
