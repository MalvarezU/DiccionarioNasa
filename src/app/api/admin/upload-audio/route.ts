import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { bumpContentVersion } from "@/lib/content-version"
import { audioKey } from "@/lib/media/storage"
import { sha256Hex } from "@/lib/media/hash"
import { detectAudioMime, expectedExtensions } from "@/lib/media/audio"
import { putObject, deleteObject, publicUrl } from "@/lib/r2"

const VALID_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/vorbis",
]

const VALID_EXTENSIONS = [".mp3", ".wav", ".ogg"]

const MIME_BY_EXTENSION: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
}

export async function POST(request: Request) {
  const { session, error } = await requireRole("editor")
  if (error) return error

  const file = await extractFile(request)
  if (!file) {
    return NextResponse.json(
      { message: "No se proporcionó ningún archivo" },
      { status: 400 }
    )
  }

  const validationError = validateAudio(file, new Uint8Array(await file.arrayBuffer()))
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const key = audioKey("temp", file.name)
    const contentType = MIME_BY_EXTENSION[extensionOf(file.name)] ?? "audio/mpeg"
    // Fase A T08: hash sobre los bytes originales ANTES del putObject.
    const sha256 = sha256Hex(buffer)

    try {
      await putObject(key, buffer, contentType)
    } catch (uploadError) {      console.error("R2 upload error:", uploadError)
      return NextResponse.json(
        { message: "Error al subir el audio al servidor" },
        { status: 500 }
      )
    }

    // URL pública permanente: el bucket es público a propósito, igual que
    // antes. No usar signed URLs: expiran y romperían el reproductor,
    // favoritos, palabra del día y caché offline.
    const audioUrl = publicUrl(key)

    // Fase A T06: cerrar la brecha de inventario — toda subida crea su fila
    // MediaAsset ( Igual que upload-image). Si el insert falla, se compensa
    // borrando el objeto de R2 y no hay bump.
    try {
      await db.$transaction(async (tx) => {
        await tx.mediaAsset.create({
          data: {
            objectKey: key,
            filename: file.name,
            mimeType: contentType,
            size: file.size,
            // Fase A T08: registro de medios (spec §4.1, HASH-01).
            sha256,
            uploadedBy: (session?.user as { id?: string } | undefined)?.id ?? null,
          },
        })
        await bumpContentVersion(tx)
      })
    } catch (dbError) {
      await deleteObject(key).catch((cleanupError) =>
        console.error("R2 cleanup error:", cleanupError)
      )
      throw dbError
    }

    return NextResponse.json({
      audioUrl,
      objectKey: key,
      fileName: file.name,
      size: file.size,
      sha256,
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

function extensionOf(name: string): string {
  const dotIndex = name.lastIndexOf(".")
  return dotIndex === -1 ? "" : name.substring(dotIndex).toLowerCase()
}

function validateAudio(file: File, bytes: Uint8Array): string | null {
  const ext = extensionOf(file.name)

  // La extensión es obligatoria (el MIME lo puede falsear el cliente)
  if (!VALID_EXTENSIONS.includes(ext)) {
    return "Formato no soportado. Usa MP3, WAV u OGG"
  }

  // El MIME debe acompañar, salvo genéricos que envían algunos navegadores
  const GENERIC_MIMES = ["", "application/octet-stream"]
  if (!VALID_MIME_TYPES.includes(file.type) && !GENERIC_MIMES.includes(file.type)) {
    return "Formato no soportado. Usa MP3, WAV u OGG"
  }

  if (file.size > 10 * 1024 * 1024) {
    return "El audio no puede superar los 10 MB"
  }

  // La firma binaria manda: el contenido debe ser audio real y la
  // extensión debe coincidir con el formato detectado.
  const detected = detectAudioMime(bytes)
  if (detected === null) {
    return "El archivo no es un audio válido"
  }
  if (!expectedExtensions(detected).includes(ext)) {
    return `La extensión ${ext} no coincide con el contenido real del audio`
  }

  return null
}
