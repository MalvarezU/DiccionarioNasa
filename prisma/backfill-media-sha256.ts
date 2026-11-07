/**
 * Backfill idempotente de `MediaAsset.sha256` (Fase A, T09, spec §4.2).
 *
 * - Recorre `MediaAsset WHERE sha256 IS NULL` en lotes de 100 por `id` asc
 *   (reanudable: interrumpir y re-ejecutar es seguro).
 * - Crea filas faltantes para audios legacy referenciados desde
 *   `DictionaryWord.audioUrl` cuando el objeto existe en R2.
 * - Nunca borra filas ni objetos: los faltantes se reportan (E5) y la purga
 *   física sigue siendo tarea de `prisma/r2-prune.ts`.
 * - No genera bump de `ContentVersion`: es sanado, no publicación.
 *
 * Uso:
 *   bun run prisma/backfill-media-sha256.ts [--json <ruta-reporte>]
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import { backfillMediaSha256 } from "../src/lib/media/backfill-sha256";
import { getObjectBytes } from "../src/lib/r2";

const db = new PrismaClient();

const args = process.argv.slice(2);
const jsonIdx = args.indexOf("--json");
const JSON_PATH = jsonIdx === -1 ? null : (args[jsonIdx + 1] ?? null);

async function main() {
  const report = await backfillMediaSha256({ db, fetchBytes: getObjectBytes });

  console.log(
    `backfill-sha256: updated=${report.updated} skipped=${report.skipped} ` +
      `legacyCreated=${report.legacyCreated.length} legacyMissing=${report.legacyMissing.length} ` +
      `missingInR2=${report.missingInR2.length}`
  );
  for (const m of report.missingInR2) {
    console.log(`  · falta en R2: ${m.objectKey} (fila ${m.mediaAssetId}, intacta)`);
  }
  for (const ref of report.legacyMissing) {
    console.log(`  · fuera de inventario: ${ref}`);
  }
  for (const key of report.legacyCreated) {
    console.log(`  ✓ fila legacy creada: ${key}`);
  }
  console.log(JSON.stringify(report, null, 2));

  if (JSON_PATH) {
    writeFileSync(JSON_PATH, JSON.stringify(report, null, 2));
    console.log(`reporte JSON: ${JSON_PATH}`);
  }

  await db.$disconnect();
}

await main();
