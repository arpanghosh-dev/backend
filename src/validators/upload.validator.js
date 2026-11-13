import { z } from "zod";
import { env } from "../config/env.js";
import { BYTES_PER_MB } from "../utils/storage-calculator.js";

const MAX_FILE_SIZE_BYTES = Math.floor(env.MAX_FILE_SIZE_MB * BYTES_PER_MB);

// e.g. "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const MIME_TYPE_REGEX = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;

export const presignedUrlSchema = {
  body: z.object({
    fileName: z
      .string({ error: "fileName is required" })
      .trim()
      .min(1, "fileName cannot be empty")
      .max(255, "fileName must be at most 255 characters")
      .refine((name) => !/[\\/\0]/.test(name), "fileName must not contain path separators"),
    mimeType: z
      .string({ error: "mimeType is required" })
      .trim()
      .toLowerCase()
      .max(150)
      .regex(MIME_TYPE_REGEX, "mimeType must be a valid MIME type, e.g. image/png"),
    fileSize: z
      .number({ error: "fileSize must be a number (bytes)" })
      .int("fileSize must be an integer number of bytes")
      .positive("fileSize must be greater than 0")
      .max(MAX_FILE_SIZE_BYTES, `fileSize must not exceed ${env.MAX_FILE_SIZE_MB} MB`),
  }),
};

export const completeUploadSchema = {
  body: z.object({
    uploadSessionId: z.uuid({ error: "uploadSessionId must be a valid UUID" }),
  }),
};
