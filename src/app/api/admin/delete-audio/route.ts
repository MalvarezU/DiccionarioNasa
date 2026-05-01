import { NextResponse } from "next/server"
import { unlink } from "fs/promises"
import path from "path"

/**
 * POST /api/admin/delete-audio
 *
 * Deletes an audio file from the server filesystem.
 * Expects { audioUrl: "/audio/filename.mp3" } in the body.
 * No auth required for now (MVP).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { audioUrl } = body

    if (!audioUrl || typeof audioUrl !== "string") {
      return NextResponse.json(
        { message: "Se requiere audioUrl" },
        { status: 400 }
      )
    }

    // Security: only allow deleting files from /audio/ directory
    if (!audioUrl.startsWith("/audio/")) {
      return NextResponse.json(
        { message: "Ruta de audio no válida" },
        { status: 400 }
      )
    }

    // Construct filesystem path
    const filePath = path.join(process.cwd(), "public", audioUrl)

    // Security: resolve and verify it's within public/audio
    const resolvedPath = path.resolve(filePath)
    const audioDir = path.resolve(path.join(process.cwd(), "public", "audio"))
    if (!resolvedPath.startsWith(audioDir)) {
      return NextResponse.json(
        { message: "Ruta de audio no válida" },
        { status: 400 }
      )
    }

    try {
      await unlink(resolvedPath)
      return NextResponse.json({ message: "Audio eliminado", audioUrl })
    } catch {
      // File may already be deleted — that's OK
      return NextResponse.json({ message: "Audio no encontrado (ya eliminado)", audioUrl })
    }
  } catch (error) {
    console.error("Delete audio error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
