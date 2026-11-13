import type { Server } from "node:http";
import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { getOrCreateStorageConfig } from "./services/storage.service.js";
import { cleanupExpiredUploadSessions } from "./services/upload.service.js";

let server: Server | undefined;
let cleanupTimer: NodeJS.Timeout | undefined;
let shuttingDown = false;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const runCleanup = async (): Promise<void> => {
  try {
    const cleaned = await cleanupExpiredUploadSessions();
    if (cleaned > 0) console.log(`[cleanup] Expired ${cleaned} stale upload session(s)`);
  } catch (error) {
    console.error("[cleanup] Failed:", errorMessage(error));
  }
};

const start = async (): Promise<void> => {
  try {
    await connectDatabase();
    console.log("✅ Database connected");

    await getOrCreateStorageConfig();

    server = app.listen(env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
      console.log(`📚 API docs at http://localhost:${env.PORT}/api/docs`);
    });

    await runCleanup();
    cleanupTimer = setInterval(() => void runCleanup(), env.CLEANUP_INTERVAL_MINUTES * 60 * 1000);
    cleanupTimer.unref();
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  }
};

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received, shutting down gracefully...`);
  clearInterval(cleanupTimer);

  const forceExit = setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  const activeServer = server;
  if (activeServer) {
    await new Promise<void>((resolve) => activeServer.close(() => resolve()));
  }
  await disconnectDatabase();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  void shutdown("uncaughtException");
});

void start();
