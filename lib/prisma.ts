import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaClient: PrismaClient;

if (globalForPrisma.prisma) {
  prismaClient = globalForPrisma.prisma;
} else {
  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false } // NeonDB requires SSL
  });
  const adapter = new PrismaPg(pool);
  prismaClient = new PrismaClient({ adapter });
}

export const prisma = prismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
