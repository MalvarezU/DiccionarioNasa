import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { takePreview } from "../preview/route";

/**
 * POST /api/admin/import/confirm
 * Body { previewToken }. Escribe lo validado en el preview (escritura
 * secuencial por ficha, con bitácora por ficha + resumen). Requiere editor+.
 * No es una transacción: si falla a mitad, las fichas ya creadas quedan y
 * el reintento omite las duplicadas (idempotente por «español»).
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
    let created = 0;
    let skipped = 0;
    const report: Array<{ spanish: string; nasaYuwe: string; resultado: string }> = [];

    // Re-chequeo de duplicados en una sola consulta (pudo entrar algo entre
    // preview y confirm): evita N roundtrips a la BD.
    const pendingNames = [...new Set(rows.map((r) => r.spanish))];
    const existing = await db.dictionaryWord.findMany({
      where: { spanish: { in: pendingNames } },
      select: { spanish: true },
    });
    const taken = new Set(existing.map((w) => w.spanish.trim().toLowerCase()));

    for (const row of rows) {
      const key = row.spanish.trim().toLowerCase();
      if (taken.has(key)) {
        skipped++;
        report.push({ spanish: row.spanish, nasaYuwe: row.nasaYuwe, resultado: "omitida (duplicada)" });
        taken.add(key); // evita duplicados dentro del propio lote
        continue;
      }
      taken.add(key);
      try {
        const createdWord = await db.dictionaryWord.create({ data: { ...row } });
        await db.auditLog.create({
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

    return NextResponse.json({ created, skipped, total: rows.length, report });
  } catch (error) {
    console.error("Import confirm error:", error);
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 });
  }
}
