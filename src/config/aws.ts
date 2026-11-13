import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  // Newer SDK versions add a CRC32 checksum of the (empty) body to presigned PUT URLs,
  // which makes S3 reject the real upload. Only send checksums when an operation requires one.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const awsConfig = {
  region: env.AWS_REGION,
  bucket: env.AWS_BUCKET_NAME,
  uploadUrlExpiresIn: env.UPLOAD_URL_EXPIRES_SECONDS,
  downloadUrlExpiresIn: env.DOWNLOAD_URL_EXPIRES_SECONDS,
} as const;
