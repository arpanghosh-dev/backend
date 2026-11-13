export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR", details = undefined) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message, code = "BAD_REQUEST", details) {
    return new AppError(message, 400, code, details);
  }

  static notFound(message = "Resource not found", code = "NOT_FOUND") {
    return new AppError(message, 404, code);
  }

  static conflict(message, code = "CONFLICT", details) {
    return new AppError(message, 409, code, details);
  }

  static payloadTooLarge(message, code = "PAYLOAD_TOO_LARGE", details) {
    return new AppError(message, 413, code, details);
  }

  static gone(message, code = "GONE") {
    return new AppError(message, 410, code);
  }
}
