import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getSupabaseServer, AUDIO_BUCKET, audioObjectPath } from "@/lib/supabase-server"

const VALID_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/vorbis",
]

const VALID_EXTENSIONS = [".mp3", ".wav", ".ogg"]

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const file = await extractFile(request)
  if (!file) {
    return NextResponse.json(
      { message: "No se proporcionó ningún archivo" },
      { status: 400 }
    )
  }

  const validationError = validateAudio(file)
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 })
  }

  try {
    const supabase = getSupabaseServer()
    const buffer = Buffer.from(await file.arrayBuffer())
    const objectPath = audioObjectPath("temp", file.name)

    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(objectPath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      console.error("Supabase upload error:", uploadError)
      return NextResponse.json(
        { message: "Error al subir el audio al servidor" },
        { status: 500 }
      )
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(objectPath, 3600)

    if (signedUrlError || !signedUrlData) {
      console.error("Signed URL error:", signedUrlError)
      return NextResponse.json(
        { message: "Error al generar el enlace del audio" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      audioUrl: signedUrlData.signedUrl,
      objectPath,
      fileName: file.name,
      size: file.size,
      message: "Audio subido correctamente",
    })
  } catch (error) {
    console.error("Audio upload error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor al subir el audio" },
      { status: 500 }
    )
  }
}

async function extractFile(request: Request): Promise<File | null> {
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    if (!file || !(file instanceof File)) return null
    return file as File
  } catch {
    return null
  }
}

function validateAudio(file: File): string | null {
  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()

  if (!VALID_MIME_TYPES.includes(file.type) && !VALID_EXTENSIONS.includes(ext)) {
    return "Formato no soportado. Usa MP3, WAV u OGG"
  }

  if (!VALID_EXTENSIONS.includes(ext)) {
    return "Formato no soportado. Usa MP3, WAV u OGG"
  }

  if (file.size > 10 * 1024 * 1024) {
    return "El audio no puede superar los 10 MB"
  }

  return null
}
