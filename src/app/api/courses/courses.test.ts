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

vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
    course: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    module: { count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    lesson: { count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    dictionaryWord: { findFirst: vi.fn() },
    userLessonProgress: { upsert: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  }
  // Los handlers usan `db.$transaction(async (tx) => ...)`: el mock ejecuta
  // el callback con el propio db mockeado como `tx`.
  db.$transaction = vi.fn(async (fn: unknown) =>
    typeof fn === "function" ? (fn as (tx: unknown) => unknown)(db) : fn
  )
  return { db }
})

vi.mock("@/lib/content-version", () => ({
  bumpContentVersion: vi.fn(),
  getContentVersion: vi.fn(),
}))

import { getServerSession } from "next-auth"
import { requireAdmin, requireRole, requireAuth } from "@/lib/auth"
import { db } from "@/lib/db"
import { bumpContentVersion } from "@/lib/content-version"
import { GET as listGET, POST as coursesPOST } from "./route"
import { urlRequest } from "@/test/factories/request"
import { GET as detailGET, PATCH as coursePATCH, DELETE as courseDELETE } from "./[id]/route"
import { POST as modulesPOST } from "../modules/route"
import { PATCH as modulePATCH } from "../modules/[id]/route"
import { POST as lessonsPOST } from "../modules/[id]/lessons/route"
import { PATCH as lessonPATCH, PUT as lessonPUT } from "../lessons/[id]/route"
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

  it("crear exige título y defaultea DRAFT+secuencial con bump", async () => {
    allowEditor()
    vi.mocked(db.course.create).mockResolvedValue({ id: "c1" } as never)
    const bad = await coursesPOST(jsonReq("http://x/api/courses", {}) as never)
    expect(bad.status).toBe(400)
    expect(bumpContentVersion).not.toHaveBeenCalled()
    const ok = await coursesPOST(jsonReq("http://x/api/courses", { title: "T" }) as never)
    expect(ok.status).toBe(201)
    expect(db.course.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "DRAFT", sequential: true }) })
    )
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
  })

  it("detalle oculta borrador al público y lo muestra al editor", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(db.course.findUnique).mockResolvedValue({ id: "c1", status: "DRAFT", modules: [] } as never)
    expect((await detailGET({} as never, params("c1"))).status).toBe(404)

    vi.mocked(getServerSession).mockResolvedValue({ user: { role: "editor" } } as never)
    vi.mocked(db.course.findUnique).mockResolvedValue({ id: "c1", status: "DRAFT", modules: [] } as never)
    vi.mocked(db.userLessonProgress.findMany).mockResolvedValue([] as never)
    expect((await detailGET({} as never, params("c1"))).status).toBe(200)
  })

  it("detalle con stats de progreso (solo editor+)", async () => {
    allowEditor()
    vi.mocked(db.course.findUnique).mockResolvedValue({
      id: "c1",
      status: "PUBLISHED",
      modules: [
        { id: "m1", lessons: [{ id: "l1" }, { id: "l2" }] },
      ],
    } as never)
    // Dos usuarios: u1 completó ambas, u2 solo una (pero visitó dos).
    vi.mocked(db.userLessonProgress.findMany).mockResolvedValue([
      { userId: "u1", lessonId: "l1", completed: true },
      { userId: "u1", lessonId: "l2", completed: true },
      { userId: "u2", lessonId: "l1", completed: true },
      { userId: "u2", lessonId: "l2", completed: false },
    ] as never)

    const res = await detailGET({} as never, params("c1"))
    const body = await res.json()
    // alumnos = los que interactuaron (2); completadas = 3 en total;
    // promedio solo entre quienes completaron ALGO:
    //   u1: 2/2, u2: 1/2 -> (2+1)/(2x2) = 75%
    expect(body.stats).toEqual({ alumnos: 2, promedioPct: 75, completadas: 3 })
  })

  it("detalle sin progreso: alumnos 0 y promedio null", async () => {
    allowEditor()
    vi.mocked(db.course.findUnique).mockResolvedValue({
      id: "c1",
      status: "PUBLISHED",
      modules: [
        { id: "m1", lessons: [{ id: "l1" }] },
      ],
    } as never)
    vi.mocked(db.userLessonProgress.findMany).mockResolvedValue([] as never)

    const res = await detailGET({} as never, params("c1"))
    const body = await res.json()
    expect(body.stats).toEqual({ alumnos: 0, promedioPct: null, completadas: 0 })
  })

  it("PATCH valida con bump y DELETE archiva (exige admin)", async () => {
    allowEditor()
    vi.mocked(db.course.update).mockResolvedValue({ id: "c1" } as never)
    const empty = await coursePATCH(jsonReq("http://x", {}) as never, params("c1"))
    expect(empty.status).toBe(400)
    expect(bumpContentVersion).not.toHaveBeenCalled()
    const ok = await coursePATCH(jsonReq("http://x", { status: "PUBLISHED" }) as never, params("c1"))
    expect(ok.status).toBe(200)
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)

    vi.mocked(requireAdmin).mockResolvedValue({
      session: null,
      error: Response.json({}, { status: 403 }),
    })
    const del = await courseDELETE({} as never, params("c1"))
    expect(del.status).toBe(403)
    expect(db.course.delete).not.toHaveBeenCalled()

    // DELETE exitoso: reemplazo lateral a ARCHIVED + bump, sin borrado físico.
    allowEditor()
    vi.mocked(requireAdmin).mockResolvedValue({
      session: { user: { id: "a1", role: "admin" } },
      error: null,
    } as never)
    vi.mocked(db.course.update).mockResolvedValue({ id: "c1", status: "ARCHIVED" } as never)
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)
    const archived = await courseDELETE({} as never, params("c1"))
    expect(archived.status).toBe(200)
    expect(vi.mocked(db.course.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1" }, data: { status: "ARCHIVED" } })
    )
    expect(db.course.delete).not.toHaveBeenCalled()
  })

  it("módulos y lecciones CRUD con bump (solo con título; contenido va por PUT)", async () => {
    allowEditor()
    vi.mocked(db.module.count).mockResolvedValue(2)
    vi.mocked(db.module.create).mockResolvedValue({ id: "m1" } as never)
    const mod = await modulesPOST(jsonReq("http://x/api/modules", { courseId: "c1", title: "M" }) as never)
    expect(mod.status).toBe(201)
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)

    vi.mocked(db.module.findUnique).mockResolvedValue({ id: "m1" } as never)
    vi.mocked(db.lesson.count).mockResolvedValue(0)
    vi.mocked(db.lesson.create).mockResolvedValue({ id: "l1" } as never)
    const les = await lessonsPOST(
      jsonReq("http://x", { title: "L" }) as never,
      params("m1")
    )
    expect(les.status).toBe(201)
    expect(bumpContentVersion).toHaveBeenCalledTimes(2)
    expect(db.lesson.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "L",
          content: { version: 2, blocks: [] },
        }),
      })
    )
    const sentData = vi.mocked(db.lesson.create).mock.calls[0]![0] as {
      data: Record<string, unknown>
    }
    expect(sentData.data).not.toHaveProperty("type")
    expect(sentData.data).not.toHaveProperty("wordId")
    expect(sentData.data).not.toHaveProperty("payload")

    vi.mocked(db.lesson.findUnique).mockResolvedValue({ id: "l1", moduleId: "m1" } as never)
    vi.mocked(db.lesson.update).mockResolvedValue({ id: "l1" } as never)
    const upd = await lessonPATCH(jsonReq("http://x", { title: "L2" }) as never, params("l1"))
    expect(upd.status).toBe(200)
    expect(bumpContentVersion).toHaveBeenCalledTimes(3)

    vi.mocked(db.module.update).mockResolvedValue({ id: "m1" } as never)
    const mord = await modulePATCH(jsonReq("http://x", { order: 3 }) as never, params("m1"))
    expect(mord.status).toBe(200)
    expect(bumpContentVersion).toHaveBeenCalledTimes(4)
  })

  it("reorder solo toca lo propio del curso con un solo bump", async () => {
    allowEditor()
    vi.mocked(db.course.findUnique).mockResolvedValue({ id: "c1" } as never)
    vi.mocked(db.module.findMany).mockResolvedValue([{ id: "m1", order: 1 }] as never)
    vi.mocked(db.module.update).mockResolvedValue({} as never)
    vi.mocked(db.module.findFirst).mockResolvedValue({ id: "m1" } as never)
    vi.mocked(db.lesson.findMany).mockResolvedValue([] as never)
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
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
  })

  it("reorder no-op no toca nada ni hace bump", async () => {
    allowEditor()
    vi.mocked(db.course.findUnique).mockResolvedValue({ id: "c1" } as never)
    vi.mocked(db.module.findMany).mockResolvedValue([{ id: "m1", order: 0 }] as never)
    const res = await reorderPOST(
      jsonReq("http://x", { modules: ["m1"], lessons: {} }) as never,
      params("c1")
    )
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.updated).toBe(0)
    expect(db.module.update).not.toHaveBeenCalled()
    expect(bumpContentVersion).not.toHaveBeenCalled()
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

  // Regresión: abrir una lección ya completada la des-completaba, porque la
  // API calculaba `completed = body?.completed === true` y guardaba ese false
  // en el update. El ping de visita NO manda `completed`.
  it("progreso: un ping de visita no des-completa la lección", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", role: "user" }, expires: "2099-01-01T00:00:00Z" },
      error: null,
    })
    vi.mocked(db.lesson.findUnique).mockResolvedValue({ id: "l1" } as never)
    vi.mocked(db.userLessonProgress.upsert).mockResolvedValue({ id: "p1" } as never)

    const res = await progressPOST(
      jsonReq("http://x/api/progress", { lessonId: "l1" }) as never
    )
    expect(res.status).toBe(200)

    const arg = vi.mocked(db.userLessonProgress.upsert).mock.calls[0]![0] as {
      update: Record<string, unknown>
    }
    expect(arg.update).not.toHaveProperty("completed")
    expect(arg.update).not.toHaveProperty("completedAt")
    expect(arg.update).toHaveProperty("lastVisitedAt")
  })

  it("progreso: completed=false explícito sí des-completa", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", role: "user" }, expires: "2099-01-01T00:00:00Z" },
      error: null,
    })
    vi.mocked(db.lesson.findUnique).mockResolvedValue({ id: "l1" } as never)
    vi.mocked(db.userLessonProgress.upsert).mockResolvedValue({ id: "p1" } as never)

    await progressPOST(
      jsonReq("http://x/api/progress", { lessonId: "l1", completed: false }) as never
    )

    const arg = vi.mocked(db.userLessonProgress.upsert).mock.calls[0]![0] as {
      update: Record<string, unknown>
    }
    expect(arg.update).toMatchObject({ completed: false, completedAt: null })
  })

  it("progreso: completed=true marca y sella la fecha", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      session: { user: { id: "u1", role: "user" }, expires: "2099-01-01T00:00:00Z" },
      error: null,
    })
    vi.mocked(db.lesson.findUnique).mockResolvedValue({ id: "l1" } as never)
    vi.mocked(db.userLessonProgress.upsert).mockResolvedValue({ id: "p1" } as never)

    await progressPOST(
      jsonReq("http://x/api/progress", { lessonId: "l1", completed: true, score: 80 }) as never
    )

    const arg = vi.mocked(db.userLessonProgress.upsert).mock.calls[0]![0] as {
      update: Record<string, unknown>
    }
    expect(arg.update).toMatchObject({ completed: true, score: 80 })
    expect(arg.update.completedAt).toBeInstanceOf(Date)
  })
})

describe("lecciones: numeración y dedupe [admin-cursos]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("POST asigna lessonNumber = max + 1 del módulo", async () => {
    allowEditor()
    vi.mocked(db.module.findUnique).mockResolvedValue({ id: "m1" } as never)
    vi.mocked(db.lesson.count).mockResolvedValue(2)
    vi.mocked(db.lesson.create).mockResolvedValue({ id: "l3", lessonNumber: 3 } as never)
    vi.mocked(db.dictionaryWord.findFirst).mockResolvedValue(null)

    // 1ª llamada (dupe check): nada. 2ª llamada ("last"): la lección 2.
    vi.mocked(db.lesson.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ lessonNumber: 2 } as never)

    const res = await lessonsPOST(
      jsonReq("http://x/api/modules/m1/lessons", { title: "Nueva" }) as never,
      params("m1")
    )
    expect(res.status).toBe(201)
    expect(db.lesson.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lessonNumber: 3 }),
      })
    )
  })

  it("POST rechaza 409 si el título ya existe en el módulo", async () => {
    allowEditor()
    vi.mocked(db.module.findUnique).mockResolvedValue({ id: "m1" } as never)
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: "l-existente" } as never)

    const res = await lessonsPOST(
      jsonReq("http://x/api/modules/m1/lessons", { title: "Bienvenida" }) as never,
      params("m1")
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.message).toMatch(/Bienvenida/)
    expect(db.lesson.create).not.toHaveBeenCalled()
  })

  it("PATCH edita solo título y orden (sin palabra ni type)", async () => {
    allowEditor()
    vi.mocked(db.lesson.findUnique).mockResolvedValue({ id: "l1", moduleId: "m1" } as never)
    vi.mocked(db.lesson.findFirst).mockResolvedValue(null)
    vi.mocked(db.lesson.update).mockResolvedValue({ id: "l1" } as never)

    const res = await lessonPATCH(
      jsonReq("http://x/api/lessons/l1", { title: "Nuevo título", wordSpanish: "casa", type: "QUIZ" }) as never,
      params("l1")
    )
    expect(res.status).toBe(200)
    expect(db.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Nuevo título" }),
      })
    )
    // palabra y type NO deben viajar aunque vengan en el body
    const sentData = vi.mocked(db.lesson.update).mock.calls[0]![0] as {
      data: Record<string, unknown>
    }
    expect(sentData.data).not.toHaveProperty("wordId")
    expect(sentData.data).not.toHaveProperty("type")
  })

  it("PATCH rechaza 409 al renombrar a un título existente del módulo", async () => {
    allowEditor()
    vi.mocked(db.lesson.findUnique).mockResolvedValue({ id: "l1", moduleId: "m1" } as never)
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: "l2" } as never)

    const res = await lessonPATCH(
      jsonReq("http://x/api/lessons/l1", { title: "Bienvenida" }) as never,
      params("l1")
    )
    expect(res.status).toBe(409)
    expect(db.lesson.update).not.toHaveBeenCalled()
  })

  it("reorder re-numera 1..N por módulo", async () => {
    allowEditor()
    vi.mocked(db.course.findUnique).mockResolvedValue({ id: "c1" } as never)
    vi.mocked(db.module.findFirst).mockResolvedValue({ id: "m1" } as never)
    vi.mocked(db.lesson.findMany)
      .mockResolvedValueOnce([{ id: "l1" }, { id: "l2" }] as never)
      .mockResolvedValueOnce([
        { id: "l2", order: 0 },
        { id: "l1", order: 1 },
      ] as never)
    vi.mocked(db.module.update).mockResolvedValue({} as never)
    vi.mocked(db.lesson.update).mockResolvedValue({} as never)

    const res = await reorderPOST(
      jsonReq("http://x", { lessons: { m1: ["l2", "l1"] } }) as never,
      params("c1")
    )
    expect(res.status).toBe(200)
    const updates = vi
      .mocked(db.lesson.update)
      .mock.calls.map((c) => c[0] as { where: { id: string }; data: Record<string, unknown> })
    const byId = Object.fromEntries(updates.map((u) => [u.where.id, u.data]))
    // order nuevo + lessonNumber reasignado 1..N en el mismo orden, un update por lección
    expect(Object.keys(byId)).toHaveLength(2)
    expect(byId["l2"]).toMatchObject({ order: 0, lessonNumber: 1 })
    expect(byId["l1"]).toMatchObject({ order: 1, lessonNumber: 2 })
  })
})

// Fase 2 de cursos: el endpoint que guarda el documento de bloques.
describe("PUT /api/lessons/[id] — guardar contenido [cursos-fase2]", () => {
  beforeEach(() => vi.clearAllMocks())

  const contenidoValido = {
    version: 2,
    blocks: [{ id: "b1", type: "text", html: "Hola" }],
  }

  function leccionExiste() {
    vi.mocked(db.lesson.findUnique).mockResolvedValue({ moduleId: "m1" } as never)
  }

  it("exige rol editor", async () => {
    const denegado = Response.json({ message: "Acceso denegado" }, { status: 403 })
    vi.mocked(requireRole).mockResolvedValue({ session: null, error: denegado } as never)

    const res = await lessonPUT(
      jsonReq("http://x/api/lessons/l1", { content: contenidoValido }, "PUT") as never,
      params("l1")
    )
    expect(res.status).toBe(403)
    expect(db.lesson.update).not.toHaveBeenCalled()
  })

  it("404 si la lección no existe", async () => {
    allowEditor()
    vi.mocked(db.lesson.findUnique).mockResolvedValue(null as never)

    const res = await lessonPUT(
      jsonReq("http://x/api/lessons/nope", { content: contenidoValido }, "PUT") as never,
      params("nope")
    )
    expect(res.status).toBe(404)
  })

  it("guarda título y contenido válidos", async () => {
    allowEditor()
    leccionExiste()
    vi.mocked(db.lesson.findFirst).mockResolvedValue(null)
    vi.mocked(db.lesson.update).mockResolvedValue({ id: "l1" } as never)

    const res = await lessonPUT(
      jsonReq(
        "http://x/api/lessons/l1",
        { title: "  Lección nueva  ", content: contenidoValido },
        "PUT"
      ) as never,
      params("l1")
    )

    expect(res.status).toBe(200)
    const arg = vi.mocked(db.lesson.update).mock.calls[0]![0] as unknown as {
      data: { title: string; content: { version: number; blocks: unknown[] } }
    }
    expect(arg.data.title).toBe("Lección nueva")
    expect(arg.data.content.version).toBe(2)
    expect(arg.data.content.blocks).toHaveLength(1)
    expect(bumpContentVersion).toHaveBeenCalled()
  })

  it("rechaza contenido inválido y NO guarda nada", async () => {
    allowEditor()
    leccionExiste()

    const res = await lessonPUT(
      jsonReq(
        "http://x/api/lessons/l1",
        { content: { version: 2, blocks: [{ id: "b1", type: "image", url: "javascript:alert(1)", alt: "x" }] } },
        "PUT"
      ) as never,
      params("l1")
    )

    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.errors.join(" ")).toMatch(/blocks\[0\]\.url/)
    expect(db.lesson.update).not.toHaveBeenCalled()
  })

  it("rechaza content null (vaciar es mandar blocks: [])", async () => {
    allowEditor()
    leccionExiste()

    const res = await lessonPUT(
      jsonReq("http://x/api/lessons/l1", { content: null }, "PUT") as never,
      params("l1")
    )
    expect(res.status).toBe(400)
    expect(db.lesson.update).not.toHaveBeenCalled()
  })

  it("acepta vaciar la lección con blocks: []", async () => {
    allowEditor()
    leccionExiste()
    vi.mocked(db.lesson.update).mockResolvedValue({ id: "l1" } as never)

    const res = await lessonPUT(
      jsonReq("http://x/api/lessons/l1", { content: { version: 2, blocks: [] } }, "PUT") as never,
      params("l1")
    )
    expect(res.status).toBe(200)
  })

  it("409-equivalente: rechaza título duplicado en el módulo", async () => {
    allowEditor()
    leccionExiste()
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: "l-otra" } as never)

    const res = await lessonPUT(
      jsonReq("http://x/api/lessons/l1", { title: "Repetida" }, "PUT") as never,
      params("l1")
    )
    expect(res.status).toBe(400)
    expect(db.lesson.update).not.toHaveBeenCalled()
  })

  it("400 si no hay nada que actualizar", async () => {
    allowEditor()
    leccionExiste()

    const res = await lessonPUT(
      jsonReq("http://x/api/lessons/l1", {}, "PUT") as never,
      params("l1")
    )
    expect(res.status).toBe(400)
  })
})
