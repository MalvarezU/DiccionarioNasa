import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { bumpContentVersion } from "@/lib/content-version";
import { takePreview } from "../preview/route";

/**
 * POST /api/admin/import/confirm
 * Body { previewToken }. Escribe lo validado en el preview (escritura
 * secuencial por ficha, con bitácora por ficha + resumen). Requiere editor+.
 * Transacción única (Fase A T04): si falla a mitad, nada se escribe; un solo
 * bump de contentVersion por confirm con filas efectivas.
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
    // Re-chequeo de duplicados en una sola consulta dentro de la
    // transacción (evita N roundtrips); case-insensitive con trim.
    const result = await db.$transaction(async (tx) => {
      let created = 0;
      let skipped = 0;
      const report: Array<{ spanish: string; nasaYuwe: string; resultado: string }> = [];

      const pendingNames = [...new Set(rows.map((r) => r.spanish))];
      const existing = await tx.dictionaryWord.findMany({
        where: { spanish: { in: pendingNames } },
        select: { spanish: true },
      });
      const taken = new Set(existing.map((w) => w.spanish.trim().toLowerCase()));

      for (const row of rows) {
        const key = row.spanish.trim().toLowerCase();
        if (taken.has(key)) {
          skipped++;
          report.push({ spanish: row.spanish, nasaYuwe: row.nasaYuwe, resultado: "omitida (duplicada)" });
          continue;
        }
        taken.add(key);
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

    // Nota spec §2.3.6 (C1): el legacy `POST /api/admin/import` también
    // bumpea (+1 por request aplicada); cada flujo bumpea lo suyo, sin
    // doble conteo entre legacy y `confirm`.
    return NextResponse.json(result);
  } catch (error) {
    console.error("Import confirm error:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}
