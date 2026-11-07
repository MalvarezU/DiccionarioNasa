import { PrismaClient } from "@prisma/client";

/**
 * Helper compartido por los tests de Fase A (`tests/fase-a/`).
 *
 * - Resuelve `DATABASE_URL` del entorno con fallback a la BD local de test
 *   documentada por el proyecto (`mysql://test:test@127.0.0.1:3307/piiyaak_test`).
 * - A modo de red de seguridad (el espíritu de `scripts/e2e-local.sh`: jamás
 *   prod), rechaza cualquier URL que no sea local+`piiyaak_test`.
 * - Fija el fallback en `process.env` como efecto lateral de importar este
 *   módulo: DEBE ser la primera importación de cada archivo de test, para que
 *   el cliente global de `@/lib/db` (construido al evaluar el módulo) vea la
 *   variable ya definida. ESM evalúa las importaciones en orden, así que la
 *   primera línea `import "./test-db"` corre antes que `@/lib/db`.
 */

const FALLBACK_URL = "mysql://test:test@127.0.0.1:3307/piiyaak_test";

export function resolveTestDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? FALLBACK_URL;
  const isLocal = /(localhost|127\.0\.0\.1)/.test(url) && /piiyaak_test/.test(url);
  if (!isLocal) {
    throw new Error(
      "[fase-a] refusing non-local DATABASE_URL: los tests de Fase A solo corren contra la BD local de test.",
    );
  }
  return url;
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = FALLBACK_URL;
}

let client: PrismaClient | undefined;

/** Cliente Prisma propio del test (URL explícita, sin depender del global). */
export function testDb(): PrismaClient {
  client ??= new PrismaClient({ datasources: { db: { url: resolveTestDatabaseUrl() } } });
  return client;
}

/** Reasegura la fila semilla (1,1) sin alterar una versión ya bump-eada. */
export async function ensureSeedRow(): Promise<void> {
  await testDb().$executeRaw`INSERT IGNORE INTO ContentVersion (id, version, updatedAt) VALUES (1, 1, CURRENT_TIMESTAMP(3))`;
}

export async function disconnectTestDb(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}
