import { z } from "zod";

export const fileIdParamSchema = {
  params: z.object({
    id: z.uuid({ error: "id must be a valid UUID" }),
  }),
};

export const listFilesSchema = {
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["PENDING", "COMPLETED", "DELETING", "FAILED", "ALL"]).default("COMPLETED"),
    search: z.string().trim().max(255).optional(),
    sortBy: z.enum(["createdAt", "fileSize", "originalName"]).default("createdAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
  }),
};

export const downloadUrlSchema = {
  params: fileIdParamSchema.params,
  query: z.object({
    inline: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  }),
};

export type FileIdParams = z.infer<typeof fileIdParamSchema.params>;
export type ListFilesQuery = z.infer<typeof listFilesSchema.query>;
export type DownloadUrlQuery = z.infer<typeof downloadUrlSchema.query>;
