import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { InstallSection } from "./install-section"
import { resetInstallPromptForTests } from "./use-install-prompt"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const matchMediaOrig = window.matchMedia
const userAgentOrig = window.navigator.userAgent

function mockMatchMedia(standalone: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: standalone && q === "(display-mode: standalone)",
    })),
  })
}

function mockUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    writable: true,
    configurable: true,
    value: ua,
  })
}

/** Simula un navegador Chromium instalable: dispara beforeinstallprompt retenible. */
function dispararPromptNativo() {
  const prompt = vi.fn(async () => {})
  const evento = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
  }
  evento.prompt = prompt
  evento.userChoice = Promise.resolve({ outcome: "accepted" })
  window.dispatchEvent(evento)
  return { prompt }
}

describe("InstallSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetInstallPromptForTests()
    mockMatchMedia(false)
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
    mockUserAgent(userAgentOrig)
  })

  it("muestra las 2 plataformas, QR y copiar enlace", () => {
    render(<InstallSection />)
    expect(screen.getByText("Android / Chrome")).toBeDefined()
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

  it("sin prompt nativo los botones siguen visibles y abren el diálogo", () => {
    render(<InstallSection />)
    const android = screen.getByRole("button", { name: "Instalar ahora" })
    const escritorio = screen.getByRole("button", { name: "Instalar en el equipo" })
    expect(android).toBeDefined()
    expect(escritorio).toBeDefined()
    expect(android).toHaveAttribute("aria-haspopup", "dialog")
  })

  it("sin prompt: Android abre el modal con sus pasos manuales", async () => {
    render(<InstallSection />)
    fireEvent.click(screen.getByRole("button", { name: "Instalar ahora" }))
    const dialogo = await screen.findByRole("dialog")
    expect(dialogo.textContent ?? "").toContain("Abrí esta página en Chrome de Android")
    expect(dialogo.textContent ?? "").toContain("Instalar aplicación")
  })

  it("sin prompt: Escritorio abre el modal con sus pasos manuales", async () => {
    render(<InstallSection />)
    fireEvent.click(screen.getByRole("button", { name: "Instalar en el equipo" }))
    const dialogo = await screen.findByRole("dialog")
    expect(dialogo.textContent ?? "").toContain("icono de instalación en la barra")
  })

  it("el modal se cierra con su botón de cierre", async () => {
    render(<InstallSection />)
    fireEvent.click(screen.getByRole("button", { name: "Instalar ahora" }))
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
  })

  it("con prompt nativo instala directo sin abrir el modal", async () => {
    render(<InstallSection />)
    const { prompt } = dispararPromptNativo()
    const boton = await screen.findByRole("button", { name: "Instalar ahora" })
    expect(boton).not.toHaveAttribute("aria-haspopup")
    fireEvent.click(boton)
    await waitFor(() => {
      expect(prompt).toHaveBeenCalled()
    })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("en iOS el modal muestra los pasos de Safari", async () => {
    mockUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    )
    render(<InstallSection />)
    fireEvent.click(screen.getByRole("button", { name: "Instalar ahora" }))
    const dialogo = await screen.findByRole("dialog")
    expect(dialogo.textContent ?? "").toContain("Añadir a pantalla de inicio")
  })

  it("instalada: botones deshabilitados con estado final", () => {
    mockMatchMedia(true)
    render(<InstallSection />)
    const botones = screen.getAllByRole("button", { name: "Ya instalada" })
    expect(botones).toHaveLength(2)
    for (const boton of botones) {
      expect(boton).toHaveProperty("disabled", true)
    }
  })
})
