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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = exports.admin = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
exports.admin = firebase_admin_1.default;
// Initialize Firebase Admin SDK
if (!firebase_admin_1.default.apps.length) {
    const serviceAccount = require("../../firebaseAdminSDK.json");
    firebase_admin_1.default.initializeApp({
        credential: firebase_admin_1.default.credential.cert(serviceAccount),
    });
}
class NotificationService {
    static sendNotification(deviceToken, title, body, link) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = {
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
                const response = yield firebase_admin_1.default.messaging().send(message);
                return response;
            }
            catch (err) {
                throw err;
            }
        });
    }
}
exports.NotificationService = NotificationService;
