import type { File, Prisma } from "@prisma/client";
import { awsConfig } from "../config/aws.js";
import { prisma } from "../config/database.js";
import { AppError } from "../utils/app-error.js";
import { serializeFile, type FileDto } from "../utils/serializers.js";
import { formatBytes } from "../utils/storage-calculator.js";
import type { ListFilesQuery } from "../validators/file.validator.js";
import { createPresignedDownloadUrl, deleteObject } from "./s3.service.js";
import { releaseUsedStorage } from "./storage.service.js";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface DownloadUrlDto {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileSizeFormatted: string;
  downloadUrl: string;
  expiresIn: number;
  expiresAt: Date;
}

export interface DeletedFileDto {
  id: string;
  originalName: string;
  freedBytes: number;
}

export const listFiles = async ({
  page,
  limit,
  status,
  search,
  sortBy,
  order,
}: ListFilesQuery): Promise<{ files: FileDto[]; pagination: Pagination }> => {
  const where: Prisma.FileWhereInput = {
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

const findFileOrThrow = async (id: string): Promise<File> => {
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) throw AppError.notFound("File not found", "FILE_NOT_FOUND");
  return file;
};

export const getFileById = async (id: string): Promise<FileDto> => serializeFile(await findFileOrThrow(id));

export const getDownloadUrl = async (id: string, { inline = false } = {}): Promise<DownloadUrlDto> => {
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
export const deleteFile = async (id: string): Promise<DeletedFileDto> => {
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
  } catch {
    // Roll back the status so the delete can be retried.
    await prisma.file.update({ where: { id }, data: { status: file.status } });
    throw new AppError("Failed to delete file from storage. Please try again.", 502, "S3_DELETE_FAILED");
  }

  const wasCompleted = file.status === "COMPLETED";

  await prisma.$transaction(async (tx) => {
    await tx.uploadSession.deleteMany({ where: { fileId: id } });
    await tx.file.delete({ where: { id } });
    // FAILED files never counted toward used storage.
    if (wasCompleted) {
      await releaseUsedStorage(tx, file.fileSize);
    }
  });

  return { id: file.id, originalName: file.originalName, freedBytes: wasCompleted ? Number(file.fileSize) : 0 };
};
