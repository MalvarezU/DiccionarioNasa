import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

import { requireAdmin } from "@/lib/auth"
import { GET } from "./route"
import { GET as GET_BY_ID } from "./[id]/route"

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

function upstreamRuns() {
  return {
    total_count: 42,
    workflow_runs: [
      {
        id: 101,
        status: "completed",
        conclusion: "success",
        created_at: "2026-11-09T03:00:00.000Z",
        updated_at: "2026-11-09T03:05:00.000Z",
        html_url: "https://github.com/o/r/actions/runs/101",
        inputs: { dry_run: true },
        // Campos internos que la forma propia NO debe filtrar:
        head_sha: "deadbeef",
        run_number: 7,
        actor: { login: "someone" },
      },
      {
        id: 100,
        status: "in_progress",
        conclusion: null,
        created_at: "2026-11-08T03:00:00.000Z",
        updated_at: "2026-11-08T03:01:00.000Z",
        html_url: "https://github.com/o/r/actions/runs/100",
      },
    ],
  }
}

describe("GET /api/admin/seed/runs [Fase D W1]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("SEED_DISPATCH_TOKEN", "test-token")
    vi.stubEnv("SEED_GITHUB_OWNER", "test-owner")
    vi.stubEnv("SEED_GITHUB_REPO", "test-repo")
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(upstreamRuns()), { status: 200 })
    )
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("sin sesión admin → 401 y fetch a GitHub no llamado", async () => {
    deny()

    const res = await GET(new Request("http://x/api/admin/seed/runs"))

    expect(res.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("lista mockeada → forma mínima exacta sin campos internos", async () => {
    allow()

    const res = await GET(
      new Request("http://x/api/admin/seed/runs?per_page=10&page=1")
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      runs: [
        {
          id: 101,
          status: "completed",
          conclusion: "success",
          createdAt: "2026-11-09T03:00:00.000Z",
          updatedAt: "2026-11-09T03:05:00.000Z",
          inputs: { dry_run: true },
          htmlUrl: "https://github.com/o/r/actions/runs/101",
        },
        {
          id: 100,
          status: "in_progress",
          conclusion: null,
          createdAt: "2026-11-08T03:00:00.000Z",
          updatedAt: "2026-11-08T03:01:00.000Z",
          inputs: {},
          htmlUrl: "https://github.com/o/r/actions/runs/100",
        },
      ],
      totalCount: 42,
      page: 1,
      per_page: 10,
    })
    const [, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers).toMatchObject({
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    })
    expect(headers.Authorization).toBe("Bearer test-token")
    expect(JSON.stringify(body)).not.toContain("test-token")
  })

  it("per_page fuera de rango → 400 sin llamar a GitHub", async () => {
    allow()

    const res = await GET(new Request("http://x/api/admin/seed/runs?per_page=99"))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toHaveProperty("message")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("upstream 500 → propio 502 genérico", async () => {
    allow()
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "UPSTREAM_SECRET_MARKER" }), {
        status: 500,
      })
    )

    const res = await GET(new Request("http://x/api/admin/seed/runs"))
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body).toHaveProperty("message")
    expect(JSON.stringify(body)).not.toContain("UPSTREAM_SECRET_MARKER")
  })

  it("detalle: id no numérico → 400", async () => {
    allow()

    const res = await GET_BY_ID(new Request("http://x/api/admin/seed/runs/abc"), {
      params: Promise.resolve({ id: "abc" }),
    } as never)

    expect(res.status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("detalle: upstream 404 → propio 404", async () => {
    allow()
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not Found" }), { status: 404 })
    )

    const res = await GET_BY_ID(new Request("http://x/api/admin/seed/runs/999"), {
      params: Promise.resolve({ id: "999" }),
    } as never)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ message: "Ejecución no encontrada" })
  })
})
