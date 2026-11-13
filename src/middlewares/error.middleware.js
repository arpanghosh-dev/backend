import { Prisma } from "@prisma/client";
import { isProduction } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export const notFoundHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`, "ROUTE_NOT_FOUND"));
};

const normalizeError = (err) => {
  if (err instanceof AppError) return err;

  // Malformed JSON body
  if (err?.type === "entity.parse.failed") {
    return AppError.badRequest("Request body contains invalid JSON", "INVALID_JSON");
  }

  if (err?.type === "entity.too.large") {
    return AppError.payloadTooLarge("Request body is too large", "BODY_TOO_LARGE");
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2025":
        return AppError.notFound("Resource not found");
      case "P2002":
        return AppError.conflict("A record with the same unique value already exists", "DUPLICATE_RECORD");
      case "P2003":
        return AppError.conflict("Operation violates a related record constraint", "FOREIGN_KEY_CONSTRAINT");
      default:
        return new AppError("Database error", 500, "DATABASE_ERROR");
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return new AppError("Database is unavailable", 503, "DATABASE_UNAVAILABLE");
  }

  // AWS SDK errors
  if (err?.$metadata?.httpStatusCode) {
    const status = err.$metadata.httpStatusCode;
    if (status === 301 || err.name === "PermanentRedirect") {
      return new AppError(
        "S3 bucket is in a different region than AWS_REGION. Check your AWS configuration.",
        502,
        "S3_REGION_MISMATCH",
      );
    }
    if (err.name === "InvalidAccessKeyId" || err.name === "SignatureDoesNotMatch") {
      return new AppError("Invalid AWS credentials", 502, "S3_INVALID_CREDENTIALS");
    }
    if (err.name === "NoSuchBucket") {
      return new AppError("S3 bucket does not exist", 502, "S3_BUCKET_NOT_FOUND");
    }
    if (err.name === "AccessDenied" || status === 403) {
      return new AppError("Storage provider denied access", 502, "S3_ACCESS_DENIED");
    }
    return new AppError("Storage provider error", 502, "S3_ERROR");
  }

  return new AppError("Internal server error", 500, "INTERNAL_ERROR");
};

// Express identifies error handlers by their 4-argument signature.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  const error = normalizeError(err);

  if (error.statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  const body = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined && { details: error.details }),
    },
  };

  if (!isProduction && error.statusCode >= 500 && err?.stack) {
    body.error.stack = err.stack;
  }

  res.status(error.statusCode).json(body);
};
