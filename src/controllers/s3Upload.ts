import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { BadRequestsException } from "../exceptions/bad-request";
import { ErrorCode } from "../exceptions/root";
import { Request, Response } from "express";

const generateFileName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function s3Upload(req: Request, res: Response) {
  // @ts-ignore
  const userId = req.user?.id;
  const { type, folder } = req.body;

  const acceptedFiles = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (!acceptedFiles.includes(type)) {
    throw new BadRequestsException(
      "Invalid file type",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  if (!folder) {
    throw new BadRequestsException(
      "Folder Name is required",
      ErrorCode.UNPROCESSABLE_ENTITY
    );
  }

  const putObjectCommand = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET!,
    Key: `${userId}/${folder}/${generateFileName()}`,
    ContentType: type,
  });

  const signedUrl = await getSignedUrl(s3Client, putObjectCommand, {
    expiresIn: 60,
  });

  return res.json({ url: signedUrl });
}
