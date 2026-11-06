import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

/**
 * PATCH /api/user/profile
 * Actualiza el nombre visible del usuario autenticado.
 * Body { name }: trim, 1..100 caracteres. Devuelve { user: { id, email, name } }.
 */
export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const userId = (session!.user as { id: string }).id
    const body = await request.json().catch(() => null)
    const name = typeof body?.name === "string" ? body.name.trim() : ""

    if (!name || name.length > 100) {
      return NextResponse.json(
        { message: "El nombre debe tener entre 1 y 100 caracteres" },
        { status: 400 }
      )
    }

    const user = await db.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, email: true, name: true },
    })

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    })
  } catch (err) {
    console.error("Profile update error:", err)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
