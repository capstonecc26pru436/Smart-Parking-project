import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaClient: PrismaClient;

if (globalForPrisma.prisma) {
  prismaClient = globalForPrisma.prisma;
} else if (connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // NeonDB requires SSL
  });
  const adapter = new PrismaPg(pool);
  prismaClient = new PrismaClient({ adapter });
} else {
  // Fallback for build time if DATABASE_URL is not provided
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost/dummy";
  prismaClient = new PrismaClient();
}

export const prisma = prismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
