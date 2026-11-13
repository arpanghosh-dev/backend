import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { awsConfig, s3Client } from "../config/aws.js";

const encodeRFC5987 = (value) =>
  encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Presigned PUT URL. The client must send the same Content-Type header when uploading. */
export const createPresignedUploadUrl = async ({ key, mimeType, fileSize }) => {
  const command = new PutObjectCommand({
    Bucket: awsConfig.bucket,
    Key: key,
    ContentType: mimeType,
    ContentLength: fileSize,
  });

  return getSignedUrl(s3Client, command, { expiresIn: awsConfig.uploadUrlExpiresIn });
};

/** Presigned GET URL that forces a download with the original file name. */
export const createPresignedDownloadUrl = async ({ key, originalName, inline = false }) => {
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
export const getObjectMetadata = async (key) => {
  try {
    const result = await s3Client.send(new HeadObjectCommand({ Bucket: awsConfig.bucket, Key: key }));
    return {
      contentLength: result.ContentLength ?? 0,
      contentType: result.ContentType ?? null,
      etag: result.ETag ? result.ETag.replace(/"/g, "") : null,
      lastModified: result.LastModified ?? null,
    };
  } catch (error) {
    if (error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
};

export const deleteObject = async (key) => {
  await s3Client.send(new DeleteObjectCommand({ Bucket: awsConfig.bucket, Key: key }));
};

/** Best-effort delete that never throws (used for cleanup paths). */
export const safeDeleteObject = async (key) => {
  try {
    await deleteObject(key);
    return true;
  } catch (error) {
    console.error(`[s3] Failed to delete object "${key}":`, error.message);
    return false;
  }
};
