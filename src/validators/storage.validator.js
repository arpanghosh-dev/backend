import { z } from "zod";

// 1 PB upper bound keeps values well inside Number.MAX_SAFE_INTEGER.
const MAX_LIMIT_BYTES = 1024 ** 5;

export const updateStorageLimitSchema = {
  body: z
    .object({
      limitGB: z.number().positive("limitGB must be greater than 0").max(1024 * 1024).optional(),
      limitBytes: z.number().int().positive("limitBytes must be greater than 0").max(MAX_LIMIT_BYTES).optional(),
    })
    .refine((body) => (body.limitGB === undefined) !== (body.limitBytes === undefined), {
      message: "Provide exactly one of limitGB or limitBytes",
    }),
};
