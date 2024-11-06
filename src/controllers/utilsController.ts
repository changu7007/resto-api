import { Request, Response } from "express";
import { NotificationService } from "../services/firebase";

export const sendFireBaseNotification = async (req: Request, res: Response) => {
  const { title, body, deviceToken } = req.body;
  await NotificationService.sendNotification(deviceToken, title, body);
  return res.json({
    success: true,
    message: "Notification Sent Success",
  });
};
