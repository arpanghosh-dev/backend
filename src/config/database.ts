import { Prisma, PrismaClient } from "@prisma/client";
import { isProduction } from "./env.js";

/** Either the root client or an interactive-transaction client. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

const globalForPrisma = globalThis as typeof globalThis & { __prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: isProduction ? ["error"] : ["warn", "error"],
  });

if (!isProduction) {
  globalForPrisma.__prisma = prisma;
}

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
};
