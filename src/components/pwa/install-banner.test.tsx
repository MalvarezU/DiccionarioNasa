import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react"
import { InstallBanner } from "./install-banner"
import { resetInstallPromptForTests } from "./use-install-prompt"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function dispararPrompt() {
  const prompt = vi.fn(async () => {})
  const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
  }
  e.prompt = prompt
  e.userChoice = Promise.resolve({ outcome: "accepted" })
  return { evento: e, prompt }
}

const userAgentOrig = window.navigator.userAgent

function mockUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    writable: true,
    configurable: true,
    value: ua,
  })
}

describe("InstallBanner", () => {
  const matchMediaOrig = window.matchMedia

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    resetInstallPromptForTests()
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({ matches: false })),
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

  it("con prompt nativo abre el modal propio en vez de instalar directo", async () => {
    render(<InstallBanner />)
    const { evento, prompt } = dispararPrompt()
    await act(async () => {
      window.dispatchEvent(evento)
    })
    const trigger = screen.getByRole("button", { name: "Instalar" })
    expect(trigger).toBeDefined()
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog")
    fireEvent.click(trigger)
    // El trigger solo abre el modal: el prompt nativo no dispara directo.
    expect(prompt).not.toHaveBeenCalled()
    const dialogo = await screen.findByRole("dialog")
    expect(dialogo.textContent ?? "").toContain("Abrí esta página en Chrome de Android")
    fireEvent.click(screen.getByRole("button", { name: "Instalar ahora" }))
    await waitFor(() => {
      expect(prompt).toHaveBeenCalled()
    })
  })

  it("en iOS el modal del banner muestra los pasos de Safari", async () => {
    mockUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    )
    render(<InstallBanner />)
    const { evento } = dispararPrompt()
    await act(async () => {
      window.dispatchEvent(evento)
    })
    fireEvent.click(screen.getByRole("button", { name: "Instalar" }))
    const dialogo = await screen.findByRole("dialog")
    expect(dialogo.textContent ?? "").toContain("Añadir a pantalla de inicio")
  })

  it("sin prompt ofrece ir a la sección de instalación", () => {
    render(<InstallBanner />)
    expect(screen.getByRole("button", { name: "Cómo instalarla" })).toBeDefined()
  })

  it("descartar persiste 30 días (no reaparece)", () => {
    const { unmount } = render(<InstallBanner />)
    fireEvent.click(screen.getByRole("button", { name: "Ocultar aviso de instalación" }))
    expect(screen.queryByRole("region", { name: "Instalar la aplicación Piiyaak" })).toBeNull()
    expect(Number(localStorage.getItem("pwa-banner-dismissed-at"))).toBeGreaterThan(0)
    unmount()
    render(<InstallBanner />)
    expect(screen.queryByRole("region", { name: "Instalar la aplicación Piiyaak" })).toBeNull()
  })

  it("no se muestra si la PWA ya está instalada", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((q: string) => ({
        matches: q === "(display-mode: standalone)",
      })),
    })
    render(<InstallBanner />)
    expect(screen.queryByRole("region", { name: "Instalar la aplicación Piiyaak" })).toBeNull()
  })
})
