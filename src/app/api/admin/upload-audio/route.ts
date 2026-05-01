import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

/**
 * POST /api/admin/upload-audio
 *
 * Uploads an audio file (MP3, WAV, OGG) for a dictionary word.
 * Max file size: 10 MB.
 * No auth required for now (MVP).
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { message: "No se proporcionó ningún archivo" },
        { status: 400 }
      )
    }

    // Validate file format
    const validMimeTypes = [
      "audio/mpeg",       // MP3
      "audio/wav",        // WAV
      "audio/wave",       // WAV (alternative)
      "audio/x-wav",      // WAV (alternative)
      "audio/ogg",        // OGG
      "audio/vorbis",     // OGG Vorbis
    ]
    const validExtensions = [".mp3", ".wav", ".ogg"]

    const fileExtension = path.extname(file.name).toLowerCase()

    if (!validMimeTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { message: "Formato no soportado. Usa MP3, WAV u OGG" },
        { status: 400 }
      )
    }

    if (!validExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { message: "Formato no soportado. Usa MP3, WAV u OGG" },
        { status: 400 }
      )
    }

    // Validate file size (max 10 MB)
    const MAX_SIZE = 10 * 1024 * 1024 // 10 MB in bytes
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { message: "El audio no puede superar los 10 MB" },
        { status: 400 }
      )
    }

    // Generate a unique filename to avoid collisions
    const timestamp = Date.now()
    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\s+/g, "_")
    const uniqueName = `${timestamp}-${safeName}`

    // Ensure the audio directory exists
    const audioDir = path.join(process.cwd(), "public", "audio")
    await mkdir(audioDir, { recursive: true })

    // Write the file
    const filePath = path.join(audioDir, uniqueName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    // Return the public URL path
    const audioUrl = `/audio/${uniqueName}`

    return NextResponse.json({
      audioUrl,
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
