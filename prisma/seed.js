const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.storageConfig.findFirst();

  if (!existing) {
    await prisma.storageConfig.create({
      data: {
        totalLimit: BigInt(10 * 1024 ** 3),
        usedStorage: BigInt(0),
        reservedStorage: BigInt(0)
      }
    });

    console.log("10 GB storage initialized");
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });