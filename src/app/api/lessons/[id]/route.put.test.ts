import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}))

vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
    lesson: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  }
  // PUT/PATCH usan `db.$transaction(async (tx) => ...)`: el mock ejecuta el
  // callback con el propio db mockeado como `tx`.
  db.$transaction = vi.fn(async (fn: unknown) =>
    typeof fn === "function" ? (fn as (tx: unknown) => unknown)(db) : fn
  )
  return { db }
})

vi.mock("@/lib/content-version", () => ({
  bumpContentVersion: vi.fn(),
  getContentVersion: vi.fn(),
}))

import { requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { bumpContentVersion } from "@/lib/content-version"
import { NextRequest } from "next/server"
import { PUT } from "./route"

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

const current = { moduleId: "m1" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.lesson.findUnique).mockResolvedValue(current as never)
  vi.mocked(db.lesson.findFirst).mockResolvedValue(null)
  vi.mocked(db.lesson.update).mockResolvedValue({ id: "l1" } as never)
})

describe("PUT /api/lessons/[id] — edge/adversarial", () => {
  it("401 sin rol editor", async () => {
    deny()
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "X" }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(401)
  })

  it("404 si la lección no existe", async () => {
    allow()
    vi.mocked(db.lesson.findUnique).mockResolvedValue(null)
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "X" }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(404)
  })

  it("400 con body vacío", async () => {
    allow()
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(400)
  })

  it("400 con body no-JSON (catch)", async () => {
    allow()
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    // body inválido → {} → 400 "Nada que actualizar"
    expect(res.status).toBe(400)
  })

  it("400 si content es null", async () => {
    allow()
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: null }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.errors).toContain("content: no puede ser null; para vaciar la lección usá blocks: []")
  })

  it("400 si content inválido (más de maxBlocks)", async () => {
    allow()
    const blocks = Array.from({ length: 101 }, (_, i) => ({ id: `b${i}`, type: "text", html: "x" }))
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { version: 2, blocks } }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(400)
  })

  it("400 si html supera maxHtml", async () => {
    allow()
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { version: 2, blocks: [{ id: "b1", type: "text", html: "a".repeat(40_001) }] } }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(400)
  })

  it("400 si título vacío", async () => {
    allow()
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "   " }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(400)
  })

  it("400 si título duplicado en el mismo módulo (trim)", async () => {
    allow()
    vi.mocked(db.lesson.findFirst).mockResolvedValue({ id: "l2" } as never)
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "  Lección 2  " }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.errors[0]).toContain("Ya existe otra lección")
  })

  it("200 guarda content válido y lo sanitiza server-side", async () => {
    allow()
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { version: 2, blocks: [{ id: "b1", type: "text", html: "<p>x</p><script>alert(1)</script>" }] } }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(200)
    const call = vi.mocked(db.lesson.update).mock.calls[0][0] as any
    expect(call.data.content.blocks[0].html).toBe("<p>x</p>")
  })

  it("200 vacía una lección con blocks: []", async () => {
    allow()
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { version: 2, blocks: [] } }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(200)
  })

  it("200 actualiza título válido", async () => {
    allow()
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nuevo título" }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(200)
    const call = vi.mocked(db.lesson.update).mock.calls[0][0] as any
    expect(call.data.title).toBe("Nuevo título")
  })

  it("XSS en url de image block se rechaza por isSafeMediaUrl", async () => {
    allow()
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { version: 2, blocks: [{ id: "b1", type: "image", url: "javascript:alert(1)", alt: "x" }] } }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(400)
  })

  it("XSS en youtubeId inválido se rechaza", async () => {
    allow()
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { version: 2, blocks: [{ id: "b1", type: "video", youtubeId: "<script>", title: "x" }] } }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(400)
  })

  it("bloque con id duplicado se rechaza", async () => {
    allow()
    const req = new NextRequest("http://localhost:3000/api/lessons/l1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { version: 2, blocks: [
        { id: "dup", type: "text", html: "a" },
        { id: "dup", type: "text", html: "b" },
      ] } }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: "l1" }) })
    expect(res.status).toBe(400)
  })
})
