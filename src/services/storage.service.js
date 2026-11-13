import { Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { buildStorageStats, formatBytes, gbToBytes } from "../utils/storage-calculator.js";

// The app keeps a single storage configuration row with a fixed id.
export const STORAGE_CONFIG_ID = "00000000-0000-0000-0000-000000000001";

/** Fetch the storage config row, creating it on first use. */
export const getOrCreateStorageConfig = async (db = prisma) => {
  const existing = await db.storageConfig.findUnique({ where: { id: STORAGE_CONFIG_ID } });
  if (existing) return existing;

  try {
    return await db.storageConfig.create({
      data: { id: STORAGE_CONFIG_ID, totalLimit: gbToBytes(env.STORAGE_LIMIT_GB) },
    });
  } catch (error) {
    // Another request created it concurrently.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return db.storageConfig.findUniqueOrThrow({ where: { id: STORAGE_CONFIG_ID } });
    }
    throw error;
  }
};

/**
 * Atomically reserve space. The WHERE clause makes the capacity check and the
 * increment a single statement, so concurrent uploads can never over-commit.
 */
export const reserveStorage = async (db, size) => {
  const bytes = BigInt(size);
  const updated = await db.$executeRaw`
    UPDATE storage_configs
       SET reserved_storage = reserved_storage + ${bytes},
           updated_at = NOW()
     WHERE id = ${STORAGE_CONFIG_ID}::uuid
       AND used_storage + reserved_storage + ${bytes} <= total_limit
  `;

  if (updated === 0) {
    const config = await db.storageConfig.findUniqueOrThrow({ where: { id: STORAGE_CONFIG_ID } });
    const stats = buildStorageStats(config);
    throw AppError.payloadTooLarge(
      `Not enough storage space. Requested ${formatBytes(bytes)}, available ${stats.formatted.availableStorage}.`,
      "STORAGE_LIMIT_EXCEEDED",
      { requested: Number(bytes), available: stats.availableStorage },
    );
  }
};

/** Give back reserved space (upload expired, failed or was rejected). */
export const releaseReservedStorage = async (db, size) => {
  const bytes = BigInt(size);
  await db.$executeRaw`
    UPDATE storage_configs
       SET reserved_storage = GREATEST(reserved_storage - ${bytes}, 0),
           updated_at = NOW()
     WHERE id = ${STORAGE_CONFIG_ID}::uuid
  `;
};

/** Move space from "reserved" to "used" once an upload is verified. */
export const commitReservedStorage = async (db, size) => {
  const bytes = BigInt(size);
  await db.$executeRaw`
    UPDATE storage_configs
       SET reserved_storage = GREATEST(reserved_storage - ${bytes}, 0),
           used_storage = used_storage + ${bytes},
           updated_at = NOW()
     WHERE id = ${STORAGE_CONFIG_ID}::uuid
  `;
};

/** Free used space after a file is deleted. */
export const releaseUsedStorage = async (db, size) => {
  const bytes = BigInt(size);
  await db.$executeRaw`
    UPDATE storage_configs
       SET used_storage = GREATEST(used_storage - ${bytes}, 0),
           updated_at = NOW()
     WHERE id = ${STORAGE_CONFIG_ID}::uuid
  `;
};

export const getStorageStats = async () => {
  await getOrCreateStorageConfig();

  const [config, fileCount, pendingUploads] = await Promise.all([
    prisma.storageConfig.findUniqueOrThrow({ where: { id: STORAGE_CONFIG_ID } }),
    prisma.file.count({ where: { status: "COMPLETED" } }),
    prisma.uploadSession.count({ where: { status: "PENDING" } }),
  ]);

  return buildStorageStats(config, { fileCount, pendingUploads });
};

export const updateStorageLimit = async (newLimitBytes) => {
  await getOrCreateStorageConfig();
  const limit = BigInt(newLimitBytes);

  // Only apply the new limit if it still covers everything already used or reserved.
  const updated = await prisma.$executeRaw`
    UPDATE storage_configs
       SET total_limit = ${limit},
           updated_at = NOW()
     WHERE id = ${STORAGE_CONFIG_ID}::uuid
       AND used_storage + reserved_storage <= ${limit}
  `;

  if (updated === 0) {
    const config = await prisma.storageConfig.findUniqueOrThrow({ where: { id: STORAGE_CONFIG_ID } });
    const committed = config.usedStorage + config.reservedStorage;
    throw AppError.badRequest(
      `Storage limit cannot be lower than the space already used or reserved (${formatBytes(committed)}).`,
      "LIMIT_BELOW_USAGE",
      { requestedLimit: Number(limit), minimumLimit: Number(committed) },
    );
  }

  return getStorageStats();
};
