import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth"
import { audioRefToKey } from "@/lib/media/storage"
import { deleteObject } from "@/lib/r2"

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

    try {
      await deleteObject(key)
    } catch (deleteError) {
      console.error("R2 delete error:", deleteError)
      return NextResponse.json(
        { message: "Error al eliminar el audio" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: "Audio eliminado",
      objectKey: key,
    })
  } catch (error) {
    console.error("Delete audio error:", error)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
