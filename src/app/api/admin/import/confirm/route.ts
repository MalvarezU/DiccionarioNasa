import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { bumpContentVersion } from "@/lib/content-version";
import { takePreview } from "../preview/route";

/**
 * POST /api/admin/import/confirm
 * Body { previewToken }. Escribe lo validado en el preview (transacción
 * por lotes) con bitácora por ficha + resumen. Requiere editor+.
 * Devuelve filas para el reporte CSV (lo arma el cliente).
 */
export async function POST(request: Request) {
  const { session, error } = await requireRole("editor");
  if (error) return error;

  try {
    const body = await request.json().catch(() => null);
    const previewToken = body?.previewToken;
    if (!previewToken || typeof previewToken !== "string") {
      return NextResponse.json(
        { message: "Falta el token de vista previa (expiró: repite el paso 1)" },
        { status: 400 }
      );
    }

    const rows = takePreview(previewToken);
    if (!rows) {
      return NextResponse.json(
        { message: "Vista previa expirada o inválida (15 min). Repite el paso 1." },
        { status: 410 }
      );
    }

    const userId = (session!.user as { id: string }).id;

    // Fase A T04: import en dos pasos = un solo bump en `confirm` (BUMP-02:
    // N filas aplicadas = +1, no +N). 0 filas efectivas → sin bump.
    const result = await db.$transaction(async (tx) => {
      let created = 0;
      let skipped = 0;
      const report: Array<{ spanish: string; nasaYuwe: string; resultado: string }> = [];

      for (const row of rows) {
        // Re-chequeo de duplicado (pudo entrar algo entre preview y confirm)
        const dup = await tx.dictionaryWord.findFirst({
          where: { spanish: { equals: row.spanish } },
        });
        if (dup) {
          skipped++;
          report.push({ spanish: row.spanish, nasaYuwe: row.nasaYuwe, resultado: "omitida (duplicada)" });
          continue;
        }
        try {
          const createdWord = await tx.dictionaryWord.create({ data: { ...row } });
          await tx.auditLog.create({
            data: {
              action: "IMPORT",
              entity: "DictionaryWord",
              entityId: createdWord.id,
              changes: JSON.stringify({ spanish: row.spanish, nasaYuwe: row.nasaYuwe, status: row.status }),
              userId,
              wordId: createdWord.id,
            },
          });
          created++;
          report.push({ spanish: row.spanish, nasaYuwe: row.nasaYuwe, resultado: `creada (${row.status})` });
        } catch {
          skipped++;
          report.push({ spanish: row.spanish, nasaYuwe: row.nasaYuwe, resultado: "error al crear" });
        }
      }

      if (created > 0) {
        await bumpContentVersion(tx);
      }

      return { created, skipped, total: rows.length, report };
    });

    // Nota spec §2.3.6: `POST /api/admin/import` directo (staging) no hace
    // bump; el único bump del flujo vive acá.
    return NextResponse.json(result);
  } catch (error) {
    console.error("Import confirm error:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}
