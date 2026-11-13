export const BYTES_PER_MB = 1024 ** 2;
export const BYTES_PER_GB = 1024 ** 3;

export const gbToBytes = (gb) => BigInt(Math.round(gb * BYTES_PER_GB));
export const mbToBytes = (mb) => BigInt(Math.round(mb * BYTES_PER_MB));

/** Convert a BigInt (or number) to a JS number for JSON responses. */
export const toNumber = (value) => (typeof value === "bigint" ? Number(value) : Number(value ?? 0));

export const formatBytes = (bytes, decimals = 2) => {
  const value = toNumber(bytes);
  if (value === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${parseFloat((value / 1024 ** index).toFixed(decimals))} ${units[index]}`;
};

export const calculateAvailable = ({ totalLimit, usedStorage, reservedStorage }) => {
  const available = BigInt(totalLimit) - BigInt(usedStorage) - BigInt(reservedStorage);
  return available > 0n ? available : 0n;
};

export const calculatePercentage = (part, total) => {
  const t = toNumber(total);
  if (t === 0) return 0;
  return Number(((toNumber(part) / t) * 100).toFixed(2));
};

/** Build the public storage statistics object from a StorageConfig row. */
export const buildStorageStats = (config, extra = {}) => {
  const available = calculateAvailable(config);
  const committed = BigInt(config.usedStorage) + BigInt(config.reservedStorage);

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
