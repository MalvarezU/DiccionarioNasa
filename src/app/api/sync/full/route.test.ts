import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { findMany: vi.fn() },
    course: { findMany: vi.fn() },
    mediaAsset: { findMany: vi.fn() },
    contentVersion: { findUnique: vi.fn() },
  },
}))

import { db } from "@/lib/db"
import { GET } from "./route"

const SECRET = "test-ci-secret-xyz"
const CDN = "https://cdn.test"

const PRIVATE_NO_STORE = "private, no-store"

function word(id: string) {
  return {
    id, spanish: "hola", nasaYuwe: "nasa", pronunciation: null,
    audioUrl: `${CDN}/audios/${id}.mp3`, illustrationUrl: null,
    culturalContext: null, category: null, examples: null,
    status: "PUBLISHED", updatedAt: new Date("2026-10-01T00:00:00Z"),
  }
}

function lesson(id: string, extra: Record<string, unknown> = {}) {
  return {
    id, moduleId: "m1", title: "L1", order: 0, lessonNumber: 1,
    content: { version: 2, blocks: [] },
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...extra,
  }
}

function courseTree() {
  return [
    {
      id: "c1", title: "Curso", description: null, coverImage: `${CDN}/images/cover.png`,
      status: "PUBLISHED", sequential: true,
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-10-01T00:00:00Z"),
      modules: [
        {
          id: "m1", courseId: "c1", title: "M1", order: 0,
          updatedAt: new Date("2026-10-01T00:00:00Z"),
          // La DB ya filtra deletedAt; el mock simula una fila que pasara
          // el filtro para verificar que el mapeo la recorta igual.
          deletedAt: null,
          lessons: [lesson("l1")],
        },
      ],
    },
  ]
}

function authed(url = "http://x/api/sync/full") {
  return new Request(url, { headers: { "X-CI-Secret": SECRET } })
}

describe("GET /api/sync/full [Fase B W3b]", () => {
  const OLD_SECRET = process.env.CI_SYNC_SECRET
  const OLD_BASE = process.env.R2_PUBLIC_BASE_URL

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CI_SYNC_SECRET = SECRET
    process.env.R2_PUBLIC_BASE_URL = CDN
    vi.mocked(db.contentVersion.findUnique).mockResolvedValue({ version: 41 } as never)
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([word("w1")] as never)
    vi.mocked(db.course.findMany).mockResolvedValue(courseTree() as never)
    vi.mocked(db.mediaAsset.findMany).mockResolvedValue([])
  })

  afterEach(() => {
    if (OLD_SECRET === undefined) delete process.env.CI_SYNC_SECRET
    else process.env.CI_SYNC_SECRET = OLD_SECRET
    if (OLD_BASE === undefined) delete process.env.R2_PUBLIC_BASE_URL
    else process.env.R2_PUBLIC_BASE_URL = OLD_BASE
  })

  it("sin encabezado → 401 con cuerpo genérico exacto", async () => {
    const res = await GET(new Request("http://x/api/sync/full") as never)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ message: "No autorizado" })
    expect(res.headers.get("Cache-Control")).toBe(PRIVATE_NO_STORE)
  })

  it("secreto inválido → 401 idéntico (mismo estado y cuerpo, sin oráculo)", async () => {
    const res = await GET(
      new Request("http://x/api/sync/full", {
        headers: { "X-CI-Secret": "incorrecto" },
      }) as never
    )
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ message: "No autorizado" })
    expect(res.headers.get("Cache-Control")).toBe(PRIVATE_NO_STORE)
  })

  it("secreto válido → 200 con forma { contentVersion, words[], courses[], media[] }", async () => {
    const res = await GET(authed() as never)
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe(PRIVATE_NO_STORE)

    const body = await res.json()
    expect(Object.keys(body).sort()).toEqual(
      ["contentVersion", "courses", "media", "words"].sort()
    )
    expect(body.contentVersion).toBe(41)
    expect(body.words).toHaveLength(1)
    expect(body.words[0]).toMatchObject({ id: "w1", status: "PUBLISHED" })
    expect(typeof body.words[0].updatedAt).toBe("string")
    expect(body.courses).toHaveLength(1)
    expect(body.courses[0].modules).toHaveLength(1)
    expect(body.courses[0].modules[0].lessons).toHaveLength(1)
    expect(Array.isArray(body.media)).toBe(true)
  })

  it("recorte: sin clave stats, sin deletedAt; el árbol filtra en consulta", async () => {
    const res = await GET(authed() as never)
    const body = await res.json()

    // Rama stats de editor+ excluida en todos los niveles.
    expect(JSON.stringify(body)).not.toContain('"stats"')
    // deletedAt recortado por mapeo explícito (nunca se serializa).
    expect(JSON.stringify(body)).not.toContain("deletedAt")

    // Enforcement en consulta: solo PUBLISHED, borrados lógicos fuera.
    expect(db.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED" },
        orderBy: { id: "asc" },
      })
    )
    const include = vi.mocked(db.course.findMany).mock.calls[0]?.[0]?.include as
      | { modules?: { where?: unknown; orderBy?: unknown; include?: { lessons?: unknown } } }
      | undefined
    expect(include?.modules).toMatchObject({
      where: { deletedAt: null },
      orderBy: { order: "asc" },
    })
    expect(include?.modules?.include?.lessons).toMatchObject({
      where: { deletedAt: null },
    })
    // Words en orden estable id asc, sin paginación.
    expect(db.dictionaryWord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { id: "asc" } })
    )
  })

  it("E4: curso PUBLISHED sin módulos → presente con modules: []", async () => {
    vi.mocked(db.course.findMany).mockResolvedValue([
      {
        id: "c2", title: "Vacío", description: null, coverImage: null,
        status: "PUBLISHED", sequential: true,
        createdAt: new Date("2026-09-01T00:00:00Z"),
        updatedAt: new Date("2026-10-01T00:00:00Z"),
        modules: [],
      },
    ] as never)

    const body = await (await GET(authed() as never)).json()
    expect(body.courses).toHaveLength(1)
    expect(body.courses[0].modules).toEqual([])
  })

  it("E5: lección con content corrupto → incluida con su content crudo", async () => {
    const tree = courseTree()
    tree[0]!.modules[0]!.lessons = [lesson("lx", { content: { blocks: "roto" } })]
    vi.mocked(db.course.findMany).mockResolvedValue(tree as never)

    const body = await (await GET(authed() as never)).json()
    const lessons = body.courses[0].modules[0].lessons
    expect(lessons).toHaveLength(1)
    expect(lessons[0].content).toEqual({ blocks: "roto" })
  })

  it("E2: bundle vacío → 200 con arreglos vacíos (sin 404 ni 500)", async () => {
    vi.mocked(db.dictionaryWord.findMany).mockResolvedValue([])
    vi.mocked(db.course.findMany).mockResolvedValue([])
    vi.mocked(db.mediaAsset.findMany).mockResolvedValue([])

    const res = await GET(authed() as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      contentVersion: 41, words: [], courses: [], media: [],
    })
  })

  it("E3: base R2 ausente → 500 completo, nunca bundle parcial", async () => {
    delete process.env.R2_PUBLIC_BASE_URL

    const res = await GET(authed() as never)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ message: "Error interno del servidor" })
  })

  it("ignora query params sin 400", async () => {
    const res = await GET(authed("http://x/api/sync/full?foo=bar&limit=1") as never)
    expect(res.status).toBe(200)
  })

  it("W-2: fixture con curso ARCHIVED y módulo con deletedAt → excluidos del bundle", async () => {
    const deletedAt = new Date("2026-09-15T00:00:00Z")
    const allWords = [
      { ...word("w-pub"), audioUrl: `${CDN}/audios/w-pub.mp3` },
      { ...word("w-draft"), status: "DRAFT" },
      { ...word("w-arch"), status: "ARCHIVED" },
    ]
    const allCourses = [
      {
        id: "c-arch", title: "Archivado", description: null, coverImage: null,
        status: "ARCHIVED", sequential: true,
        createdAt: new Date("2026-09-01T00:00:00Z"),
        updatedAt: new Date("2026-10-01T00:00:00Z"),
        modules: [
          {
            id: "m-arch", courseId: "c-arch", title: "M", order: 0,
            updatedAt: new Date("2026-10-01T00:00:00Z"),
            deletedAt: null,
            lessons: [lesson("l-arch", { moduleId: "m-arch" })],
          },
        ],
      },
      {
        id: "c1", title: "Curso", description: null, coverImage: null,
        status: "PUBLISHED", sequential: true,
        createdAt: new Date("2026-09-01T00:00:00Z"),
        updatedAt: new Date("2026-10-01T00:00:00Z"),
        modules: [
          {
            id: "m1", courseId: "c1", title: "M1", order: 0,
            updatedAt: new Date("2026-10-01T00:00:00Z"),
            deletedAt: null,
            lessons: [lesson("l1"), lesson("l-del", { deletedAt })],
          },
          {
            id: "m-del", courseId: "c1", title: "Borrado", order: 1,
            updatedAt: new Date("2026-10-01T00:00:00Z"),
            deletedAt,
            lessons: [lesson("l2", { moduleId: "m-del" })],
          },
        ],
      },
    ]

    // Fake que honra el `where` como lo haría Prisma: si la ruta debilita
    // el filtro (status PUBLISHED / deletedAt null), las filas excluidas
    // reaparecen en el bundle y este test falla. Es la prueba a nivel ruta
    // que exige W-2 (no solo aserción del objeto `where`).
    vi.mocked(db.dictionaryWord.findMany).mockImplementation((async (args) => {
      const status = (args as { where?: { status?: string } } | undefined)?.where?.status
      return allWords.filter((w) => !status || w.status === status) as never
    }) as never)
    vi.mocked(db.course.findMany).mockImplementation((async (args) => {
      const a = (args ?? {}) as {
        where?: { status?: string }
        include?: {
          modules?: {
            where?: { deletedAt?: null }
            include?: { lessons?: { where?: { deletedAt?: null } } }
          }
        }
      }
      const onlyLiveModules = a.include?.modules?.where?.deletedAt === null
      const onlyLiveLessons = a.include?.modules?.include?.lessons?.where?.deletedAt === null
      return allCourses
        .filter((c) => !a.where?.status || c.status === a.where.status)
        .map((c) => ({
          ...c,
          modules: c.modules
            .filter((m) => !onlyLiveModules || m.deletedAt === null)
            .map((m) => ({
              ...m,
              lessons: m.lessons.filter(
                (l) => !onlyLiveLessons || (l as { deletedAt?: Date | null }).deletedAt == null
              ),
            })),
        })) as never
    }) as never)

    const res = await GET(authed() as never)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.courses.map((c: { id: string }) => c.id)).toEqual(["c1"])
    expect(body.courses[0].modules.map((m: { id: string }) => m.id)).toEqual(["m1"])
    expect(
      body.courses[0].modules[0].lessons.map((l: { id: string }) => l.id)
    ).toEqual(["l1"])
    expect(body.words.map((w: { id: string }) => w.id)).toEqual(["w-pub"])

    const raw = JSON.stringify(body)
    expect(raw).not.toContain("c-arch")
    expect(raw).not.toContain("m-del")
    expect(raw).not.toContain("l-del")
    expect(raw).not.toContain("ARCHIVED")
    expect(raw).not.toContain("DRAFT")
  })
})
