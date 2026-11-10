import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _prismaInstance: PrismaClient | undefined;

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }
  if (_prismaInstance) {
    return _prismaInstance;
  }

  const connectionString =
    process.env["DATABASE_URL"] ||
    "postgresql://postgres:postgres@localhost:5432/cafelens?schema=public";

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
  });

  if (process.env["NODE_ENV"] !== "production") {
    globalForPrisma.prisma = client;
  } else {
    _prismaInstance = client;
  }

  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const val = (client as unknown as Record<string, unknown>)[prop as string];
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(client) : val;
  },
});

export default prisma;
