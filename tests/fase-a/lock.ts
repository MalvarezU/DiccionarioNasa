import { testDb } from "./test-db";

/**
 * Serialización de archivos de Fase A que hacen bump.
 *
 * La versión global (`ContentVersion`) es compartida por toda la BD de test
 * y vitest ejecuta archivos en workers paralelos: sin lock, los bumps de un
 * archivo romperían las aserciones de delta (+1) de otro. El lock es un
 * `GET_LOCK` de MySQL con nombre fijo; se libera al desconectar el pool en
 * `afterAll` (el `RELEASE_LOCK` explícito es best-effort porque el pool
 * puede usar otra conexión).
 *
 * Archivos que hacen bump DEBEN adquirirlo en `beforeAll`. Los que solo
 * leen (`fase-a.mig`) no lo necesitan.
 */

const LOCK_NAME = "fase-a-bump";

export async function acquireBumpLock(owner: string): Promise<void> {
  const rows = await testDb()
    .$queryRaw<Array<{ got: number }>>`SELECT GET_LOCK(${LOCK_NAME}, 120) AS got`;
  if (rows[0]?.got !== 1) {
    throw new Error(`[fase-a] ${owner}: no se pudo adquirir el lock de bump`);
  }
}

export async function releaseBumpLock(): Promise<void> {
  try {
    await testDb().$queryRaw`SELECT RELEASE_LOCK(${LOCK_NAME})`;
  } catch {
    // El lock se libera igual al desconectar el pool en afterAll.
  }
}
