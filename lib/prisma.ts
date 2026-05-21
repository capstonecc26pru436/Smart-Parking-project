import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as { prisma2: PrismaClient };

const dbUrl = process.env.DATABASE_URL || "";
const isValidDbUrl = dbUrl.startsWith("postgres") && !dbUrl.includes("localhost");

let prismaClient: PrismaClient;

if (globalForPrisma.prisma2) {
  prismaClient = globalForPrisma.prisma2;
} else {
  if (isValidDbUrl) {
    const pool = new Pool({ connectionString: dbUrl });
    const adapter = new PrismaPg(pool);
    prismaClient = new PrismaClient({ adapter });
  } else {
    // If no db, just create dummy client that might fail later if used
    prismaClient = new PrismaClient({ adapter: null as any });
  }
}

export const prisma = prismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma2 = prisma;