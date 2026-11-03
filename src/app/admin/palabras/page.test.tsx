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

  // ═══════════════════════════════════════
  // Modales (mudados desde el Resumen en F3: misma UI, nuevo hogar)
  // ═══════════════════════════════════════

  const mockWordRow = {
    id: "w1",
    spanish: "agua",
    nasaYuwe: "yu'",
    pronunciation: "",
    audioUrl: null,
    culturalContext: "",
    category: "sustantivo",
    status: "PUBLISHED",
  }

  function mockWordsList() {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ words: [mockWordRow], totalPages: 1, total: 1 })
    )
  }

  it("opens CreateWordModal and renders form fields", async () => {
    mockWordsList()
    const user = userEvent.setup()
    render(<AdminPalabrasPage />)
    await user.click(screen.getAllByRole("button", { name: "Nueva ficha" })[0])
    expect(screen.getByText("Crea una nueva entrada en el diccionario bilingüe")).toBeDefined()
    expect(screen.getByPlaceholderText("palabra en español")).toBeDefined()
    expect(screen.getByPlaceholderText("palabra en nasa yuwe")).toBeDefined()
  })

  it("CreateWordModal validates required fields", async () => {
    mockWordsList()
    const user = userEvent.setup()
    render(<AdminPalabrasPage />)
    await user.click(screen.getAllByRole("button", { name: "Nueva ficha" })[0])
    await user.click(screen.getByText("Guardar como borrador"))
    expect(screen.getByText(/El campo.*Español.*es obligatorio/)).toBeDefined()
    expect(screen.getByText(/El campo.*Nasa Yuwe.*es obligatorio/)).toBeDefined()
  })

  it("CreateWordModal submits and shows success", async () => {
    mockWordsList()
    const user = userEvent.setup()
    render(<AdminPalabrasPage />)
    await user.click(screen.getAllByRole("button", { name: "Nueva ficha" })[0])
    await user.type(screen.getByPlaceholderText("palabra en español"), "sol")
    await user.type(screen.getByPlaceholderText("palabra en nasa yuwe"), "ate")
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "ok" }))
    await user.click(screen.getByText("Guardar como borrador"))
    expect(await screen.findByText("Ficha guardada como borrador")).toBeDefined()
  })

  it("CreateWordModal submits and publishes", async () => {
    mockWordsList()
    const user = userEvent.setup()
    render(<AdminPalabrasPage />)
    await user.click(screen.getAllByRole("button", { name: "Nueva ficha" })[0])
    await user.type(screen.getByPlaceholderText("palabra en español"), "luna")
    await user.type(screen.getByPlaceholderText("palabra en nasa yuwe"), "ate")
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: "ok" }))
    await user.click(screen.getByText("Guardar y publicar"))
    expect(await screen.findByText("Ficha guardada y publicada")).toBeDefined()
  })

  it("opens ImportCorpusModal and shows format info", async () => {
    mockWordsList()
    const user = userEvent.setup()
    render(<AdminPalabrasPage />)
    await user.click(screen.getByRole("button", { name: /Importar corpus/i }))
    expect(await screen.findByText("Subir archivo Excel o CSV")).toBeDefined()
    expect(screen.getByText(/Todo entra en borrador/)).toBeDefined()
  })

  it("ImportCorpusModal previews file before confirm [B1.10]", async () => {
    mockWordsList()
    const user = userEvent.setup()
    render(<AdminPalabrasPage />)
    await user.click(screen.getByRole("button", { name: /Importar corpus/i }))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        fileName: "corpus.xlsx",
        columns: [{ header: "Palabra_esp", mapped: "spanish" }],
        total: 2,
        valid: 2,
        invalid: 0,
        duplicates: 0,
        errors: [],
        previewToken: "tok",
      })
    )
    await user.upload(
      input,
      new File(["x"], "corpus.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    )
    expect(await screen.findByText(/Vista previa/)).toBeDefined()
    expect(screen.getByText(/Confirmar \(2 en borrador\)/)).toBeDefined()
  })

  it("inline list to EditWordModal flow", async () => {
    mockWordsList()
    const user = userEvent.setup()
    render(<AdminPalabrasPage />)
    expect(await screen.findByText("agua")).toBeDefined()
    await user.click(screen.getByText("Editar"))
    expect(await screen.findByText("Editar ficha")).toBeDefined()
    expect(screen.getByDisplayValue("agua")).toBeDefined()
    expect(screen.getByDisplayValue("yu'")).toBeDefined()
  })
})
