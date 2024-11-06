import admin from "firebase-admin";
import { Message } from "firebase-admin/messaging";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require("../../firebaseAdminSDK.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

class NotificationService {
  static async sendNotification(
    deviceToken: string,
    title: string,
    body: string,
    link?: string
  ) {
    const message: Message = {
      token: deviceToken,
      notification: {
        title,
        body,
      },
      webpush: {
        fcmOptions: {
          link,
        },
      },
    };
    try {
      const response = await admin.messaging().send(message);
      return response;
    } catch (err) {
      throw err;
    }
  }
}

export { admin, NotificationService };
