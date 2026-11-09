import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: { auditLog: { create: vi.fn() } },
}))

import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { POST } from "./route"

const adminSession = {
  user: { id: "admin1", name: "Admin", email: "admin@nasayuwe.com", role: "admin" },
} as never

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({ session: adminSession, error: null })
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost:3000/api/admin/seed/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

function fetchMock204() {
  return vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
}

describe("POST /api/admin/seed/dispatch [Fase D W1]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("SEED_DISPATCH_TOKEN", "test-token")
    vi.stubEnv("SEED_GITHUB_OWNER", "test-owner")
    vi.stubEnv("SEED_GITHUB_REPO", "test-repo")
    global.fetch = fetchMock204()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("sin sesión admin → 401 y fetch a GitHub no llamado", async () => {
    deny()

    const res = await post({ dry_run: true })
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ message: "No autorizado" })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("body con campo fuera de allowlist → 400 y fetch no llamado", async () => {
    allow()

    const res = await post({ foo: 1 })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toHaveProperty("message")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("content_version no canónico → 400 y fetch no llamado", async () => {
    allow()

    const res = await post({ content_version: "abc" })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toHaveProperty("message")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("dry_run no booleano → 400 y fetch no llamado", async () => {
    allow()

    const res = await post({ dry_run: "sí" })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toHaveProperty("message")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("content_version vacío → dispatch sin la clave content_version", async () => {
    allow()

    const res = await post({ content_version: "", dry_run: true })

    expect(res.status).toBe(202)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    const sent = JSON.parse(init.body as string)
    expect(sent).toEqual({ ref: "main", inputs: { dry_run: true } })
    expect(db.auditLog.create).toHaveBeenCalledTimes(1)
  })

  it("GitHub 204 → propio 202 con correlationId y audit SEED_DISPATCH", async () => {
    allow()

    const res = await post({ content_version: "42", dry_run: false })
    const body = await res.json()

    expect(res.status).toBe(202)
    expect(body.run).toBeNull()
    expect(body.status).toBe("dispatched")
    expect(body.ref).toBe("main")
    expect(body.inputs).toEqual({ dry_run: false, content_version: "42" })
    expect(typeof body.correlationId).toBe("string")
    expect(body.correlationId).toHaveLength(36)

    expect(db.auditLog.create).toHaveBeenCalledTimes(1)
    const auditData = vi.mocked(db.auditLog.create).mock.calls[0][0] as {
      data: Record<string, unknown>
    }
    expect(auditData.data.action).toBe("SEED_DISPATCH")
    expect(auditData.data.entity).toBe("SeedContent")
    expect(auditData.data.entityId).toBe("42")
    expect(auditData.data.userId).toBe("admin1")
    const changes = JSON.parse(auditData.data.changes as string)
    expect(changes.ref).toBe("main")
    expect(changes.inputs).toEqual({ dry_run: false, content_version: "42" })
    expect(changes.correlationId).toBe(body.correlationId)
  })

  it("GitHub 422 → propio 502 genérico sin filtrar el cuerpo upstream", async () => {
    allow()
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "UPSTREAM_SECRET_MARKER", errors: [] }), {
        status: 422,
      })
    )

    const res = await post({ dry_run: true })
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body).toEqual({ message: "No se pudo disparar la generación de contenido" })
    expect(JSON.stringify(body)).not.toContain("UPSTREAM_SECRET_MARKER")
    expect(db.auditLog.create).not.toHaveBeenCalled()
  })

  it("fallo de red hacia GitHub → propio 502 y sin audit", async () => {
    allow()
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("fetch failed"))

    const res = await post({ dry_run: true })
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body).toEqual({ message: "No se pudo disparar la generación de contenido" })
    expect(db.auditLog.create).not.toHaveBeenCalled()
  })

  it("sin SEED_DISPATCH_TOKEN → 500 sin llamar a GitHub", async () => {
    allow()
    vi.stubEnv("SEED_DISPATCH_TOKEN", "")

    const res = await post({ dry_run: true })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body).toEqual({ message: "Error interno del servidor" })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(db.auditLog.create).not.toHaveBeenCalled()
  })
})
