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
exports.sendFireBaseNotification = void 0;
const firebase_1 = require("../services/firebase");
const sendFireBaseNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title, body, deviceToken } = req.body;
    yield firebase_1.NotificationService.sendNotification(deviceToken, title, body);
    return res.json({
        success: true,
        message: "Notification Sent Success",
    });
});
exports.sendFireBaseNotification = sendFireBaseNotification;
