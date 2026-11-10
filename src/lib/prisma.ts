import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { createRequire } from "node:module";

const localRequire = createRequire(import.meta.url);

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

  try {
    const { Pool } = localRequire("pg");
    const { PrismaPg } = localRequire("@prisma/adapter-pg");
    const PrismaPkg = localRequire("@prisma/client");

    const connectionString =
      process.env["DATABASE_URL"] ||
      "postgresql://postgres:postgres@localhost:5432/cafelens?schema=public";

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    const PrismaConstructor: any =
      PrismaPkg.PrismaClient ||
      PrismaPkg.default?.PrismaClient ||
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
  } catch (err) {
    console.warn("[Prisma Lazy Init Fallback] Prisma client unavailable:", err);
    return new Proxy({} as PrismaClientType, {
      get(_t, prop) {
        if (typeof prop === "string" && ["then", "catch", "finally"].includes(prop)) return undefined;
        return () => {
          throw new Error(`Prisma Client is not configured or generated: ${(err as Error)?.message || err}`);
        };
      },
    });
  }
}

export const prisma = new Proxy({} as PrismaClientType, {
  get(_target, prop) {
    const client = getPrismaClient();
    const val = (client as unknown as Record<string, unknown>)[prop as string];
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(client) : val;
  },
});

export default prisma;
