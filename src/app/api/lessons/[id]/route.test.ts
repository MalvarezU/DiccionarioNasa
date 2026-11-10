import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    lesson: { findUnique: vi.fn() },
  },
}))

import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextRequest } from "next/server"
import { GET } from "./route"

function allow() {
  vi.mocked(requireRole).mockResolvedValue({
    session: { user: { id: "editor1", email: "e@b.com", role: "editor" } } as never,
    error: null,
  })
}

function deny() {
  vi.mocked(requireRole).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  } as never)
}

const mockLesson = {
  id: "l2",
  title: "Lección 2",
  lessonNumber: 2,
  order: 1,
  content: { version: 2, blocks: [] },
  module: {
    id: "m1",
    title: "Módulo 1",
    lessons: [
      { id: "l1", title: "Lección 1", order: 0 },
      { id: "l2", title: "Lección 2", order: 1 },
      { id: "l3", title: "Lección 3", order: 2 },
    ],
    course: { id: "c1", title: "Curso", status: "DRAFT" },
  },
}

describe("GET /api/lessons/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("401 sin rol editor", async () => {
    deny()
    const res = await GET(new NextRequest("http://localhost:3000/api/lessons/l2"), { params: Promise.resolve({ id: "l2" }) })
    expect(res.status).toBe(401)
  })

  it("404 si no existe", async () => {
    allow()
    vi.mocked(db.lesson.findUnique).mockResolvedValue(null)
    const res = await GET(new NextRequest("http://localhost:3000/api/lessons/l2"), { params: Promise.resolve({ id: "nope" }) })
    expect(res.status).toBe(404)
  })

  it("devuelve lección con contexto y vecinas", async () => {
    allow()
    vi.mocked(db.lesson.findUnique).mockResolvedValue(mockLesson as never)
    const res = await GET(new NextRequest("http://localhost:3000/api/lessons/l2"), { params: Promise.resolve({ id: "l2" }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.lesson.id).toBe("l2")
    expect(data.lesson.moduleTitle).toBe("Módulo 1")
    expect(data.lesson.courseId).toBe("c1")
    expect(data.lesson.prev).toEqual({ id: "l1", title: "Lección 1" })
    expect(data.lesson.next).toEqual({ id: "l3", title: "Lección 3" })
  })

  it("primera lección no tiene prev, última no tiene next", async () => {
    allow()
    vi.mocked(db.lesson.findUnique).mockResolvedValue({ ...mockLesson, id: "l1" } as never)
    const first = await (await GET(new NextRequest("http://localhost:3000/api/lessons/l2"), { params: Promise.resolve({ id: "l1" }) })).json()
    expect(first.lesson.prev).toBeNull()
    expect(first.lesson.next).toEqual({ id: "l2", title: "Lección 2" })

    vi.mocked(db.lesson.findUnique).mockResolvedValue({ ...mockLesson, id: "l3" } as never)
    const last = await (await GET(new NextRequest("http://localhost:3000/api/lessons/l2"), { params: Promise.resolve({ id: "l3" }) })).json()
    expect(last.lesson.prev).toEqual({ id: "l2", title: "Lección 2" })
    expect(last.lesson.next).toBeNull()
  })
})
