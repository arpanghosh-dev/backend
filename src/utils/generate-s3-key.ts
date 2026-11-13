import path from "node:path";
import { v4 as uuidv4 } from "uuid";

const MAX_BASENAME_LENGTH = 100;

/**
 * Make a file name safe for use in an S3 key and a Content-Disposition header.
 * Keeps letters, numbers, dot, dash and underscore; everything else becomes "-".
 */
export const sanitizeFileName = (fileName: string): string => {
  const ext = path.extname(fileName).toLowerCase();
  const base = path.basename(fileName, path.extname(fileName));

  const safeBase =
    base
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, MAX_BASENAME_LENGTH) || "file";

  const safeExt = ext.replace(/[^a-z0-9.]/g, "").slice(0, 20);

  return `${safeBase}${safeExt}`;
};

export const getExtension = (fileName: string): string | null => {
  const ext = path.extname(fileName).replace(".", "").toLowerCase();
  return ext ? ext.slice(0, 20) : null;
};

/**
 * Build a unique, date-partitioned S3 key:
 *   uploads/2026/11/13/<uuid>-<sanitized-name>
 */
export const generateS3Key = (originalName: string, prefix = "uploads"): { key: string; fileName: string } => {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  const fileName = sanitizeFileName(originalName);
  const key = `${prefix}/${yyyy}/${mm}/${dd}/${uuidv4()}-${fileName}`;

  return { key, fileName };
};
