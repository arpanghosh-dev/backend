const prisma = require("../config/database");

async function reserveStorage(fileSize) {
  const size = BigInt(fileSize);

  return prisma.$transaction(async (tx) => {

    const result = await tx.$queryRaw`
      UPDATE storage_configs
      SET
        reserved_storage = reserved_storage + ${size},
        updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM storage_configs
        LIMIT 1
      )
      AND used_storage + reserved_storage + ${size}
          <= total_limit
      RETURNING id
    `;

    if (result.length === 0) {
      throw new Error("Storage limit exceeded");
    }

    return result[0].id;
  });
}

module.exports = {
  reserveStorage
};