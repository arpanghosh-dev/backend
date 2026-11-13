import type { CorsOptions } from "cors";
import { env } from "./env.js";

// FRONTEND_URL may hold a comma-separated list of allowed origins.
// Trailing slashes are stripped because browsers send the Origin header without one.
const allowedOrigins = env.FRONTEND_URL.split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (curl, Postman, server-to-server) and same-origin requests.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
};
