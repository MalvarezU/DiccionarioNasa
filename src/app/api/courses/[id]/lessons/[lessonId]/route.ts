import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"
import { parseLessonContent } from "@/lib/courses/blocks"
import { wordIdsUsedByContent } from "@/lib/courses/word-data"

type Ctx = { params: Promise<{ id: string; lessonId: string }> }

async function isEditor(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  const role = (session?.user as { role?: string } | undefined)?.role
  return role === "editor" || role === "admin"
}

/**
 * GET /api/courses/[id]/lessons/[lessonId] — una lección on-demand.
 *
 * Responde `{ lesson, words, nav }`: el documento de bloques, las palabras
 * que referencia (resueltas server-side directo con Prisma, sin el cap de
 * 60 ids del endpoint público por query param) y los vecinos lineales
 * (cruzan módulos en orden real `order asc, lessonNumber asc`).
 *
 * Auth igual que el detalle: PUBLISHED público; DRAFT/ARCHIVED solo editor+.
 * Los locks del secuencial NO se computan acá: viven en el cliente
 * (GET progress + manifest).
 */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id, lessonId } = await params
    const course = await db.course.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        modules: {
          select: {
            id: true,
            title: true,
            order: true,
            lessons: {
              select: {
                id: true,
                title: true,
                lessonNumber: true,
                content: true,
                moduleId: true,
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

    // Orden lineal real: módulos por `order`, lecciones por
    // `lessonNumber, id` (mismo orden que el outline).
    const flat: {
      lesson: (typeof course.modules)[number]["lessons"][number]
      moduleTitle: string
      moduleIndex: number
    }[] = []
    course.modules.forEach((m, mi) => {
      for (const lesson of m.lessons) {
        flat.push({ lesson, moduleTitle: m.title, moduleIndex: mi + 1 })
      }
    })
    const index = flat.findIndex((f) => f.lesson.id === lessonId)
    if (index === -1) {
      // Id inexistente o de otro curso: mismo 404, sin distinguir.
      return NextResponse.json({ message: "Lección no encontrada" }, { status: 404 })
    }
    const current = flat[index]!
    const prev = index > 0 ? flat[index - 1]! : null
    const next = index < flat.length - 1 ? flat[index + 1]! : null

    // Palabras referenciadas por los bloques (word / vocabulary), solo
    // publicadas. Documento corrupto => sin palabras, la lección igual abre.
    const parsed = parseLessonContent(current.lesson.content)
    const wordIds = parsed.ok ? wordIdsUsedByContent(parsed.content.blocks) : []
    const words =
      wordIds.length > 0
        ? await db.dictionaryWord.findMany({
            where: { id: { in: wordIds }, status: "PUBLISHED" },
            select: {
              id: true,
              spanish: true,
              nasaYuwe: true,
              pronunciation: true,
              audioUrl: true,
              culturalContext: true,
              category: true,
            },
          })
        : []

    return NextResponse.json({
      lesson: {
        id: current.lesson.id,
        title: current.lesson.title,
        lessonNumber: current.lesson.lessonNumber,
        content: current.lesson.content,
        moduleId: current.lesson.moduleId,
      },
      words,
      nav: {
        prevId: prev?.lesson.id ?? null,
        prevTitle: prev?.lesson.title ?? null,
        prevNumber: prev?.lesson.lessonNumber ?? null,
        nextId: next?.lesson.id ?? null,
        nextTitle: next?.lesson.title ?? null,
        nextNumber: next?.lesson.lessonNumber ?? null,
        moduleTitle: current.moduleTitle,
        moduleIndex: current.moduleIndex,
      },
    })
  } catch (error) {
    console.error("Course lesson error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
