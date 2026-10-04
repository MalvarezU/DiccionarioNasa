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
    // Solo para editor+: estadísticas de progreso (los alumnos compiten contra
    // nadie: es una vista de gobierno, no contenido).
    let stats: {
      alumnos: number
      promedioPct: number | null
      completadas: number
    } | null = null
    if (await isEditor()) {
      const lessonIds = course.modules.flatMap((m) =>
        m.lessons.map((l) => l.id)
      )
      const rows =
        lessonIds.length > 0
          ? await db.userLessonProgress.findMany({
              where: { lessonId: { in: lessonIds } },
              select: { userId: true, lessonId: true, completed: true },
            })
          : []
      // Usuarios con AL MENOS una lección completada: la promedio se mide
      // sobre ellos (sobre visitadores casual daría 0% engañoso).
      const completadasPorUsuario = new Map<string, number>()
      for (const r of rows) {
        if (r.completed) {
          completadasPorUsuario.set(
            r.userId,
            (completadasPorUsuario.get(r.userId) ?? 0) + 1
          )
        }
      }
      const usuarios = [...completadasPorUsuario.keys()]
      stats = {
        // Los que INTERACTUARON (visita o progreso), no los completadores
        alumnos: new Set(rows.map((r) => r.userId)).size,
        promedioPct:
          usuarios.length > 0 && lessonIds.length > 0
            ? Math.round(
                (usuarios.reduce((a, u) => a + (completadasPorUsuario.get(u) ?? 0), 0) /
                  (usuarios.length * lessonIds.length)) *
                  100
              )
            : null,
        completadas: rows.filter((r) => r.completed).length,
      }
    }

    return NextResponse.json({ course, stats })
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
    // Portada: SOLO URL de nuestro servidor de media (/api/media/<id>). No se
    // acepta cualquier URL — es la misma política de seguridad de los bloques
    // (javascript:/data: no pueden entrar). null/"" la quita.
    if (body?.coverImage !== undefined) {
      if (body.coverImage === null || body.coverImage === "") {
        data.coverImage = null
      } else if (typeof body.coverImage === "string" && body.coverImage.startsWith("/api/media/") && !/\s/.test(body.coverImage)) {
        data.coverImage = body.coverImage.trim()
      } else {
        return NextResponse.json(
          { message: "coverImage tiene que ser una imagen subida (/api/media/...)" },
          { status: 400 }
        )
      }
    }

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
