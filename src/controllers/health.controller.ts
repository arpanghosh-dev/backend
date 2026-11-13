import type { Request, Response } from "express";
import { prisma } from "../config/database.js";

type ServiceState = "up" | "down";

export const healthCheck = async (_req: Request, res: Response): Promise<void> => {
  let database: ServiceState = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }

  const healthy = database === "up";

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? "API is healthy" : "API is degraded",
    data: {
      status: healthy ? "ok" : "degraded",
      services: { api: "up", database },
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
};
