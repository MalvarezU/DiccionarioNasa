import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"
import { parseLessonContent } from "@/lib/courses/blocks"
import { sanitizeLessonContent } from "@/lib/courses/text-sanitizer"
import { bumpContentVersion } from "@/lib/content-version"

type Ctx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/lessons/[id] { title?, order? } (editor+)
 * - Si cambia `title`, valida dedupe por módulo.
 * - Re-numerar al reordenar va por `/api/courses/[id]/reorder`.
 * - El contenido va por PUT con documento de bloques.
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (typeof body.title === "string" && body.title.trim()) {
      const title = body.title.trim()
      const current = await db.lesson.findUnique({
        where: { id },
        select: { moduleId: true },
      })
      if (!current) {
        return NextResponse.json({ message: "Lección no encontrada" }, { status: 404 })
      }
      const dupe = await db.lesson.findFirst({
        where: {
          moduleId: current.moduleId,
          title: { equals: title },
          NOT: { id },
        },
        select: { id: true },
      })
      if (dupe) {
        return NextResponse.json(
          { message: `Ya existe otra lección con el título "${title}" en este módulo` },
          { status: 409 }
        )
      }
      data.title = title
    }
    if (Number.isInteger(body.order) && (body.order as number) >= 0) data.order = body.order

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: "Nada que actualizar" }, { status: 400 })
    }
    // Fase A T05: mutación + bump en la misma transacción (una operación = +1).
    const lesson = await db.$transaction(async (tx) => {
      const updated = await tx.lesson.update({ where: { id }, data })
      await bumpContentVersion(tx)
      return updated
    })
    return NextResponse.json({ lesson })
  } catch (err) {
    console.error("Lesson update error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

/**
 * PUT /api/lessons/[id] { title?, content? } (editor+)
 *
 * Guarda la lección completa: título y documento de bloques. Es el endpoint
 * que usa el editor de contenido.
 *
 * - `content` se valida con el contrato de src/lib/courses/blocks.ts. Un
 *   documento inválido NO se guarda y se devuelven todas las rutas con error.
 * - `content` no puede ser null: vaciar una lección es mandar `blocks: []`.
 * - El dedupe de título por módulo se mantiene igual que en PATCH.
 */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const errors: string[] = []
    const data: Record<string, unknown> = {}

    const current = await db.lesson.findUnique({
      where: { id },
      select: { moduleId: true },
    })
    if (!current) {
      return NextResponse.json({ message: "Lección no encontrada" }, { status: 404 })
    }

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        errors.push("title: no puede estar vacío")
      } else {
        const title = body.title.trim()
        const dupe = await db.lesson.findFirst({
          where: {
            moduleId: current.moduleId,
            title: { equals: title },
            NOT: { id },
          },
          select: { id: true },
        })
        if (dupe) {
          errors.push(`Ya existe otra lección con el título "${title}" en este módulo`)
        } else {
          data.title = title
        }
      }
    }

    if (body.content !== undefined) {
      if (body.content === null) {
        errors.push("content: no puede ser null; para vaciar la lección usá blocks: []")
      } else {
        const parsed = parseLessonContent(body.content)
        if (parsed.ok) {
          // Sanitización server-side: el HTML guardado es inofensivo por construcción.
          data.content = sanitizeLessonContent(parsed.content as any)
        } else {
          errors.push(...parsed.errors)
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { message: errors[0], errors },
        { status: 400 }
      )
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: "Nada que actualizar" }, { status: 400 })
    }

    // Fase A T05: mutación + bump en la misma transacción (una operación = +1).
    const lesson = await db.$transaction(async (tx) => {
      const updated = await tx.lesson.update({ where: { id }, data })
      await bumpContentVersion(tx)
      return updated
    })
    return NextResponse.json({ lesson })
  } catch (err) {
    console.error("Lesson content update error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

/**
 * DELETE /api/lessons/[id] — borrado LÓGICO (Fase A T07, decisión D3).
 *
 * Reemplazo lateral: `deletedAt = now()` + bump en la misma transacción, con
 * `AuditLog` DELETE para reversibilidad. Respuesta sin cambios
 * ({ success: true }). No borra fichas (editor+: lección suelta).
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { session, error } = await requireRole("editor")
  if (error) return error
  try {
    const { id } = await params
    await db.$transaction(async (tx) => {
      await tx.lesson.update({ where: { id }, data: { deletedAt: new Date() } })
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "Lesson",
          entityId: id,
          userId: (session?.user as { id?: string } | undefined)?.id,
        },
      })
      await bumpContentVersion(tx)
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Lesson delete error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

/**
 * GET /api/lessons/[id] (editor+)
 *
 * Una lección con su contexto para la página del editor:
 * título, documento de bloques, módulo, curso y lecciones vecinas
 * (anterior/siguiente por `order` dentro del módulo).
 */
export async function GET(_request: NextRequest, { params }: Ctx) {
  const { error } = await requireRole("editor")
  if (error) return error
  try {
    const { id } = await params
    const lesson = await db.lesson.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        lessonNumber: true,
        order: true,
        content: true,
        module: {
          select: {
            id: true,
            title: true,
            lessons: {
              select: { id: true, title: true, order: true },
              orderBy: { order: "asc" },
            },
            course: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
    })
    if (!lesson) {
      return NextResponse.json({ message: "Lección no encontrada" }, { status: 404 })
    }

    const siblings = lesson.module.lessons
    const idx = siblings.findIndex((l) => l.id === id)
    const prev = idx > 0 ? siblings[idx - 1] : null
    const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        lessonNumber: lesson.lessonNumber,
        content: lesson.content,
        moduleId: lesson.module.id,
        moduleTitle: lesson.module.title,
        courseId: lesson.module.course.id,
        courseTitle: lesson.module.course.title,
        courseStatus: lesson.module.course.status,
        prev: prev ? { id: prev.id, title: prev.title } : null,
        next: next ? { id: next.id, title: next.title } : null,
      },
    })
  } catch (err) {
    console.error("Lesson get error:", err)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
