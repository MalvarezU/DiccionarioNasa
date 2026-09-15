import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"
import { requireAdmin, requireRole } from "@/lib/auth"

const VALID_STATUS = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const

type Ctx = { params: Promise<{ id: string }> }

async function isEditor(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: string } | undefined)?.role
  return role === "editor" || role === "admin"
}

/**
 * GET /api/courses/[id] — árbol completo. Público solo PUBLISHED;
 * editor+ ve borradores (para editar).
 */
export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const course = await db.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: [{ lessonNumber: "asc" }, { id: "asc" }],
              include: {
                word: {
                  select: {
                    id: true,
                    spanish: true,
                    nasaYuwe: true,
                    pronunciation: true,
                    audioUrl: true,
                    culturalContext: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!course) {
      return NextResponse.json({ message: "Curso no encontrado" }, { status: 404 })
    }
    if (course.status !== "PUBLISHED" && !(await isEditor())) {
      return NextResponse.json({ message: "Curso no encontrado" }, { status: 404 })
    }
    return NextResponse.json({ course })
  } catch (error) {
    console.error("Course detail error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

/**
 * PATCH /api/courses/[id] — editar (editor+).
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const data: Record<string, unknown> = {}
    if (typeof body?.title === "string" && body.title.trim()) data.title = body.title.trim()
    if (body?.description !== undefined)
      data.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null
    if (typeof body?.status === "string" && (VALID_STATUS as readonly string[]).includes(body.status))
      data.status = body.status
    if (typeof body?.sequential === "boolean") data.sequential = body.sequential

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: "Nada que actualizar" }, { status: 400 })
    }

    const course = await db.course.update({ where: { id }, data })
    return NextResponse.json({ course })
  } catch (error) {
    console.error("Course update error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

/**
 * DELETE /api/courses/[id] — solo admin (cascada a módulos/lecciones/progreso).
 */
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const { id } = await params
    await db.course.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Course delete error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
