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

const params = (id: string) => ({ params: Promise.resolve({ id }) })

const QUIZ_BLOCK = {
  id: "bq",
  type: "quiz",
  questions: [{ prompt: "P?", options: [{ text: "a", correct: true }, { text: "b", correct: false }] }],
  passScore: 70,
}
const TEXT_BLOCK = { id: "bt", type: "text", html: "Hola" }
const LISTENING_BLOCK = {
  id: "bl",
  type: "listening",
  media: { source: "upload", url: "https://x.com/a.mp3" },
  question: "Q?",
  options: [{ text: "a", correct: true }, { text: "b", correct: false }],
}

function publishedCourse() {
  return {
    id: "c1",
    title: "Curso",
    description: "Desc",
    status: "PUBLISHED",
    sequential: true,
    modules: [
      {
        id: "m1",
        title: "M uno",
        order: 0,
        lessons: [
          {
            id: "l11",
            title: "Lección 1.1",
            lessonNumber: 1,
            content: { version: 2, blocks: [TEXT_BLOCK, QUIZ_BLOCK] },
          },
          {
            id: "l12",
            title: "Lección 1.2",
            lessonNumber: 2,
            content: { version: 2, blocks: [TEXT_BLOCK, LISTENING_BLOCK, QUIZ_BLOCK] },
          },
        ],
      },
      {
        id: "m2",
        title: "M dos",
        order: 1,
        lessons: [
          {
            id: "l21",
            title: "Lección 2.1",
            lessonNumber: 1,
            content: { version: 2, blocks: [TEXT_BLOCK] },
          },
        ],
      },
    ],
  }
}

describe("GET /api/courses/[id]/manifest [F3]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue(null)
  })

  it("PUBLISHED público: árbol ligero sin `content` e interactiveCount correcto", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(publishedCourse() as never)

    const res = await GET({} as never, params("c1"))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toMatchObject({
      courseId: "c1",
      title: "Curso",
      sequential: true,
    })
    expect(body.modules).toHaveLength(2)
    // interactiveCount: l11 = 1 quiz, l12 = quiz + listening, l21 = 0
    expect(body.modules[0].lessons[0]).toEqual({
      id: "l11",
      lessonNumber: 1,
      title: "Lección 1.1",
      interactiveCount: 1,
    })
    expect(body.modules[0].lessons[1].interactiveCount).toBe(2)
    expect(body.modules[1].lessons[0].interactiveCount).toBe(0)

    // Payload ligero: ninguna clave `content` en ningún nivel
    const raw = JSON.stringify(body)
    expect(raw).not.toContain('"content"')
    expect(raw.length).toBeLessThan(JSON.stringify(publishedCourse()).length)
  })

  it("DRAFT/ARCHIVED: 404 público, 200 para editor+", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue({
      ...publishedCourse(),
      status: "DRAFT",
      modules: [],
    } as never)
    const pub = await GET({} as never, params("c1"))
    expect(pub.status).toBe(404)
    expect((await pub.json()).message).toBe("Curso no encontrado")

    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "editor" } } as never)
    const ed = await GET({} as never, params("c1"))
    expect(ed.status).toBe(200)

    vi.mocked(db.course.findUnique).mockResolvedValue({
      ...publishedCourse(),
      status: "ARCHIVED",
      modules: [],
    } as never)
    vi.mocked(getServerSession).mockResolvedValue(null)
    expect((await GET({} as never, params("c1"))).status).toBe(404)
  })

  it("404 si el curso no existe", async () => {
    vi.mocked(db.course.findUnique).mockResolvedValue(null as never)
    const res = await GET({} as never, params("nope"))
    expect(res.status).toBe(404)
    expect((await res.json()).message).toBe("Curso no encontrado")
  })

  it("lessonNumber null (legacy) pasa tal cual sin romper el manifest", async () => {
    const legacy = publishedCourse()
    ;(legacy.modules[0].lessons[0] as { lessonNumber: number | null }).lessonNumber = null
    vi.mocked(db.course.findUnique).mockResolvedValue(legacy as never)
    const res = await GET({} as never, params("c1"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.modules[0].lessons[0].lessonNumber).toBeNull()
    expect(JSON.stringify(body)).not.toMatch(/"lessonNumber":"/)
  })
})
