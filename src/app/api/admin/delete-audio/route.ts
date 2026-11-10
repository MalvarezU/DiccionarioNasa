import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { bumpContentVersion } from "@/lib/content-version"
import { audioRefToKey } from "@/lib/media/storage"
import { deleteObject } from "@/lib/r2"

/**
 * POST /api/admin/delete-audio { audioUrl | objectPath | objectKey }.
 *
 * Fase A T06 + §3.3: además de borrar el objeto R2, resuelve la fila
 * `MediaAsset` por `objectKey` y la elimina (la reconciliación de la APK es
 * por diff de manifiesto). Orden fila-primero igual que
 * `deleteMediaAssetById`: fila + bump en la misma transacción, R2
 * best-effort después (el huérfano lo recoge `r2-prune`).
 *
 * - Clave válida con fila → elimina fila + bump, borra objeto (best-effort).
 * - Clave válida sin fila → borra el objeto por compatibilidad + bump igual
 *   (el inventario efectivo cambió).
 * - Clave irresoluble (400) o R2 fallido sin fila previa → sin bump.
 */
export async function POST(request: Request) {
  const { error } = await requireRole("editor")
  if (error) return error

  try {
    const body = await request.json()
    // Acepta URL pública R2, URL legacy de Supabase (pública o firmada)
    // o clave directa.
    const { audioUrl, objectPath: directPath, objectKey: directKey } = body
    const rawRef =
      (typeof directKey === "string" && directKey ? directKey : null) ??
      (typeof directPath === "string" && directPath ? directPath : null) ??
      audioUrl

    if (!rawRef || typeof rawRef !== "string") {
      return NextResponse.json(
        { message: "Se requiere audioUrl u objectKey del audio" },
        { status: 400 }
      )
    }

    const key = audioRefToKey(rawRef)
    if (!key) {
      return NextResponse.json(
        { message: "No se pudo determinar la clave del audio en el storage" },
        { status: 400 }
      )
    }

    const row = await db.mediaAsset.findFirst({
      where: { objectKey: key },
      select: { id: true },
    })

    let storageDeleted = true
    if (row) {
      // Fila primero (igual que `deleteMediaAssetById`), R2 best-effort.
      await db.$transaction(async (tx) => {
        await tx.mediaAsset.delete({ where: { id: row.id } })
        await bumpContentVersion(tx)
      })
      try {
        await deleteObject(key)
      } catch (deleteError) {
        console.error("R2 delete error (huérfano, lo recoge r2-prune):", deleteError)
        storageDeleted = false
      }
    } else {
      // Sin fila: se borra el objeto por compatibilidad y el bump aplica
      // igual, ya que el inventario efectivo cambió. Si R2 falla, nada
      // cambió → 500 sin bump.
      try {
        await deleteObject(key)
      } catch (deleteError) {
        console.error("R2 delete error:", deleteError)
        return NextResponse.json(
          { message: "Error al eliminar el audio" },
          { status: 500 }
        )
      }
      await bumpContentVersion(db)
    }

    return NextResponse.json({
      message: "Audio eliminado",
      objectKey: key,
      mediaAssetDeleted: row !== null,
      storageDeleted,
    })
  } catch (error) {
    console.error("Delete audio error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
