import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { InstallSection } from "./install-section"
import { resetInstallPromptForTests } from "./use-install-prompt"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const matchMediaOrig = window.matchMedia

describe("InstallSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetInstallPromptForTests()
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({ matches: false })),
    })
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { ...window.location, origin: "https://piiyaak.test" },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: matchMediaOrig,
    })
  })

  it("muestra las 3 plataformas, QR y copiar enlace", () => {
    render(<InstallSection />)
    expect(screen.getByText("Android / Chrome")).toBeDefined()
    expect(screen.getByText("iPhone / iPad")).toBeDefined()
    expect(screen.getByText("Escritorio")).toBeDefined()
    expect(screen.getByRole("img", { name: /Código QR/ })).toBeDefined()
    expect(screen.getByText("https://piiyaak.test")).toBeDefined()
  })

  it("copiar enlace confirma visualmente", async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, "clipboard", {
      writable: true,
      configurable: true,
      value: { writeText },
    })
    render(<InstallSection />)
    fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }))
    await screen.findByText("¡Copiado!")
    expect(writeText).toHaveBeenCalledWith("https://piiyaak.test")
  })

  it("sin prompt nativo muestra pasos manuales, no botones rotos", () => {
    render(<InstallSection />)
    expect(screen.getByText(/Abrí esta página en Chrome/)).toBeDefined()
    expect(screen.getByText(/icono de instalación en la barra/)).toBeDefined()
    expect(screen.queryByRole("button", { name: "Instalar ahora" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Instalar en el equipo" })).toBeNull()
  })
})
