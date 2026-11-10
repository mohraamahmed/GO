import type { PrismaClient as PrismaClientType } from "@prisma/client";
import PrismaPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientType | undefined;
};

let _prismaInstance: PrismaClientType | undefined;

function getPrismaClient(): PrismaClientType {
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

  const PrismaConstructor: any =
    (PrismaPkg as any).PrismaClient ||
    (PrismaPkg as any).default?.PrismaClient ||
    PrismaPkg;

  const client = new PrismaConstructor({
    adapter,
    log: process.env["NODE_ENV"] === "development" ? ["query", "error", "warn"] : ["error"],
  }) as PrismaClientType;

  if (process.env["NODE_ENV"] !== "production") {
    globalForPrisma.prisma = client;
  } else {
    _prismaInstance = client;
  }

  return client;
}

export const prisma = new Proxy({} as PrismaClientType, {
  get(_target, prop) {
    const client = getPrismaClient();
    const val = (client as unknown as Record<string, unknown>)[prop as string];
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(client) : val;
  },
});

export default prisma;
