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
    course: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    module: { count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    lesson: { count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    dictionaryWord: { findFirst: vi.fn() },
    userLessonProgress: { upsert: vi.fn(), findMany: vi.fn() },
  },
}))

import { getServerSession } from "next-auth"
import { requireAdmin, requireRole, requireAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET as listGET, POST as coursesPOST } from "./route"
import { urlRequest } from "@/test/factories/request"
import { GET as detailGET, PATCH as coursePATCH, DELETE as courseDELETE } from "./[id]/route"
import { POST as modulesPOST } from "../modules/route"
import { PATCH as modulePATCH } from "../modules/[id]/route"
import { POST as lessonsPOST } from "../modules/[id]/lessons/route"
import { PATCH as lessonPATCH } from "../lessons/[id]/route"
import { POST as reorderPOST } from "./[id]/reorder/route"
import { POST as progressPOST } from "../progress/route"
import { GET as progressGET } from "./[id]/progress/route"

const editorSession = { user: { id: "e1", role: "editor" } } as never
const params = (id: string) => ({ params: Promise.resolve({ id }) })

function jsonReq(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function allowEditor() {
  vi.mocked(requireRole).mockResolvedValue({ session: editorSession, error: null })
  vi.mocked(requireAdmin).mockResolvedValue({ session: editorSession, error: null })
}

describe("cursos API [B2.2]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("lista solo publicados con conteos", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(db.course.findMany).mockResolvedValue([
      { id: "c1", title: "T", description: null, modules: [{ lessons: [{ id: "l1" }] }] },
    ] as never)
    const res = await listGET(urlRequest("http://x/api/courses") as never)
    const body = await res.json()
    expect(body.courses[0]).toMatchObject({ id: "c1", modules: 1, lessons: 1, progressPct: null })
    expect(vi.mocked(db.course.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PUBLISHED" } })
    )
  })

  it("?all=1 con rol editor lista borradores", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "editor" } } as never)
    vi.mocked(db.course.findMany).mockResolvedValue([] as never)
    await listGET(urlRequest("http://x/api/courses?all=1") as never)
    expect(vi.mocked(db.course.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
  })

  it("crear exige título y defaultea DRAFT+secuencial", async () => {
    allowEditor()
    vi.mocked(db.course.create).mockResolvedValue({ id: "c1" } as never)
    const bad = await coursesPOST(jsonReq("http://x/api/courses", {}) as never)
    expect(bad.status).toBe(400)
    const ok = await coursesPOST(jsonReq("http://x/api/courses", { title: "T" }) as never)
    expect(ok.status).toBe(201)
    expect(db.course.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DRAFT", sequential: true }) })
    )
  })

  it("detalle oculta borrador al público y lo muestra al editor", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(db.course.findUnique).mockResolvedValue({ id: "c1", status: "DRAFT" } as never)
    expect((await detailGET({} as never, params("c1"))).status).toBe(404)

    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "editor" } } as never)
    vi.mocked(db.course.findUnique).mockResolvedValue({ id: "c1", status: "DRAFT" } as never)
    expect((await detailGET({} as never, params("c1"))).status).toBe(200)
  })

  it("PATCH valida y DELETE exige admin", async () => {
    allowEditor()
    vi.mocked(db.course.update).mockResolvedValue({ id: "c1" } as never)
    const empty = await coursePATCH(jsonReq("http://x", {}) as never, params("c1"))
    expect(empty.status).toBe(400)
    const ok = await coursePATCH(jsonReq("http://x", { status: "PUBLISHED" }) as never, params("c1"))
    expect(ok.status).toBe(200)

    vi.mocked(requireAdmin).mockResolvedValue({
      session: null,
      error: Response.json({}, { status: 403 }),
    })
    const del = await courseDELETE({} as never, params("c1"))
    expect(del.status).toBe(403)
    expect(db.course.delete).not.toHaveBeenCalled()
  })

  it("módulos y lecciones CRUD con palabra resuelta", async () => {
    allowEditor()
    vi.mocked(db.module.count).mockResolvedValue(2)
    vi.mocked(db.module.create).mockResolvedValue({ id: "m1" } as never)
    const mod = await modulesPOST(jsonReq("http://x/api/modules", { courseId: "c1", title: "M" }) as never)
    expect(mod.status).toBe(201)

    vi.mocked(db.module.findUnique).mockResolvedValue({ id: "m1" } as never)
    vi.mocked(db.lesson.count).mockResolvedValue(0)
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue({ id: "w1" } as never)
    vi.mocked(db.lesson.create).mockResolvedValue({ id: "l1" } as never)
    const les = await lessonsPOST(
      jsonReq("http://x", { title: "L", type: "READ", wordSpanish: "Casa" }) as never,
      params("m1")
    )
    expect(les.status).toBe(201)
    expect(db.lesson.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ wordId: "w1", type: "READ" }) })
    )

    vi.mocked(db.lesson.update).mockResolvedValue({ id: "l1" } as never)
    const upd = await lessonPATCH(jsonReq("http://x", { title: "L2" }) as never, params("l1"))
    expect(upd.status).toBe(200)

    vi.mocked(db.module.update).mockResolvedValue({ id: "m1" } as never)
    const mord = await modulePATCH(jsonReq("http://x", { order: 3 }) as never, params("m1"))
    expect(mord.status).toBe(200)
  })

  it("reorder solo toca lo propio del curso", async () => {
    allowEditor()
    vi.mocked(db.course.findUnique).mockResolvedValue({ id: "c1" } as never)
    vi.mocked(db.module.findMany).mockResolvedValue([{ id: "m1" }] as never)
    vi.mocked(db.module.update).mockResolvedValue({} as never)
    vi.mocked(db.module.findFirst).mockResolvedValue({ id: "m1" } as never)
    vi.mocked(db.lesson.findMany).mockResolvedValue([] as never)
    ;(db as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction = vi
      .fn()
      .mockResolvedValue([])
    const res = await reorderPOST(
      jsonReq("http://x", { modules: ["m1", "mX"], lessons: {} }) as never,
      params("c1")
    )
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.updated).toBe(1)
    expect(db.module.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m1" } })
    )
  })

  it("progreso: upsert + % por curso", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: {
        user: { id: "u1", role: "user" },
        expires: "2099-01-01T00:00:00Z",
      },
      error: null,
    })
    vi.mocked(db.lesson.findUnique).mockResolvedValue({ id: "l1" } as never)
    vi.mocked(db.userLessonProgress.upsert).mockResolvedValue({ id: "p1" } as never)
    const post = await progressPOST(
      jsonReq("http://x/api/progress", { lessonId: "l1", completed: true }) as never
    )
    expect(post.status).toBe(200)
    expect(db.userLessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_lessonId: { userId: "u1", lessonId: "l1" } },
      })
    )

    vi.mocked(db.course.findUnique).mockResolvedValue({
      id: "c1",
      modules: [{ id: "m1", lessons: [{ id: "l1" }, { id: "l2" }] }],
    } as never)
    vi.mocked(db.userLessonProgress.findMany).mockResolvedValue([
      { lessonId: "l1", completed: true, lastVisitedAt: new Date() },
    ] as never)
    const get = await progressGET({} as never, params("c1"))
    const body = await get.json()
    expect(body.pct).toBe(50)
    expect(body.completedIds).toEqual(["l1"])
    expect(body.lastVisitedLessonId).toBe("l1")
  })
})
