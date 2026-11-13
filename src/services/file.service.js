import { prisma } from "../config/database.js";
import { AppError } from "../utils/app-error.js";
import { serializeFile } from "../utils/serializers.js";
import { formatBytes } from "../utils/storage-calculator.js";
import { createPresignedDownloadUrl, deleteObject } from "./s3.service.js";
import { awsConfig } from "../config/aws.js";
import { releaseUsedStorage } from "./storage.service.js";

export const listFiles = async ({ page, limit, status, search, sortBy, order }) => {
  const where = {
    ...(status !== "ALL" && { status }),
    ...(search && { originalName: { contains: search, mode: "insensitive" } }),
  };

  const [files, total] = await prisma.$transaction([
    prisma.file.findMany({
      where,
      orderBy: { [sortBy]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.file.count({ where }),
  ]);

  return {
    files: files.map(serializeFile),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

const findFileOrThrow = async (id) => {
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) throw AppError.notFound("File not found", "FILE_NOT_FOUND");
  return file;
};

export const getFileById = async (id) => serializeFile(await findFileOrThrow(id));

export const getDownloadUrl = async (id, { inline = false } = {}) => {
  const file = await findFileOrThrow(id);

  if (file.status !== "COMPLETED") {
    throw AppError.badRequest(`File is not available for download (status: ${file.status})`, "FILE_NOT_AVAILABLE");
  }

  const downloadUrl = await createPresignedDownloadUrl({
    key: file.s3Key,
    originalName: file.originalName,
    inline,
  });

  return {
    fileId: file.id,
    fileName: file.originalName,
    mimeType: file.mimeType,
    fileSize: Number(file.fileSize),
    fileSizeFormatted: formatBytes(file.fileSize),
    downloadUrl,
    expiresIn: awsConfig.downloadUrlExpiresIn,
    expiresAt: new Date(Date.now() + awsConfig.downloadUrlExpiresIn * 1000),
  };
};

/**
 * Delete from S3 first, then from PostgreSQL, and release used storage.
 * The file is marked DELETING while S3 is contacted so concurrent deletes are rejected.
 */
export const deleteFile = async (id) => {
  const file = await findFileOrThrow(id);

  if (file.status === "PENDING") {
    throw AppError.conflict("File upload is still in progress", "FILE_UPLOAD_IN_PROGRESS");
  }

  const { count } = await prisma.file.updateMany({
    where: { id, status: { in: ["COMPLETED", "FAILED"] } },
    data: { status: "DELETING" },
  });

  if (count === 0) {
    throw AppError.conflict("File is already being deleted", "FILE_DELETE_IN_PROGRESS");
  }

  try {
    await deleteObject(file.s3Key);
  } catch (error) {
    // Roll back the status so the delete can be retried.
    await prisma.file.update({ where: { id }, data: { status: file.status } });
    throw new AppError("Failed to delete file from storage. Please try again.", 502, "S3_DELETE_FAILED");
  }

  await prisma.$transaction(async (tx) => {
    await tx.uploadSession.deleteMany({ where: { fileId: id } });
    await tx.file.delete({ where: { id } });
    // FAILED files never counted toward used storage.
    if (file.status === "COMPLETED") {
      await releaseUsedStorage(tx, file.fileSize);
    }
  });

  return { id: file.id, originalName: file.originalName, freedBytes: file.status === "COMPLETED" ? Number(file.fileSize) : 0 };
};
