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
exports.s3Upload = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const crypto_1 = __importDefault(require("crypto"));
const bad_request_1 = require("../exceptions/bad-request");
const root_1 = require("../exceptions/root");
const generateFileName = (bytes = 32) => crypto_1.default.randomBytes(bytes).toString("hex");
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
function s3Upload(req, res) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        // @ts-ignore
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        const { type, folder } = req.body;
        const acceptedFiles = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!acceptedFiles.includes(type)) {
            throw new bad_request_1.BadRequestsException("Invalid file type", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        if (!folder) {
            throw new bad_request_1.BadRequestsException("Folder Name is required", root_1.ErrorCode.UNPROCESSABLE_ENTITY);
        }
        const putObjectCommand = new client_s3_1.PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: `${userId}/${folder}/${generateFileName()}`,
            ContentType: type,
        });
        const signedUrl = yield (0, s3_request_presigner_1.getSignedUrl)(s3Client, putObjectCommand, {
            expiresIn: 60,
        });
        return res.json({ url: signedUrl });
    });
}
exports.s3Upload = s3Upload;
