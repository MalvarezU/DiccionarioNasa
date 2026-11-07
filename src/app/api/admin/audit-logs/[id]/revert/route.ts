import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/auth"
import { audioRefToKey } from "@/lib/media/storage"
import { deleteObject } from "@/lib/r2"
import { deleteMediaAssetByUrl } from "@/lib/media/delete-asset"
import { bumpContentVersion } from "@/lib/content-version"

/**
 * POST /api/admin/audit-logs/[id]/revert
 *
 * Restaura el estado previo de un cambio registrado en la bitácora.
 * Solo admin (la reversión es una acción administrativa).
 *
 * Reversible: DictionaryWord UPDATE/PUBLISH/ARCHIVE/CREATE/IMPORT,
 *             DictionaryWord DELETE (si el log tiene snapshot completo),
 *             User UPDATE (rol).
 * No reversible: User DELETE, entidades desconocidas, logs malformados.
 *
 * Idempotente: si ya existe un log REVERT que referencia este id, 409.
 * Concurrencia: se re-lee la entidad y se compara con los `after`
 * registrados; si difiere, 409 (no se pisa un cambio posterior).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const adminUser = session!.user as { id: string; name?: string | null; email?: string | null }

  const original = await db.auditLog.findUnique({ where: { id } })
  if (!original) {
    return NextResponse.json({ message: "Entrada no encontrada" }, { status: 404 })
  }

  // Idempotencia: ya revertido
  const already = await db.auditLog.findFirst({
    where: {
      action: "REVERT",
      changes: { contains: `"originalLogId":"${id}"` },
    },
  })
  if (already) {
    return NextResponse.json({ message: "Este cambio ya fue revertido" }, { status: 409 })
  }

  let changes: Record<string, unknown>
  try {
    changes = original.changes ? JSON.parse(original.changes) : {}
  } catch {
    return NextResponse.json(
      { message: "No se puede revertir: datos del log inválidos" },
      { status: 409 }
    )
  }

  // ---------------- DictionaryWord ----------------
  if (original.entity === "DictionaryWord") {
    // CREATE / IMPORT → borrar la ficha creada
    if (original.action === "CREATE" || original.action === "IMPORT") {
      const wordId = original.entityId
      if (!wordId) {
        return NextResponse.json({ message: "No se puede revertir: falta el id de la ficha" }, { status: 409 })
      }
      const word = await db.dictionaryWord.findUnique({ where: { id: wordId } })
      if (!word) {
        return NextResponse.json({ message: "La ficha ya no existe" }, { status: 409 })
      }

      // Limpieza best-effort de activos en R2
      const key = word.audioUrl ? audioRefToKey(word.audioUrl) : null
      if (key) {
        try { await deleteObject(key) } catch { /* best-effort */ }
      }
      if (word.illustrationUrl) {
        try { await deleteMediaAssetByUrl(word.illustrationUrl) } catch { /* best-effort */ }
      }

      // Fase A T04: revert aplicado = +1 (misma transacción que la mutación).
      await db.$transaction(async (tx) => {
        await tx.dictionaryWord.delete({ where: { id: wordId } });
        await tx.auditLog.create({
          data: {
            action: "REVERT",
            entity: "DictionaryWord",
            entityId: wordId,
            changes: JSON.stringify({ originalLogId: id, restored: "deleted", responsable: adminUser.name || adminUser.email }),
            userId: adminUser.id,
            wordId: null,
          },
        });
        await bumpContentVersion(tx);
      })

      return NextResponse.json({ ok: true, message: "Ficha eliminada (revertido)" })
    }

    // DELETE → recrear si hay snapshot completo. Sin snapshot (logs
    // históricos anteriores a la versión con snapshot) → 422 documentado
    // (spec E2), sin bump y sin mutación.
    if (original.action === "DELETE") {
      const snapshot = (changes.deleted ?? null) as Record<string, unknown> | null
      if (!snapshot || typeof snapshot.spanish !== "string" || typeof snapshot.nasaYuwe !== "string") {
        return NextResponse.json(
          { message: "No se puede revertir: el log no tiene datos suficientes (anterior a la versión con snapshot completo)" },
          { status: 422 }
        )
      }
      // Si la palabra ya existe de nuevo, no recrear
      const existing = await db.dictionaryWord.findFirst({
        where: { spanish: snapshot.spanish as string },
      })
      if (existing) {
        return NextResponse.json({ message: "Ya existe una ficha con ese español; no se recreó" }, { status: 409 })
      }

      // Reconstruir con los campos del snapshot (solo los que son columnas reales)
      const allowed = [
        "spanish", "nasaYuwe", "pronunciation", "audioUrl", "illustrationUrl",
        "culturalContext", "category", "examples", "status",
      ] as const
      const data: Record<string, unknown> = {}
      for (const f of allowed) {
        if (f in snapshot && snapshot[f] !== undefined) data[f] = snapshot[f]
      }
      if (!data.status) data.status = "DRAFT"

      const created = await db.$transaction(async (tx) => {
        const row = await tx.dictionaryWord.create({ data: data as never });

        await tx.auditLog.create({
          data: {
            action: "REVERT",
            entity: "DictionaryWord",
            entityId: row.id,
            changes: JSON.stringify({
              originalLogId: id,
              originalEntityId: original.entityId,
              restored: "recreated",
              newId: row.id,
              responsable: adminUser.name || adminUser.email,
            }),
            userId: adminUser.id,
            wordId: row.id,
          },
        });

        await bumpContentVersion(tx);
        return row;
      });

      return NextResponse.json({ ok: true, message: "Ficha recreada (revertido)", newId: created.id })
    }

    // UPDATE / PUBLISH / ARCHIVE → restaurar before
    // Validar que los `after` coincidan con el estado actual
    const wordId = original.entityId
    if (!wordId) {
      return NextResponse.json({ message: "No se puede revertir: falta el id de la ficha" }, { status: 409 })
    }
    const word = await db.dictionaryWord.findUnique({ where: { id: wordId } })
    if (!word) {
      return NextResponse.json({ message: "La ficha ya no existe" }, { status: 409 })
    }

    const fieldEntries = Object.entries(changes).filter(
      ([k, v]) => k !== "responsable" && v && typeof v === "object" && "before" in (v as object) && "after" in (v as object)
    ) as Array<[string, { before: unknown; after: unknown }]>

    if (fieldEntries.length === 0) {
      return NextResponse.json({ message: "No se puede revertir: el log no describe cambios de campos" }, { status: 409 })
    }

    // Concurrencia: estado actual debe coincidir con `after`
    for (const [field, { after }] of fieldEntries) {
      const current = (word as Record<string, unknown>)[field]
      const a = current ?? null
      const b = after ?? null
      if (a !== b) {
        return NextResponse.json(
          { message: `No se puede revertir: la ficha cambió después (campo "${field}"). Revisa antes de revertir.` },
          { status: 409 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    for (const [field, { before }] of fieldEntries) {
      updateData[field] = before
    }

    // Fase A T04: revert aplicado = +1 (misma transacción que la mutación).
    await db.$transaction(async (tx) => {
      await tx.dictionaryWord.update({ where: { id: wordId }, data: updateData });
      await tx.auditLog.create({
        data: {
          action: "REVERT",
          entity: "DictionaryWord",
          entityId: wordId,
          changes: JSON.stringify({
            originalLogId: id,
            restored: updateData,
            responsable: adminUser.name || adminUser.email,
          }),
          userId: adminUser.id,
          wordId,
        },
      });
      await bumpContentVersion(tx);
    })

    return NextResponse.json({ ok: true, message: "Cambio revertido" })
  }

  // ---------------- User ----------------
  if (original.entity === "User") {
    if (original.action !== "UPDATE") {
      return NextResponse.json({ message: "No se puede revertir esta acción sobre usuarios" }, { status: 409 })
    }
    const userId = original.entityId
    if (!userId) {
      return NextResponse.json({ message: "No se puede revertir: falta el id del usuario" }, { status: 409 })
    }
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ message: "El usuario ya no existe" }, { status: 409 })
    }

    const field = (changes as { field?: string }).field
    const from = (changes as { from?: unknown }).from
    const to = (changes as { to?: unknown }).to

    if (field !== "role" || from === undefined || to === undefined) {
      return NextResponse.json({ message: "No se puede revertir: el log no describe un cambio de rol" }, { status: 409 })
    }

    if (user.role !== to) {
      return NextResponse.json(
        { message: "No se puede revertir: el rol del usuario cambió después. Revisa antes de revertir." },
        { status: 409 }
      )
    }

    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { role: from as string } }),
      db.auditLog.create({
        data: {
          action: "REVERT",
          entity: "User",
          entityId: userId,
          changes: JSON.stringify({ originalLogId: id, restored: { role: from }, responsable: adminUser.name || adminUser.email }),
          userId: adminUser.id,
        },
      }),
    ])

    return NextResponse.json({ ok: true, message: "Rol restaurado" })
  }

  return NextResponse.json({ message: "Tipo de cambio no reversible" }, { status: 409 })
}
