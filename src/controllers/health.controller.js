import { prisma } from "../config/database.js";

export const healthCheck = async (_req, res) => {
  let database = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }

  const healthy = database === "up";

  return res.status(healthy ? 200 : 503).json({
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
