import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { awsConfig, s3Client } from "../config/aws.js";

export interface ObjectMetadata {
  contentLength: number;
  contentType: string | null;
  etag: string | null;
  lastModified: Date | null;
}

const encodeRFC5987 = (value: string): string =>
  encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Presigned PUT URL. The client must send the same Content-Type header when uploading. */
export const createPresignedUploadUrl = async ({
  key,
  mimeType,
  fileSize,
}: {
  key: string;
  mimeType: string;
  fileSize: number;
}): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: awsConfig.bucket,
    Key: key,
    ContentType: mimeType,
    ContentLength: fileSize,
  });

  return getSignedUrl(s3Client, command, { expiresIn: awsConfig.uploadUrlExpiresIn });
};

/** Presigned GET URL that forces a download with the original file name. */
export const createPresignedDownloadUrl = async ({
  key,
  originalName,
  inline = false,
}: {
  key: string;
  originalName: string;
  inline?: boolean;
}): Promise<string> => {
  const asciiName = originalName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const disposition = `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeRFC5987(originalName)}`;

  const command = new GetObjectCommand({
    Bucket: awsConfig.bucket,
    Key: key,
    ResponseContentDisposition: disposition,
  });

  return getSignedUrl(s3Client, command, { expiresIn: awsConfig.downloadUrlExpiresIn });
};

/** Returns object metadata, or null when the object does not exist. */
export const getObjectMetadata = async (key: string): Promise<ObjectMetadata | null> => {
  try {
    const result = await s3Client.send(new HeadObjectCommand({ Bucket: awsConfig.bucket, Key: key }));
    return {
      contentLength: result.ContentLength ?? 0,
      contentType: result.ContentType ?? null,
      etag: result.ETag ? result.ETag.replace(/"/g, "") : null,
      lastModified: result.LastModified ?? null,
    };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if ((error instanceof Error && error.name === "NotFound") || status === 404) {
      return null;
    }
    throw error;
  }
};

export const deleteObject = async (key: string): Promise<void> => {
  await s3Client.send(new DeleteObjectCommand({ Bucket: awsConfig.bucket, Key: key }));
};

/**
 * Startup sanity check: logs a clear message when the configured bucket is missing,
 * in another region, or the credentials are invalid. Never throws.
 */
export const verifyBucket = async (): Promise<void> => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: awsConfig.bucket }));
    console.log(`✅ S3 bucket "${awsConfig.bucket}" reachable (${awsConfig.region})`);
  } catch (error) {
    const err = error as Error & { $metadata?: { httpStatusCode?: number }; BucketRegion?: string };
    const status = err.$metadata?.httpStatusCode;
    if (status === 404) {
      console.error(
        `❌ S3 bucket "${awsConfig.bucket}" does not exist. Check AWS_BUCKET_NAME in .env against the S3 console.`,
      );
    } else if (status === 301) {
      console.error(
        `❌ S3 bucket "${awsConfig.bucket}" is not in ${awsConfig.region}` +
          (err.BucketRegion ? ` (it is in ${err.BucketRegion})` : "") +
          ". Fix AWS_REGION in .env.",
      );
    } else if (status === 403) {
      // A least-privilege policy may not allow HeadBucket; that is fine.
      console.warn(`⚠️  S3 bucket "${awsConfig.bucket}" exists, but these credentials cannot verify it (403). Uploads may still work.`);
    } else if (err.name === "InvalidAccessKeyId" || err.name === "SignatureDoesNotMatch") {
      console.error("❌ AWS credentials are invalid. Check AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in .env.");
    } else {
      console.warn(`⚠️  Could not verify S3 bucket: ${errorMessage(error)}`);
    }
  }
};

/** Best-effort delete that never throws (used for cleanup paths). */
export const safeDeleteObject = async (key: string): Promise<boolean> => {
  try {
    await deleteObject(key);
    return true;
  } catch (error) {
    console.error(`[s3] Failed to delete object "${key}":`, errorMessage(error));
    return false;
  }
};
