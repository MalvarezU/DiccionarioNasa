import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span>value</span>,
}))

vi.mock("@/lib/admin-utils", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/admin-utils")>()
  return {
    ...orig,
    formatNumber: (n: number) => String(n),
    WORD_CATEGORIES: [{ value: "sustantivo", label: "Sustantivo" }],
  }
})

import { useSession } from "next-auth/react"
import AdminPalabrasPage from "./page"

const mockWords = [
  {
    id: "w1",
    spanish: "Casa",
    nasaYuwe: "Yat",
    pronunciation: "yat",
    audioUrl: null,
    culturalContext: null,
    category: "sustantivo",
    status: "PUBLISHED",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
]

function mockFetchWords(words: typeof mockWords) {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ words, totalPages: 1, total: words.length })
  )
}

describe("AdminPalabrasPage [F2]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(useSession).mockReturnValue({
      data: { user: { role: "admin" } as never, expires: "2099" },
      status: "authenticated",
      update: vi.fn(),
    })
  })

  it("muestra acciones y la lista inline", async () => {
    mockFetchWords(mockWords)
    render(<AdminPalabrasPage />)

    expect(screen.getByText("Gestión de palabras")).toBeDefined()
    expect(screen.getByRole("button", { name: "Nueva ficha" })).toBeDefined()
    expect(screen.getByRole("button", { name: /Importar corpus/i })).toBeDefined()
    expect(await screen.findByText("Casa")).toBeDefined()
  })

  it("el empty state ofrece crear la primera ficha", async () => {
    mockFetchWords([])
    const user = userEvent.setup()
    render(<AdminPalabrasPage />)

    expect(await screen.findByText("No se encontraron palabras")).toBeDefined()
    const botones = screen.getAllByRole("button", { name: "Nueva ficha" })
    expect(botones.length).toBeGreaterThan(0)
    await user.click(botones[0])
    // El modal de creación se abre (título del modal presente)
    expect(await screen.findByRole("heading", { name: "Nueva ficha" })).toBeDefined()
  })
})
