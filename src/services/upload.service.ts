import type { UploadSession, UploadStatus } from "@prisma/client";
import { awsConfig } from "../config/aws.js";
import { prisma } from "../config/database.js";
import { AppError } from "../utils/app-error.js";
import { generateS3Key, getExtension } from "../utils/generate-s3-key.js";
import { serializeFile, type FileDto } from "../utils/serializers.js";
import type { CompleteUploadBody, PresignedUrlBody } from "../validators/upload.validator.js";
import { createPresignedUploadUrl, getObjectMetadata, safeDeleteObject } from "./s3.service.js";
import {
  commitReservedStorage,
  getOrCreateStorageConfig,
  releaseReservedStorage,
  reserveStorage,
} from "./storage.service.js";

// Extra time after the presigned URL expires during which /complete is still accepted
// (an upload that started just before the URL expired may still be in flight).
const COMPLETION_GRACE_SECONDS = 600;

export interface UploadSessionDto {
  uploadSessionId: string;
  fileId: string;
  uploadUrl: string;
  method: "PUT";
  headers: { "Content-Type": string };
  s3Key: string;
  expiresIn: number;
  expiresAt: Date;
  completeBefore: Date;
}

/**
 * Step 1: reserve space, create PENDING records and return a presigned PUT URL.
 */
export const createUploadSession = async ({
  fileName,
  mimeType,
  fileSize,
}: PresignedUrlBody): Promise<UploadSessionDto> => {
  await getOrCreateStorageConfig();

  const { key, fileName: safeFileName } = generateS3Key(fileName);
  const now = Date.now();
  const urlExpiresAt = new Date(now + awsConfig.uploadUrlExpiresIn * 1000);
  const sessionExpiresAt = new Date(now + (awsConfig.uploadUrlExpiresIn + COMPLETION_GRACE_SECONDS) * 1000);

  const { file, session } = await prisma.$transaction(async (tx) => {
    await reserveStorage(tx, fileSize);

    const file = await tx.file.create({
      data: {
        fileName: safeFileName,
        originalName: fileName,
        mimeType,
        fileSize: BigInt(fileSize),
        extension: getExtension(fileName),
        s3Bucket: awsConfig.bucket,
        s3Key: key,
        status: "PENDING",
      },
    });

    const session = await tx.uploadSession.create({
      data: {
        fileId: file.id,
        expectedSize: BigInt(fileSize),
        s3Key: key,
        status: "PENDING",
        expiresAt: sessionExpiresAt,
      },
    });

    return { file, session };
  });

  let uploadUrl: string;
  try {
    uploadUrl = await createPresignedUploadUrl({ key, mimeType, fileSize });
  } catch (error) {
    await failUploadSession(session.id, "FAILED");
    throw error;
  }

  return {
    uploadSessionId: session.id,
    fileId: file.id,
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": mimeType },
    s3Key: key,
    expiresIn: awsConfig.uploadUrlExpiresIn,
    expiresAt: urlExpiresAt,
    completeBefore: sessionExpiresAt,
  };
};

/**
 * Mark a PENDING session as FAILED/EXPIRED, release its reservation and remove any
 * partially uploaded object. Safe to call concurrently: only one caller wins.
 */
export const failUploadSession = async (
  sessionId: string,
  status: Extract<UploadStatus, "FAILED" | "EXPIRED"> = "FAILED",
): Promise<UploadSession | null> => {
  const session = await prisma.$transaction(async (tx) => {
    const { count } = await tx.uploadSession.updateMany({
      where: { id: sessionId, status: "PENDING" },
      data: { status },
    });
    if (count === 0) return null;

    const session = await tx.uploadSession.findUniqueOrThrow({ where: { id: sessionId } });
    await tx.file.update({ where: { id: session.fileId }, data: { status: "FAILED" } });
    await releaseReservedStorage(tx, session.expectedSize);
    return session;
  });

  if (session) {
    await safeDeleteObject(session.s3Key);
  }
  return session;
};

/**
 * Step 2: verify the object exists in S3 with the expected size, then mark the
 * file COMPLETED and move the reserved bytes to used storage.
 */
export const completeUpload = async ({ uploadSessionId }: CompleteUploadBody): Promise<FileDto> => {
  const session = await prisma.uploadSession.findUnique({
    where: { id: uploadSessionId },
    include: { file: true },
  });

  if (!session) {
    throw AppError.notFound("Upload session not found", "UPLOAD_SESSION_NOT_FOUND");
  }

  switch (session.status) {
    case "COMPLETED":
      throw AppError.conflict("This upload has already been completed", "UPLOAD_ALREADY_COMPLETED", {
        fileId: session.fileId,
      });
    case "EXPIRED":
      throw AppError.gone("This upload session has expired. Request a new upload URL.", "UPLOAD_SESSION_EXPIRED");
    case "FAILED":
      throw AppError.badRequest("This upload session has failed. Request a new upload URL.", "UPLOAD_SESSION_FAILED");
    case "PENDING":
      break;
  }

  if (session.expiresAt.getTime() < Date.now()) {
    await failUploadSession(session.id, "EXPIRED");
    throw AppError.gone("This upload session has expired. Request a new upload URL.", "UPLOAD_SESSION_EXPIRED");
  }

  const metadata = await getObjectMetadata(session.s3Key);

  if (!metadata) {
    // Leave the session PENDING so the client can finish the upload and retry.
    throw AppError.badRequest(
      "File was not found in storage. Upload it to the presigned URL before completing.",
      "UPLOAD_NOT_FOUND",
    );
  }

  if (BigInt(metadata.contentLength) !== session.expectedSize) {
    await failUploadSession(session.id, "FAILED");
    throw AppError.badRequest("Uploaded file size does not match the declared size.", "UPLOAD_SIZE_MISMATCH", {
      expectedSize: Number(session.expectedSize),
      actualSize: metadata.contentLength,
    });
  }

  const file = await prisma.$transaction(async (tx) => {
    const { count } = await tx.uploadSession.updateMany({
      where: { id: session.id, status: "PENDING" },
      data: { status: "COMPLETED" },
    });

    if (count === 0) {
      throw AppError.conflict("This upload is no longer pending", "UPLOAD_NOT_PENDING");
    }

    const file = await tx.file.update({
      where: { id: session.fileId },
      data: { status: "COMPLETED", etag: metadata.etag },
    });

    await commitReservedStorage(tx, session.expectedSize);
    return file;
  });

  return serializeFile(file);
};

/** Expire stale PENDING sessions and free their reserved space. */
export const cleanupExpiredUploadSessions = async (batchSize = 100): Promise<number> => {
  const expired = await prisma.uploadSession.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    select: { id: true },
    take: batchSize,
  });

  let cleaned = 0;
  for (const { id } of expired) {
    try {
      if (await failUploadSession(id, "EXPIRED")) cleaned += 1;
    } catch (error) {
      console.error(`[cleanup] Failed to expire upload session ${id}:`, error instanceof Error ? error.message : error);
    }
  }
  return cleaned;
};
