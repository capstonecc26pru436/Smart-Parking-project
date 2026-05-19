import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// 1. Tangkap URL asli ATAU gunakan dummy secara langsung jika sedang proses build
const connectionString = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaClient: PrismaClient;

if (globalForPrisma.prisma) {
  prismaClient = globalForPrisma.prisma;
} else {
  // 2. Selalu gunakan Pool dan Adapter, baik dengan URL asli maupun dummy
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool);
  
  // 3. Inisialisasi Prisma (Tidak akan crash lagi karena adapter selalu ada)
  prismaClient = new PrismaClient({ adapter });
}

export const prisma = prismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;