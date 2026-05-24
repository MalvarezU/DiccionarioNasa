import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    dictionaryWord: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

import { requireAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { PUT, PATCH } from "./route"

const adminSession = { user: { id: "admin1", name: "Admin", email: "a@b.com", role: "admin" } } as never

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({ session: adminSession, error: null })
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
}

const existingWord = {
  id: "w1",
  spanish: "casa",
  nasaYuwe: "ya:t",
  pronunciation: "yaat",
  audioUrl: null,
  culturalContext: "Vivienda",
  category: "sustantivo",
  examples: null,
  status: "DRAFT",
  createdAt: new Date(),
  updatedAt: new Date(),
}

const params = { params: Promise.resolve({ id: "w1" }) }

describe("PUT /api/admin/words/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates word fields", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(existingWord)
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({ ...existingWord, spanish: "hogar" })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spanish: "hogar" }),
      }),
      params
    )
    const body = await res.json()
    expect(body.word.spanish).toBe("hogar")
  })

  it("returns 404 when word not found", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(null)

    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spanish: "hogar" }),
      }),
      params
    )
    expect(res.status).toBe(404)
  })

  it("returns 400 for empty required fields", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(existingWord)

    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spanish: "" }),
      }),
      params
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid status", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(existingWord)

    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INVALID" }),
      }),
      params
    )
    expect(res.status).toBe(400)
  })

  it("returns 200 with message when no changes detected", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(existingWord)

    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spanish: "casa" }),
      }),
      params
    )
    const body = await res.json()
    expect(body.message).toBe("No se detectaron cambios")
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spanish: "hogar" }),
      }),
      params
    )
    expect(res.status).toBe(401)
  })

  it("returns previousAudioUrl when audioUrl changes", async () => {
    allow()
    const wordWithAudio = { ...existingWord, audioUrl: "/audio/old.mp3" }
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(wordWithAudio)
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({ ...wordWithAudio, audioUrl: "/audio/new.mp3" })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: "/audio/new.mp3" }),
      }),
      params
    )
    const body = await res.json()
    expect(body.previousAudioUrl).toBe("/audio/old.mp3")
  })
})

describe("PATCH /api/admin/words/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("updates word status only", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(existingWord)
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({ ...existingWord, status: "PUBLISHED" })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await PATCH(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      }),
      params
    )
    const body = await res.json()
    expect(body.word.status).toBe("PUBLISHED")
    expect(body.previousStatus).toBe("DRAFT")
  })

  it("returns 400 for invalid status", async () => {
    allow()
    const res = await PATCH(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INVALID" }),
      }),
      params
    )
    expect(res.status).toBe(400)
  })

  it("returns 404 when word not found", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(null)

    const res = await PATCH(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      }),
      params
    )
    expect(res.status).toBe(404)
  })

  it("returns early if status is already the same", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({ ...existingWord, status: "PUBLISHED" })

    const res = await PATCH(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      }),
      params
    )
    const body = await res.json()
    expect(body.message).toContain("ya tiene este estado")
  })
})
