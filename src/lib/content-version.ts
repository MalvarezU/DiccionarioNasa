import { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

/**
 * Fase A — marcador global de publicación (decisión D2, spec §2.1).
 *
 * Una sola fila `ContentVersion(id = 1)`. Cada mutación de contenido
 * publicable ejecuta UN `UPDATE` atómico `version = version + 1`.
 *
 * Regla de orden (spec §2.2): mutación primero, bump al final, dentro de la
 * MISMA transacción Prisma (`db.$transaction`) donde el motor lo permita.
 * El bump post-commit solo se admite donde la transacción conjunta sea
 * imposible; en ese caso el orden es mutación → bump, y un bump fallido tras
 * mutación exitosa se registra con nivel error (alerta), nunca se silencia
 * (R5). Si la mutación falla, no hay bump.
 *
 * Sin caché en memoria: `getContentVersion()` lee fresco por request.
 */

export type ContentVersionTx = Prisma.TransactionClient | PrismaClient;

/**
 * Incremento atómico +1. Crea la fila (1,1) si no existe y retorna la
 * versión resultante. Nunca read-modify-write en JS: el incremento es
 * `UPDATE ... SET version = version + 1` (seguro bajo concurrencia, E1).
 */
export async function bumpContentVersion(tx: ContentVersionTx): Promise<number> {
  await tx.$executeRaw`INSERT IGNORE INTO ContentVersion (id, version, updatedAt) VALUES (1, 1, CURRENT_TIMESTAMP(3))`;
  await tx.$executeRaw`UPDATE ContentVersion SET version = version + 1 WHERE id = 1`;
  const rows = await tx.$queryRaw<Array<{ version: number }>>`
    SELECT version FROM ContentVersion WHERE id = 1
  `;
  const version = rows[0]?.version;
  if (typeof version !== "number") {
    throw new Error("[content-version] bump aplicado pero sin fila id=1 legible");
  }
  return version;
}

/** Lectura fresca, sin caché. Retorna 1 si la tabla aún está vacía (sin crearla). */
export async function getContentVersion(): Promise<number> {
  const row = await db.contentVersion.findUnique({ where: { id: 1 } });
  return row?.version ?? 1;
}
