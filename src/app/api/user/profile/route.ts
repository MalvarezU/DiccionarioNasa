import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth"

/**
 * GET /api/user/profile
 * Devuelve el perfil del usuario autenticado. `hasPassword` indica si ya
 * tiene contraseña (para crear vs. cambiar); jamás expone el hash.
 * `onboardedAt` null = onboarding post-Google pendiente.
 */
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const userId = (session!.user as { id: string }).id
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        onboardedAt: true,
      },
    })
    if (!user) {
      return NextResponse.json(
        { message: "Usuario no encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        hasPassword: !!user.password,
        onboardedAt: user.onboardedAt?.toISOString() ?? null,
      },
    })
  } catch (err) {
    console.error("Profile fetch error:", err)
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/profile
 * Actualiza el nombre visible del usuario autenticado.
 * Body { name?, completeOnboarding? }:
 * - name: trim, 1..100 caracteres (opcional si solo se completa onboarding).
 * - completeOnboarding: true marca onboardedAt=now() (idempotente: no toca
 *   un valor ya existente). Devuelve { user: { id, email, name } }.
 */
export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const userId = (session!.user as { id: string }).id
    const body = await request.json().catch(() => null)
    const rawName = typeof body?.name === "string" ? body.name.trim() : null
    const completeOnboarding = body?.completeOnboarding === true

    if (rawName !== null && (rawName.length === 0 || rawName.length > 100)) {
      return NextResponse.json(
        { message: "El nombre debe tener entre 1 y 100 caracteres" },
        { status: 400 }
      )
    }
    if (rawName === null && !completeOnboarding) {
      return NextResponse.json(
        { message: "Nada que actualizar: envía name o completeOnboarding" },
        { status: 400 }
      )
    }

    const data: { name?: string; onboardedAt?: Date } = {}
    if (rawName !== null) data.name = rawName
    if (completeOnboarding) {
      // Idempotente: conserva un onboardedAt ya marcado.
      const current = await db.user.findUnique({
        where: { id: userId },
        select: { onboardedAt: true },
      })
      if (!current?.onboardedAt) data.onboardedAt = new Date()
    }

    const user = await db.user.update({
      where: { id: userId },
      data,
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
