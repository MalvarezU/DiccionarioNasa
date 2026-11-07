import "./test-db";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { bumpContentVersion, getContentVersion } from "@/lib/content-version";
import { testDb, ensureSeedRow, disconnectTestDb, resolveTestDatabaseUrl } from "./test-db";
import { acquireBumpLock, releaseBumpLock } from "./lock";

/**
 * T02 — Helper `bumpContentVersion` + `getContentVersion` (BUMP-01).
 *
 * - Bump sobre versión `v` deja `v+1` y retorna el nuevo valor.
 * - Dos bumps concurrentes (`Promise.all`, clientes separados como dos
 *   admins) dejan exactamente `+2` (sin lost update, E1).
 * - `getContentVersion()` sin fila retorna `1` sin crearla.
 * - `bumpContentVersion` sin fila previa crea `(1,1)` y aplica `+1` (→ 2).
 *
 * Aserciones siempre relativas a la versión leída (nunca absolutas): el
 * archivo `fase-a.mig.test.ts` corre en paralelo contra la misma BD.
 */

function freshClient(): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: resolveTestDatabaseUrl() } } });
}

beforeAll(async () => {
  await acquireBumpLock("bump-helper");
});

async function currentVersion(): Promise<number> {
  const rows = await testDb().$queryRaw<Array<{ version: number }>>`
    SELECT version FROM ContentVersion WHERE id = 1
  `;
  if (rows.length !== 1) throw new Error("estado inesperado: ContentVersion sin exactly-una fila");
  return rows[0].version;
}

async function clearRows(): Promise<void> {
  await testDb().$executeRaw`DELETE FROM ContentVersion`;
}

afterAll(async () => {
  await releaseBumpLock();
  await ensureSeedRow();
  await disconnectTestDb();
});

describe("T02 BUMP-01: getContentVersion lectura fresca sin caché", () => {
  it("sin fila retorna 1 sin crearla", async () => {
    await clearRows();
    try {
      await expect(getContentVersion()).resolves.toBe(1);
      const count = await testDb().$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*) AS n FROM ContentVersion
      `;
      expect(Number(count[0]?.n ?? -1)).toBe(0);
    } finally {
      await ensureSeedRow();
    }
  });

  it("con fila retorna la versión almacenada", async () => {
    await ensureSeedRow();
    const expected = await currentVersion();
    await expect(getContentVersion()).resolves.toBe(expected);
  });
});

describe("T02 BUMP-01: bumpContentVersion atómico +1", () => {
  it("sobre versión v deja v+1 y retorna el nuevo valor", async () => {
    await ensureSeedRow();
    const before = await currentVersion();
    const returned = await bumpContentVersion(testDb());
    expect(returned).toBe(before + 1);
    await expect(getContentVersion()).resolves.toBe(before + 1);
  });

  it("sin fila previa crea (1,1) y aplica +1 (retorna 2)", async () => {
    await clearRows();
    try {
      const returned = await bumpContentVersion(testDb());
      expect(returned).toBe(2);
      await expect(getContentVersion()).resolves.toBe(2);
    } finally {
      await ensureSeedRow();
    }
  });

  it("dos bumps concurrentes dejan exactamente +2 (sin lost update)", async () => {
    await ensureSeedRow();
    const before = await currentVersion();
    const a = freshClient();
    const b = freshClient();
    try {
      await Promise.all([bumpContentVersion(a), bumpContentVersion(b)]);
      await expect(getContentVersion()).resolves.toBe(before + 2);
    } finally {
      await a.$disconnect();
      await b.$disconnect();
    }
  });
});
