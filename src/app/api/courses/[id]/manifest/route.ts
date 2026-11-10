import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"
import { isInteractive, parseLessonContent } from "@/lib/courses/blocks"

type Ctx = { params: Promise<{ id: string }> }

async function isEditor(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: string } | undefined)?.role
  return role === "editor" || role === "admin"
}

/**
 * Cuenta los bloques que exigen interacción (quiz, escucha) del documento
 * de una lección. Un documento corrupto cuenta 0 en vez de romper el
 * manifest: es un número decorativo del índice, no un gate.
 */
function countInteractive(content: unknown): number {
  const parsed = parseLessonContent(content)
  if (parsed.ok) return parsed.content.blocks.filter(isInteractive).length
  if (
    typeof content === "object" &&
    content !== null &&
    Array.isArray((content as { blocks?: unknown }).blocks)
  ) {
    return (content as { blocks: unknown[] }).blocks.filter(
      (b) =>
        typeof b === "object" &&
        b !== null &&
        ((b as { type?: unknown }).type === "quiz" ||
          (b as { type?: unknown }).type === "listening")
    ).length
  }
  return 0
}

/**
 * GET /api/courses/[id]/manifest — árbol ligero para el outline del player.
 *
 * Trae el contenido de cada lección SOLO para computar `interactiveCount`
 * en el servidor y lo recorta antes de responder: el payload nunca incluye
 * la clave `content` (el contenido viaja on-demand por
 * `GET /api/courses/[id]/lessons/[lessonId]`).
 *
 * Auth igual que el detalle: PUBLISHED público; DRAFT/ARCHIVED solo editor+.
 */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const course = await db.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        sequential: true,
        modules: {
          // Fase A T07: el manifest excluye borrados lógicos.
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            order: true,
            lessons: {
              where: { deletedAt: null },
              select: {
                id: true,
                title: true,
                lessonNumber: true,
                content: true,
              },
              orderBy: [{ lessonNumber: "asc" }, { id: "asc" }],
            },
          },
          orderBy: { order: "asc" },
        },
      },
    })
    if (!course) {
      return NextResponse.json({ message: "Curso no encontrado" }, { status: 404 })
    }
    if (course.status !== "PUBLISHED" && !(await isEditor())) {
      return NextResponse.json({ message: "Curso no encontrado" }, { status: 404 })
    }

    return NextResponse.json({
      courseId: course.id,
      title: course.title,
      description: course.description,
      sequential: course.sequential,
      modules: course.modules.map((m) => ({
        id: m.id,
        title: m.title,
        order: m.order,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          lessonNumber: l.lessonNumber,
          title: l.title,
          interactiveCount: countInteractive(l.content),
        })),
      })),
    })
  } catch (error) {
    console.error("Course manifest error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
