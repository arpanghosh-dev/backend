import { formatBytes, toNumber } from "./storage-calculator.js";

/** Convert a File row into a JSON-safe response object (BigInt -> number). */
export const serializeFile = (file) => ({
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
