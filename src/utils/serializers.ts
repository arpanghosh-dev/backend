import type { File, FileStatus } from "@prisma/client";
import { formatBytes, toNumber } from "./storage-calculator.js";

export interface FileDto {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  extension: string | null;
  fileSize: number;
  fileSizeFormatted: string;
  s3Key: string;
  status: FileStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Convert a File row into a JSON-safe response object (BigInt -> number). */
export const serializeFile = (file: File): FileDto => ({
  id: file.id,
  fileName: file.fileName,
  originalName: file.originalName,
  mimeType: file.mimeType,
  extension: file.extension,
  fileSize: toNumber(file.fileSize),
  fileSizeFormatted: formatBytes(file.fileSize),
  s3Key: file.s3Key,
  status: file.status,
  createdAt: file.createdAt,
  updatedAt: file.updatedAt,
});
