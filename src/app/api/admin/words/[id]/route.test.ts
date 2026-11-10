import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
}))

vi.mock("@/lib/db", () => {
  const db: Record<string, unknown> = {
    dictionaryWord: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
    mediaAsset: { findUnique: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  }
  // La ruta usa `db.$transaction(async (tx) => ...)`: el mock ejecuta el
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

const mockDeleteObject = vi.fn()

vi.mock("@/lib/r2", () => ({
  putObject: vi.fn(),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}))

import { requireAdmin, requireRole } from "@/lib/auth"
import { db } from "@/lib/db"
import { bumpContentVersion } from "@/lib/content-version"
import { PUT, PATCH, DELETE } from "./route"

const adminSession = { user: { id: "admin1", name: "Admin", email: "a@b.com", role: "admin" } } as never
const editorSession = { user: { id: "editor1", name: "Editor", email: "e@b.com", role: "editor" } } as never

function allow() {
  vi.mocked(requireAdmin).mockResolvedValue({ session: adminSession, error: null })
  vi.mocked(requireRole).mockResolvedValue({ session: editorSession, error: null })
}

function deny() {
  vi.mocked(requireAdmin).mockResolvedValue({
    session: null,
    error: Response.json({ message: "No autorizado" }, { status: 401 }),
  })
  vi.mocked(requireRole).mockResolvedValue({
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
  illustrationUrl: null,
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
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
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

  it("reemplazar ilustración borra el asset anterior sin bloquear el PUT", async () => {
    allow()
    mockDeleteObject.mockResolvedValue(undefined)
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({
      ...existingWord,
      illustrationUrl: "/api/media/vieja",
    })
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({
      ...existingWord,
      illustrationUrl: "/api/media/nueva",
    })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue({
      id: "vieja",
      objectKey: "images/vieja.png",
    } as never)
    vi.mocked(db.mediaAsset.delete).mockResolvedValue({ id: "vieja" } as never)

    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ illustrationUrl: "/api/media/nueva" }),
      }),
      params
    )

    expect(res.status).toBe(200)
    expect(db.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: "vieja" } })
    expect(mockDeleteObject).toHaveBeenCalledWith("images/vieja.png")
  })

  it("si la limpieza de la ilustración falla, el PUT igual responde 200", async () => {
    allow()
    mockDeleteObject.mockRejectedValue(new Error("R2 caído"))
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({
      ...existingWord,
      illustrationUrl: "/api/media/vieja",
    })
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({
      ...existingWord,
      illustrationUrl: "/api/media/nueva",
    })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)
    vi.mocked(db.mediaAsset.findUnique).mockResolvedValue({
      id: "vieja",
      objectKey: "images/vieja.png",
    } as never)
    vi.mocked(db.mediaAsset.delete).mockResolvedValue({ id: "vieja" } as never)

    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ illustrationUrl: "/api/media/nueva" }),
      }),
      params
    )
    expect(res.status).toBe(200)
  })

  it("reemplazar audio borra el objeto anterior de R2 sin bloquear el PUT", async () => {
    allow()
    mockDeleteObject.mockResolvedValue(undefined)
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({
      ...existingWord,
      audioUrl: "https://xyz.supabase.co/storage/v1/object/public/audios/temp/viejo.mp3",
    })
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({
      ...existingWord,
      audioUrl: "https://cdn.test/audios/temp/nuevo.mp3",
    })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: "https://cdn.test/audios/temp/nuevo.mp3" }),
      }),
      params
    )

    expect(res.status).toBe(200)
    expect(mockDeleteObject).toHaveBeenCalledWith("audios/temp/viejo.mp3")
  })

  it("quitar audio (null) borra el objeto anterior de R2", async () => {
    allow()
    mockDeleteObject.mockResolvedValue(undefined)
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({
      ...existingWord,
      audioUrl: "https://xyz.supabase.co/storage/v1/object/public/audios/temp/viejo.mp3",
    })
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({ ...existingWord, audioUrl: null })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: null }),
      }),
      params
    )

    expect(res.status).toBe(200)
    expect(mockDeleteObject).toHaveBeenCalledWith("audios/temp/viejo.mp3")
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

  it("returns 400 for invalid status without bump", async () => {
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
    expect(bumpContentVersion).not.toHaveBeenCalled()
  })

  it("normalizes lowercase status to uppercase with bump", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(existingWord)
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({ ...existingWord, status: "ARCHIVED" })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      }),
      params
    )
    expect(res.status).toBe(200)
    expect(vi.mocked(db.dictionaryWord.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ARCHIVED" }) })
    )
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
  })

  it("returns 200 with message when no changes detected without bump", async () => {
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
    expect(bumpContentVersion).not.toHaveBeenCalled()
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
    // El audio nuevo debe persistirse en BD (bug "no queda guardado")
    expect(db.dictionaryWord.update).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: expect.objectContaining({ audioUrl: "/audio/new.mp3" }),
    })
  })

  it("editor no puede borrar (DELETE exige admin) [B1.5]", async () => {
    // En producción requireAdmin devuelve 403 para editor (ver auth.test)
    vi.mocked(requireAdmin).mockResolvedValue({
      session: null,
      error: Response.json({ message: "Acceso denegado" }, { status: 403 }),
    })

    const del = await DELETE(
      new Request("http://localhost:3000/api/admin/words/w1", { method: "DELETE" }),
      params
    )
    expect(del.status).toBe(403)
    expect(db.dictionaryWord.update).not.toHaveBeenCalled()
    expect(bumpContentVersion).not.toHaveBeenCalled()
  })

  it("editor sí puede editar con PUT [B1.5]", async () => {
    vi.mocked(requireRole).mockResolvedValue({ session: editorSession, error: null })
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(existingWord)
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({ ...existingWord, category: "verbo" })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await PUT(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "verbo" }),
      }),
      params
    )
    expect(res.status).toBe(200)
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
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
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
  })

  it("normalizes lowercase status to uppercase with bump", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(existingWord)
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({ ...existingWord, status: "ARCHIVED" })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await PATCH(
      new Request("http://localhost:3000/api/admin/words/w1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      }),
      params
    )
    expect(res.status).toBe(200)
    expect(vi.mocked(db.dictionaryWord.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ARCHIVED" } })
    )
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
  })

  it("returns 400 for invalid status without bump", async () => {
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
    expect(bumpContentVersion).not.toHaveBeenCalled()
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

  it("returns early if status is already the same without bump", async () => {
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
    expect(bumpContentVersion).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/admin/words/[id] — borrado lógico (Fase A T07)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    allow()
    mockDeleteObject.mockReset()
  })

  it("archiva la ficha (no la borra) con bump y log DELETE", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(existingWord)
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({ ...existingWord, status: "ARCHIVED" })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)

    const res = await DELETE(
      new Request("http://localhost:3000/api/admin/words/w1", { method: "DELETE" }),
      params
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe("w1")
    expect(vi.mocked(db.dictionaryWord.update)).toHaveBeenCalledWith({
      where: { id: "w1" },
      data: { status: "ARCHIVED" },
    })
    expect(db.dictionaryWord.delete).not.toHaveBeenCalled()
    expect(vi.mocked(db.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "DELETE" }) })
    )
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
    // El audio se conserva: la ficha archivada puede restaurarse.
    expect(mockDeleteObject).not.toHaveBeenCalled()
  })

  it("archiva aunque la ficha tenga audio (no toca R2)", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue({
      ...existingWord,
      audioUrl: "https://xyz.supabase.co/storage/v1/object/public/audios/temp/audio.mp3",
    })
    vi.mocked(db.dictionaryWord.update).mockResolvedValue({ ...existingWord, status: "ARCHIVED" })
    vi.mocked(db.auditLog.create).mockResolvedValue({} as never)
    mockDeleteObject.mockResolvedValue(undefined)

    const res = await DELETE(
      new Request("http://localhost:3000/api/admin/words/w1", { method: "DELETE" }),
      params
    )

    expect(res.status).toBe(200)
    expect(mockDeleteObject).not.toHaveBeenCalled()
    expect(bumpContentVersion).toHaveBeenCalledTimes(1)
  })

  it("returns 404 when word not found without bump", async () => {
    allow()
    vi.mocked(db.dictionaryWord.findUnique).mockResolvedValue(null)

    const res = await DELETE(
      new Request("http://localhost:3000/api/admin/words/w1", { method: "DELETE" }),
      params
    )
    expect(res.status).toBe(404)
    expect(bumpContentVersion).not.toHaveBeenCalled()
  })

  it("returns 401 when not admin", async () => {
    deny()
    const res = await DELETE(
      new Request("http://localhost:3000/api/admin/words/w1", { method: "DELETE" }),
      params
    )
    expect(res.status).toBe(401)
  })
})
