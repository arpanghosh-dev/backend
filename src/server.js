import { env } from "./config/env.js";
import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { cleanupExpiredUploadSessions } from "./services/upload.service.js";
import { getOrCreateStorageConfig } from "./services/storage.service.js";

let server;
let cleanupTimer;

const runCleanup = async () => {
  try {
    const cleaned = await cleanupExpiredUploadSessions();
    if (cleaned > 0) console.log(`[cleanup] Expired ${cleaned} stale upload session(s)`);
  } catch (error) {
    console.error("[cleanup] Failed:", error.message);
  }
};

const start = async () => {
  try {
    await connectDatabase();
    console.log("✅ Database connected");

    await getOrCreateStorageConfig();

    server = app.listen(env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
      console.log(`📚 API docs at http://localhost:${env.PORT}/api/docs`);
    });

    await runCleanup();
    cleanupTimer = setInterval(runCleanup, env.CLEANUP_INTERVAL_MINUTES * 60 * 1000);
    cleanupTimer.unref();
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  clearInterval(cleanupTimer);

  const forceExit = setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDatabase();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  shutdown("uncaughtException");
});

start();
