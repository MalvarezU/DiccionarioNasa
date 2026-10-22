import { db } from "@/lib/db"
import { deleteObject, publicUrl } from "@/lib/r2"
import { r2PublicBase } from "./storage"

/**
 * Borra un asset de media por ID de fila o por URL (legacy `/api/media/<id>`
 * o pública R2). Orden: fila de BD primero, objeto R2 después (best-effort).
 * Si R2 falla, queda huérfano y lo recoge `r2-prune`; nunca se bloquea al
 * llamante por eso.
 */

export type DeleteMediaResult =
  | { deleted: true; storageDeleted: boolean }
  | { deleted: false; reason: "not-found" | "external-or-empty" }

function basePrefix(): string | null {
  const base = r2PublicBase()
  return base ? `${base}/` : null
}

async function removeRowAndObject(
  row: { id: string; objectKey: string } | null
): Promise<DeleteMediaResult> {
  if (!row) return { deleted: false, reason: "not-found" }
  await db.mediaAsset.delete({ where: { id: row.id } })
  try {
    await deleteObject(row.objectKey)
    return { deleted: true, storageDeleted: true }
  } catch (err) {
    console.error("R2 delete error (huérfano, lo recoge r2-prune):", err)
    return { deleted: true, storageDeleted: false }
  }
}

export async function deleteMediaAssetById(id: string): Promise<DeleteMediaResult> {
  if (!id) return { deleted: false, reason: "external-or-empty" }
  const row = await db.mediaAsset.findUnique({
    where: { id },
    select: { id: true, objectKey: true },
  })
  return removeRowAndObject(row)
}

export async function deleteMediaAssetByUrl(
  url: string | null | undefined
): Promise<DeleteMediaResult> {
  if (!url || typeof url !== "string") return { deleted: false, reason: "external-or-empty" }

  const legacy = url.match(/^\/api\/media\/([\w-]+)\/?$/)
  if (legacy?.[1]) return deleteMediaAssetById(legacy[1])

  const prefix = basePrefix()
  if (prefix && url.startsWith(prefix)) {
    const key = url.slice(prefix.length).split("?")[0]!
    if (!key || key.includes("..")) return { deleted: false, reason: "external-or-empty" }
    const row = await db.mediaAsset.findFirst({
      where: { objectKey: key },
      select: { id: true, objectKey: true },
    })
    return removeRowAndObject(row)
  }

  return { deleted: false, reason: "external-or-empty" }
}

/** URL pública de un objectKey (para respuestas). null si R2 no configurado. */
export function mediaPublicUrl(objectKey: string): string | null {
  try {
    return publicUrl(objectKey)
  } catch {
    return null
  }
}
