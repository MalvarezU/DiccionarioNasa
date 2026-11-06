import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    course: { findMany: vi.fn() },
  },
}))

import { requireAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET } from "./route"

const session = { user: { id: "u1" } }
const authed = { session: session as never, error: null }
const unauthed = {
  session: null,
  error: Response.json({ message: "Debes iniciar sesión" }, { status: 401 }),
}

type ProgressRow = { completed: boolean; lastVisitedAt: Date }

function lesson(id: string, title: string, rows: ProgressRow[] = []) {
  return { id, title, progress: rows }
}

function courseRow(
  id: string,
  visitedAt: string,
  opts: {
    title?: string
    coverImage?: string | null
    total?: number
    completed?: number
  } = {}
) {
  const total = opts.total ?? 4
  const completed = opts.completed ?? 1
  const lessons = Array.from({ length: total }, (_, i) =>
    lesson(
      `${id}-l${i + 1}`,
      `Lección ${i + 1}`,
      i < completed
        ? [{ completed: true, lastVisitedAt: new Date(visitedAt) }]
        : i === completed
          ? [{ completed: false, lastVisitedAt: new Date(visitedAt) }]
          : []
    )
  )
  return {
    id,
    title: opts.title ?? `Curso ${id}`,
    coverImage: opts.coverImage ?? null,
    modules: [{ lessons }],
  }
}

describe("GET /api/user/course-progress", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAuth).mockResolvedValue(authed)
  })

  it("rechaza sin sesión con 401 y no consulta la base", async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauthed as never)

    const res = await GET()

    expect(res.status).toBe(401)
    expect(db.course.findMany).not.toHaveBeenCalled()
  })

  it("devuelve el shape por curso con % calculado", async () => {
    vi.mocked(db.course.findMany).mockResolvedValue([
      courseRow("c1", "2026-03-01T10:00:00.000Z", {
        title: "Nasa Yuwe Básico",
        coverImage: "https://cdn.test/c1.jpg",
        total: 4,
        completed: 1,
      }),
    ] as never)

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      courses: [
        {
          courseId: "c1",
          title: "Nasa Yuwe Básico",
          coverImage: "https://cdn.test/c1.jpg",
          lessonsTotal: 4,
          lessonsCompleted: 1,
          percent: 25,
          lastVisitedAt: "2026-03-01T10:00:00.000Z",
          lastLessonId: "c1-l1",
          lastLessonTitle: "Lección 1",
        },
      ],
    })
  })

  it("solo pide cursos con progreso del usuario (curso sin progreso no aparece)", async () => {
    vi.mocked(db.course.findMany).mockResolvedValue([] as never)

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ courses: [] })
    expect(db.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          modules: {
            some: {
              lessons: { some: { progress: { some: { userId: "u1" } } } },
            },
          },
        },
      })
    )
  })

  it("ordena por lastVisitedAt desc", async () => {
    vi.mocked(db.course.findMany).mockResolvedValue([
      courseRow("viejo", "2026-01-01T00:00:00.000Z"),
      courseRow("nuevo", "2026-05-01T00:00:00.000Z"),
    ] as never)

    const res = await GET()
    const body = await res.json()

    expect(body.courses.map((c: { courseId: string }) => c.courseId)).toEqual([
      "nuevo",
      "viejo",
    ])
  })

  it("respeta el límite de 50 cursos quedándose con los más recientes", async () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      courseRow(
        `c${i}`,
        new Date(Date.UTC(2026, 0, i + 1)).toISOString()
      )
    )
    vi.mocked(db.course.findMany).mockResolvedValue(rows as never)

    const res = await GET()
    const body = await res.json()

    expect(body.courses).toHaveLength(50)
    // El más reciente (día 60) queda primero; el más viejo (día 1) queda fuera.
    expect(body.courses[0].courseId).toBe("c59")
    expect(
      body.courses.some((c: { courseId: string }) => c.courseId === "c0")
    ).toBe(false)
  })

  it("devuelve 500 si falla la base", async () => {
    vi.mocked(db.course.findMany).mockRejectedValue(new Error("DB caída"))

    const res = await GET()

    expect(res.status).toBe(500)
  })
})
