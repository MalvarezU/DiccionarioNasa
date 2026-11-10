import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { validateImageUpload } from "@/lib/media/image"
import { putObject, deleteObject, publicUrl } from "@/lib/r2"

/**
 * POST /api/admin/upload-image (editor+)
 *
 * Valida la imagen por firma binaria, la sube a Cloudflare R2
 * (`images/<uuid>.<ext>`) y guarda solo los metadatos en MariaDB.
 * Devuelve la URL pública permanente para usar en bloques e ilustraciones.
 *
 * Si el insert en BD falla después del upload, el objeto se borra de R2
 * para no dejar huérfanos.
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
    const key = `images/${randomUUID()}.${check.ext}`

    try {
      await putObject(key, Buffer.from(bytes), check.mimeType)
    } catch (uploadError) {
      console.error("R2 upload error:", uploadError)
      return NextResponse.json(
        { message: "Error al subir la imagen al almacenamiento" },
        { status: 500 }
      )
    }

    let asset
    try {
      asset = await db.mediaAsset.create({
        data: {
          objectKey: key,
          filename: file.name,
          mimeType: check.mimeType,
          size: bytes.byteLength,
          uploadedBy: userId,
        },
        select: { id: true, objectKey: true, filename: true, mimeType: true, size: true },
      })
    } catch (dbError) {
      // Compensación: el binario ya está en R2 pero sin fila que lo
      // referencie; se borra para no acumular huérfanos.
      await deleteObject(key).catch((cleanupError) =>
        console.error("R2 cleanup error:", cleanupError)
      )
      throw dbError
    }

    return NextResponse.json({
      ...asset,
      url: publicUrl(key),
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
