import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getSupabaseServer, AUDIO_BUCKET, signedUrlToObjectPath } from "@/lib/supabase-server"

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const body = await request.json()
    const { audioUrl } = body

    if (!audioUrl || typeof audioUrl !== "string") {
      return NextResponse.json(
        { message: "Se requiere audioUrl (signed URL de Supabase)" },
        { status: 400 }
      )
    }

    const objectPath = signedUrlToObjectPath(audioUrl)
    if (!objectPath) {
      return NextResponse.json(
        { message: "No se pudo determinar la ruta del audio en Storage" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    const { error: deleteError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .remove([objectPath])

    if (deleteError) {
      console.error("Supabase delete error:", deleteError)
      return NextResponse.json(
        { message: "Error al eliminar el audio" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: "Audio eliminado",
      objectPath,
    })
  } catch (error) {
    console.error("Delete audio error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
