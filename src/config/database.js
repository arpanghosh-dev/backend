import { PrismaClient } from "@prisma/client";
import { isProduction } from "./env.js";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: isProduction ? ["error"] : ["warn", "error"],
  });

if (!isProduction) {
  globalForPrisma.__prisma = prisma;
}

export const connectDatabase = async () => {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
};

export const disconnectDatabase = async () => {
  await prisma.$disconnect();
};
