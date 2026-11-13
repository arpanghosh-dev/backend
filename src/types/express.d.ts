import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    /** Parsed, coerced and defaulted values set by the `validate` middleware. */
    validated: {
      body?: unknown;
      params?: unknown;
      query?: unknown;
    };
  }
}
