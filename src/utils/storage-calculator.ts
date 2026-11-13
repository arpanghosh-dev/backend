import type { StorageConfig } from "@prisma/client";

export const BYTES_PER_MB = 1024 ** 2;
export const BYTES_PER_GB = 1024 ** 3;

export type ByteValue = bigint | number;

export const gbToBytes = (gb: number): bigint => BigInt(Math.round(gb * BYTES_PER_GB));
export const mbToBytes = (mb: number): bigint => BigInt(Math.round(mb * BYTES_PER_MB));

/** Convert a BigInt (or number) to a JS number for JSON responses. */
export const toNumber = (value: ByteValue | null | undefined): number => Number(value ?? 0);

export const formatBytes = (bytes: ByteValue, decimals = 2): string => {
  const value = toNumber(bytes);
  if (value <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${parseFloat((value / 1024 ** index).toFixed(decimals))} ${units[index]}`;
};

type StorageNumbers = Pick<StorageConfig, "totalLimit" | "usedStorage" | "reservedStorage">;

export const calculateAvailable = ({ totalLimit, usedStorage, reservedStorage }: StorageNumbers): bigint => {
  const available = totalLimit - usedStorage - reservedStorage;
  return available > 0n ? available : 0n;
};

export const calculatePercentage = (part: ByteValue, total: ByteValue): number => {
  const t = toNumber(total);
  if (t === 0) return 0;
  return Number(((toNumber(part) / t) * 100).toFixed(2));
};

export interface StorageStats {
  totalLimit: number;
  usedStorage: number;
  reservedStorage: number;
  availableStorage: number;
  usagePercentage: number;
  committedPercentage: number;
  formatted: {
    totalLimit: string;
    usedStorage: string;
    reservedStorage: string;
    availableStorage: string;
  };
  fileCount?: number;
  pendingUploads?: number;
  updatedAt: Date;
}

/** Build the public storage statistics object from a StorageConfig row. */
export const buildStorageStats = (
  config: StorageConfig,
  extra: Pick<StorageStats, "fileCount" | "pendingUploads"> = {},
): StorageStats => {
  const available = calculateAvailable(config);
  const committed = config.usedStorage + config.reservedStorage;

  return {
    totalLimit: toNumber(config.totalLimit),
    usedStorage: toNumber(config.usedStorage),
    reservedStorage: toNumber(config.reservedStorage),
    availableStorage: toNumber(available),
    usagePercentage: calculatePercentage(config.usedStorage, config.totalLimit),
    committedPercentage: calculatePercentage(committed, config.totalLimit),
    formatted: {
      totalLimit: formatBytes(config.totalLimit),
      usedStorage: formatBytes(config.usedStorage),
      reservedStorage: formatBytes(config.reservedStorage),
      availableStorage: formatBytes(available),
    },
    ...extra,
    updatedAt: config.updatedAt,
  };
};
