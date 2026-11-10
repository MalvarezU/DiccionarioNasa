import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// next/link necesita contexto de router; se reemplaza por un anchor en jsdom.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))
vi.mock("@/components/navbar", () => ({ NavBar: () => <div /> }))
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => <div /> }))
vi.mock("@/components/breadcrumbs", () => ({
  Breadcrumbs: () => <nav aria-label="breadcrumb" />,
}))
vi.mock("@/components/reveal", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/lib/db", () => ({
  db: { dictionaryWord: { count: vi.fn() } },
}))

import { db } from "@/lib/db"
import JuegosPage, { ESCUCHA_MIN_AUDIO, isEscuchaUnlocked } from "./page"

describe("hub gate de Escucha [Fase 4]", () => {
  it("el gate abre con 8 audios y bloquea con menos", () => {
    expect(ESCUCHA_MIN_AUDIO).toBe(8)
    expect(isEscuchaUnlocked(0)).toBe(false)
    expect(isEscuchaUnlocked(7)).toBe(false)
    expect(isEscuchaUnlocked(8)).toBe(true)
    expect(isEscuchaUnlocked(11)).toBe(true)
  })

  it("con 11 audios el tile Escucha es jugable", async () => {
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(11)
    render(await JuegosPage())
    expect(screen.getByText("Escucha")).toBeDefined()
    expect(db.dictionaryWord.count).toHaveBeenCalledWith({
      where: { status: "PUBLISHED", audioUrl: { not: null } },
    })
    const link = screen.getByRole("link", { name: /Escucha/ })
    expect(link.getAttribute("href")).toBe("/juegos/escucha")
    expect(screen.queryByText("Requiere audios")).toBeNull()
  })

  it("con menos de 8 audios el tile Escucha queda locked", async () => {
    vi.mocked(db.dictionaryWord.count).mockResolvedValue(3)
    render(await JuegosPage())
    expect(screen.getByText("Requiere audios")).toBeDefined()
    expect(
      screen.getByText("Necesita al menos 8 palabras con audio publicado.")
    ).toBeDefined()
    expect(screen.queryByRole("link", { name: /Escucha/ })).toBeNull()
    // El resto del hub sigue jugable
    expect(screen.getByRole("link", { name: /Flashcards/ })).toBeDefined()
  })
})
