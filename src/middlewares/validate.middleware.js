import { AppError } from "../utils/app-error.js";

/**
 * Validate req.body / req.params / req.query against Zod schemas.
 * Parsed (coerced, defaulted) values are stored on req.validated, because
 * Express 5 makes req.query read-only.
 *
 * Usage: validate({ body: schema, params: schema, query: schema })
 */
export const validate = (schemas) => (req, _res, next) => {
  const validated = {};
  const errors = [];

  for (const source of ["params", "query", "body"]) {
    const schema = schemas[source];
    if (!schema) continue;

    const result = schema.safeParse(req[source] ?? {});
    if (result.success) {
      validated[source] = result.data;
    } else {
      for (const issue of result.error.issues) {
        errors.push({
          location: source,
          field: issue.path.join(".") || null,
          message: issue.message,
        });
      }
    }
  }

  if (errors.length > 0) {
    return next(AppError.badRequest("Validation failed", "VALIDATION_ERROR", errors));
  }

  req.validated = validated;
  return next();
};
