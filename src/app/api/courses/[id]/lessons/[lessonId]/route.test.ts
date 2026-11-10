import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
  requireAuth: vi.fn(),
}))

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/app/api/auth/[...nextauth]/route", () => ({
  authOptions: {},
}))

vi.mock("@/lib/db", () => ({
  db: {
    course: { findUnique: vi.fn() },
    dictionaryWord: { findMany: vi.fn() },
  },
}))

import { getServerSession } from "next-auth"
import { db } from "@/lib/db"
import { GET } from "./route"

const params = (id: string, lessonId: string) => ({
  params: Promise.resolve({ id, lessonId }),
})

const TEXT_BLOCK = { id: "bt", type: "text", html: "Hola" }

  function publishedCourse() {
  const withModule =
    (moduleId: string) =>
    <T extends Record<string, unknown>>(l: T): T & { moduleId: string } => ({ ...l, moduleId })
  return {
    id: "c1",
    title: "Curso",
    status: "PUBLISHED",
    modules: [
      {
        id: "m1",
        title: "M uno",
        order: 0,
        lessons: [
          { id: "l11", title: "Lección 1.1", lessonNumber: 1, content: { version: 2, blocks: [TEXT_BLOCK] } },
          {
            id: "l12",
            title: "Lección 1.2",
            lessonNumber: 2,
            content: {
              version: 2,
              blocks: [
                TEXT_BLOCK,
                { id: "bw", type: "word", wordId: "w1" },
                { id: "bv", type: "vocabulary", wordIds: ["w2", "w3", "w1"] },
              ],
            },
          },
        ].map(withModule("m1")),
      },
      {
        id: "m2",
        title: "M dos",
        order: 1,
        lessons: [
          { id: "l21", title: "Lección 2.1", lessonNumber: 1, content: { version: 2, blocks: [TEXT_BLOCK] } },
        ].map(withModule("m2")),
      },
    ],
  }
}

describe("GET /api/courses/[id]/lessons/[lessonId] [F3]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(null)
  })

  it("nav lineal cruza módulos + words resueltas dedup y solo PUBLISHED", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(publishedCourse() as never)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([
      { id: "w1", spanish: "casa" },
      { id: "w2", spanish: "agua" },
    ] as never)

    const res = await GET({} as never, params("c1", "l12"))
    expect(res.status).toBe(200)
    const body = await res.json()

    // l12 es la última de m1: prev = l11, next = l21 (cruza de módulo)
    expect(body.nav).toMatchObject({
      prevId: "l11",
      prevTitle: "Lección 1.1",
      prevNumber: 1,
      nextId: "l21",
      nextTitle: "Lección 2.1",
      nextNumber: 1,
      moduleTitle: "M uno",
      moduleIndex: 1,
    })
    // lesson trae content + moduleId; words viene del endpoint
    expect(body.lesson).toMatchObject({ id: "l12", moduleId: "m1" })
    expect(body.lesson.content.blocks).toHaveLength(3)

    // ids dedup (w1 x2 -> una vez) y filtro PUBLISHED en la query
    expect(vi.mocked(db.dictionaryWord.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["w1", "w2", "w3"] }, status: "PUBLISHED" },
      })
    )
    expect(body.words).toHaveLength(2)
  })

  it("primera lección no tiene prev; última no tiene next; sin words no hay query", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(publishedCourse() as never)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([] as never)

    const first = await (await GET({} as never, params("c1", "l11"))).json()
    expect(first.nav.prevId).toBeNull()
    expect(first.nav.nextId).toBe("l12")

    const last = await (await GET({} as never, params("c1", "l21"))).json()
    expect(last.nav.nextId).toBeNull()
    expect(last.nav.prevId).toBe("l12")
    // sin word refs: no consulta el diccionario
    expect(vi.mocked(db.dictionaryWord.findMany)).not.toHaveBeenCalled()
  })

  it("404 lección inexistente o de otro curso", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(publishedCourse() as never)
    expect((await GET({} as never, params("c1", "zzz"))).status).toBe(404)

    const other = publishedCourse()
    other.modules[0].lessons = other.modules[0].lessons.filter((l) => l.id !== "l11")
    vi.mocked(db.course.findUnique).mockResolvedValue(other as never)
    expect((await GET({} as never, params("c1", "l11"))).status).toBe(404)
  })

  it("DRAFT: 404 público, 200 editor+", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue({
      ...publishedCourse(),
      status: "DRAFT",
    } as never)
    expect((await GET({} as never, params("c1", "l11"))).status).toBe(404)

    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "admin" } } as never)
    expect((await GET({} as never, params("c1", "l11"))).status).toBe(200)
  })

  it("404 si el curso no existe", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(null as never)
    expect((await GET({} as never, params("nope", "l11"))).status).toBe(404)
  })
})
