import type { PrismaClient } from "@prisma/client";
import { audioRefToKey } from "./storage";
import { detectAudioMime } from "./audio";
import { sha256Hex } from "./hash";

export type MissingMedia = { objectKey: string; mediaAssetId: string };

export type BackfillReport = {
  /** Filas `MediaAsset` a las que se les completó `sha256`. */
  updated: number;
  /** Filas sin hash cuyo objeto ya no existe en R2 (intactas, sin borrar). */
  skipped: number;
  missingInR2: MissingMedia[];
  /** Claves R2 para las que se creó la fila legacy faltante. */
  legacyCreated: string[];
  /** Referencias de audio sin fila ni objeto R2 (fuera de inventario). */
  legacyMissing: string[];
};

const BATCH_SIZE = 100;

function baseName(key: string): string {
  return key.split("/").pop() || key;
}

/**
 * Fase A T09 — backfill idempotente de `sha256` (spec §4.2, HASH-02).
 *
 * - Recorre `MediaAsset WHERE sha256 IS NULL` en lotes de 100 por `id` asc
 *   (reanudable: cada fila commitea por separado; interrumpir y re-ejecutar
 *   es seguro). Segunda corrida sobre filas completas = 0 writes.
 * - Objeto R2 faltante: warning + entrada en `missingInR2`, sin borrar la
 *   fila y sin fallar (la purga física queda fuera de alcance, E5).
 * - Audios legacy (`DictionaryWord.audioUrl` sin fila): si el objeto existe
 *   crea la fila (`filename` derivado, MIME por firma, `size`, hash); si no,
 *   anota en `legacyMissing`.
 *
 * Nunca genera bump de `ContentVersion`: es una operación de sanado, no una
 * publicación (los bumps de esos medios ocurrieron —o debieron ocurrir— en su
 * subida original).
 */
export async function backfillMediaSha256(opts: {
  db: PrismaClient;
  fetchBytes: (objectKey: string) => Promise<Buffer | null>;
  batchSize?: number;
}): Promise<BackfillReport> {
  const { db, fetchBytes } = opts;
  const batchSize = opts.batchSize ?? BATCH_SIZE;
  const report: BackfillReport = {
    updated: 0,
    skipped: 0,
    missingInR2: [],
    legacyCreated: [],
    legacyMissing: [],
  };

  // ---- 1. Filas MediaAsset sin hash, por lotes reanudables ----
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.mediaAsset.findMany({
      where: { sha256: null },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;
    for (const row of batch) {
      let bytes: Buffer | null;
      try {
        bytes = await fetchBytes(row.objectKey);
      } catch (err) {
        console.warn(
          `[backfill-sha256] descarga fallida ${row.objectKey} (fila ${row.id} intacta):`,
          (err as Error).message
        );
        report.skipped++;
        report.missingInR2.push({ objectKey: row.objectKey, mediaAssetId: row.id });
        continue;
      }
      if (!bytes) {
        console.warn(
          `[backfill-sha256] objeto ausente en R2: ${row.objectKey} (fila ${row.id} intacta, sin borrar)`
        );
        report.skipped++;
        report.missingInR2.push({ objectKey: row.objectKey, mediaAssetId: row.id });
        continue;
      }
      await db.mediaAsset.update({
        where: { id: row.id },
        data: { sha256: sha256Hex(bytes) },
      });
      report.updated++;
    }
    cursor = batch[batch.length - 1]!.id;
    if (batch.length < batchSize) break;
  }

  // ---- 2. Audios legacy sin fila ----
  const words = await db.dictionaryWord.findMany({
    where: { audioUrl: { not: null } },
    select: { audioUrl: true },
  });
  const seen = new Set<string>();
  for (const w of words) {
    const ref = w.audioUrl!;
    if (seen.has(ref)) continue;
    seen.add(ref);
    const key = audioRefToKey(ref);
    if (!key) {
      report.legacyMissing.push(ref);
      continue;
    }
    const existing = await db.mediaAsset.findFirst({
      where: { objectKey: key },
      select: { id: true },
    });
    if (existing) continue;
    let bytes: Buffer | null;
    try {
      bytes = await fetchBytes(key);
    } catch (err) {
      console.warn(
        `[backfill-sha256] descarga legacy fallida ${key}:`,
        (err as Error).message
      );
      report.legacyMissing.push(ref);
      continue;
    }
    if (!bytes) {
      report.legacyMissing.push(ref);
      continue;
    }
    await db.mediaAsset.create({
      data: {
        objectKey: key,
        filename: baseName(key),
        mimeType: detectAudioMime(bytes) ?? "application/octet-stream",
        size: bytes.length,
        sha256: sha256Hex(bytes),
      },
    });
    report.legacyCreated.push(key);
  }

  return report;
}
