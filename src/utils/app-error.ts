export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message: string, code = "BAD_REQUEST", details?: unknown): AppError {
    return new AppError(message, 400, code, details);
  }

  static notFound(message = "Resource not found", code = "NOT_FOUND"): AppError {
    return new AppError(message, 404, code);
  }

  static conflict(message: string, code = "CONFLICT", details?: unknown): AppError {
    return new AppError(message, 409, code, details);
  }

  static payloadTooLarge(message: string, code = "PAYLOAD_TOO_LARGE", details?: unknown): AppError {
    return new AppError(message, 413, code, details);
  }

  static gone(message: string, code = "GONE"): AppError {
    return new AppError(message, 410, code);
  }
}
