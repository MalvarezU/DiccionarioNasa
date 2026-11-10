import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { bumpContentVersion } from "@/lib/content-version"
import { deleteMediaAssetById } from "@/lib/media/delete-asset"

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/media/[id] — redirect 302 a la URL pública R2 del asset.
 *
 * Compatibilidad: las URLs `/api/media/<id>` ya guardadas (ilustraciones y
 * portadas) siguen resolviendo; el destino real vive en Cloudflare R2.
 * El 302 es cacheable y el service worker cachea el origen R2 (ver Fase 5).
 */
export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const asset = await db.mediaAsset.findUnique({
      where: { id },
      select: { objectKey: true },
    })
    if (!asset) {
      return NextResponse.json({ message: "Imagen no encontrada" }, { status: 404 })
    }

    const base = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "")
    if (!base) {
      return NextResponse.json(
        { message: "Storage de media no configurado" },
        { status: 503 }
      )
    }

    return NextResponse.redirect(`${base}/${asset.objectKey}`, 302)
  } catch (err) {
    console.error("Media serve error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

/**
 * DELETE /api/media/[id] (editor+): borra la fila y el objeto en R2.
 * Best-effort en R2: si falla, la fila ya está borrada y `r2-prune` recoge
 * el huérfano. Responde `storageDeleted` para transparencia.
 *
 * Fase A T06: +1 tras el borrado exitoso de la fila (post-commit: el helper
 * ya hace sus propios writes; si el bump falla se registra con nivel error).
 * 404 sin bump.
 */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error

  try {
    const { id } = await params
    const result = await deleteMediaAssetById(id)
    if (!result.deleted) {
      return NextResponse.json({ message: "Imagen no encontrada" }, { status: 404 })
    }
    try {
      await bumpContentVersion(db)
    } catch (bumpError) {
      console.error("[content-version] bump post-commit fallido tras media DELETE:", bumpError)
    }
    return NextResponse.json({
      message: "Imagen eliminada",
      id,
      storageDeleted: result.storageDeleted,
    })
  } catch (err) {
    console.error("Media delete error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
