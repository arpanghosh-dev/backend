import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../utils/app-error.js";

type Source = "params" | "query" | "body";

export type ValidationSchemas = Partial<Record<Source, ZodType>>;

export interface ValidationIssue {
  location: Source;
  field: string | null;
  message: string;
}

const SOURCES: readonly Source[] = ["params", "query", "body"];

/**
 * Validate req.body / req.params / req.query against Zod schemas.
 * Parsed (coerced, defaulted) values are stored on req.validated, because
 * Express 5 makes req.query read-only.
 *
 * Usage: validate({ body: schema, params: schema, query: schema })
 */
export const validate =
  (schemas: ValidationSchemas): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const validated: Request["validated"] = {};
    const errors: ValidationIssue[] = [];

    for (const source of SOURCES) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source] ?? {});
      if (result.success) {
        validated[source] = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({
            location: source,
            field: issue.path.map(String).join(".") || null,
            message: issue.message,
          });
        }
      }
    }

    if (errors.length > 0) {
      next(AppError.badRequest("Validation failed", "VALIDATION_ERROR", errors));
      return;
    }

    req.validated = validated;
    next();
  };
