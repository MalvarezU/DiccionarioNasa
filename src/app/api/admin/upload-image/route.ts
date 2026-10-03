import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { validateImageUpload } from "@/lib/media/image"

/**
 * POST /api/admin/upload-image (editor+)
 *
 * Guarda la imagen EN POSTGRES (MediaAsset.data, bytea) y devuelve la URL
 * pública `/api/media/[id]` para usar en un bloque de imagen.
 *
 * El MIME que declara el cliente se ignora: se detecta por firma binaria.
 * Ver src/lib/media/image.ts.
 */
export async function POST(request: Request) {
  const { session, error } = await requireRole("editor")
  if (error) return error

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ message: "Cuerpo de la petición inválido" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ message: "No se proporcionó ningún archivo" }, { status: 400 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  const check = validateImageUpload({ filename: file.name, size: bytes.byteLength, bytes })
  if (!check.ok) {
    return NextResponse.json({ message: check.message }, { status: 400 })
  }

  try {
    const userId = (session!.user as { id?: string }).id ?? null
    const asset = await db.mediaAsset.create({
      data: {
        filename: file.name,
        mimeType: check.mimeType,
        size: bytes.byteLength,
        data: Buffer.from(bytes),
        uploadedBy: userId,
      },
      select: { id: true, filename: true, mimeType: true, size: true },
    })

    return NextResponse.json({
      ...asset,
      url: `/api/media/${asset.id}`,
      message: "Imagen subida correctamente",
    })
  } catch (err) {
    console.error("Image upload error:", err)
    return NextResponse.json(
      { message: "Error interno del servidor al subir la imagen" },
      { status: 500 }
    )
  }
}
