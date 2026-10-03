import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/media/[id] — sirve una imagen guardada en Postgres.
 *
 * Es pública a propósito: las imágenes de curso las ve cualquier visitante.
 * El contenido es inmutable (un id, un contenido), así que se cachea para
 * siempre. Al ser del MISMO ORIGEN que la app, el service worker del PWA sí
 * puede cachearla para uso sin conexión (a diferencia de Supabase Storage).
 */
export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const asset = await db.mediaAsset.findUnique({
      where: { id },
      select: { data: true, mimeType: true, size: true },
    })
    if (!asset) {
      return NextResponse.json({ message: "Imagen no encontrada" }, { status: 404 })
    }

    const body = new Uint8Array(asset.data)

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.size),
        // Inmutable: el id identifica un contenido que nunca cambia.
        "Cache-Control": "public, max-age=31536000, immutable",
        // Solo se guardan imágenes raster validadas por firma; aun así,
        // nosniff evita que el navegador reinterprete el contenido.
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    })
  } catch (err) {
    console.error("Media serve error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
