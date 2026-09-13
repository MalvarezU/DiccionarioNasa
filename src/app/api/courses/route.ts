import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { db } from "@/lib/db"
import { requireRole } from "@/lib/auth"

const VALID_STATUS = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const

/**
 * GET /api/courses — cursos publicados con conteos (+mi % si hay sesión).
 * Con ?all=1 y rol editor+: todos los estados (gestión).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as { role?: string } | undefined)?.role
    const userId = (session?.user as { id?: string } | undefined)?.id ?? null

    const showAll =
      request.nextUrl.searchParams.get("all") === "1" &&
      (role === "editor" || role === "admin")

    const courses = await db.course.findMany({
      where: showAll ? {} : { status: "PUBLISHED" },
      orderBy: { createdAt: "asc" },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: { orderBy: { order: "asc" }, select: { id: true } },
          },
        },
      },
    })

    let progressByCourse: Record<string, number> = {}
    if (userId && courses.length > 0) {
      const allLessonIds = courses.flatMap((c) =>
        c.modules.flatMap((m) => m.lessons.map((l) => l.id))
      )
      const done = allLessonIds.length
        ? await db.userLessonProgress.findMany({
            where: { userId, lessonId: { in: allLessonIds }, completed: true },
            select: { lessonId: true },
          })
        : []
      const doneSet = new Set(done.map((d) => d.lessonId))
      for (const c of courses) {
        const ids = c.modules.flatMap((m) => m.lessons.map((l) => l.id))
        const hit = ids.filter((id) => doneSet.has(id)).length
        progressByCourse[c.id] = ids.length > 0 ? Math.round((hit / ids.length) * 100) : 0
      }
    }

    return NextResponse.json({
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        status: c.status,
        modules: c.modules.length,
        lessons: c.modules.reduce((a, m) => a + m.lessons.length, 0),
        progressPct: progressByCourse[c.id] ?? null,
      })),
    })
  } catch (error) {
    console.error("Courses list error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

/**
 * POST /api/courses — crear curso (editor+).
 */
export async function POST(request: NextRequest) {
  const { error } = await requireRole("editor")
  if (error) return error

  try {
    const body = await request.json().catch(() => null)
    const title = typeof body?.title === "string" ? body.title.trim() : ""
    if (!title) {
      return NextResponse.json({ message: "El título es obligatorio" }, { status: 400 })
    }
    const status =
      typeof body?.status === "string" && (VALID_STATUS as readonly string[]).includes(body.status)
        ? body.status
        : "DRAFT"
    const sequential = body?.sequential === undefined ? true : body.sequential === true

    const course = await db.course.create({
      data: {
        title,
        description: typeof body?.description === "string" ? body.description.trim() || null : null,
        status,
        sequential,
      },
    })
    return NextResponse.json({ course }, { status: 201 })
  } catch (error) {
    console.error("Course create error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
