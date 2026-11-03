import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { InstallBanner } from "./install-banner"
import { resetInstallPromptForTests } from "./use-install-prompt"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function dispararPrompt(): Event {
  const e = new Event("beforeinstallprompt", { cancelable: true })
  ;(e as unknown as { prompt: () => Promise<void> }).prompt = vi.fn(async () => {})
  ;(e as unknown as { userChoice: Promise<{ outcome: string }> }).userChoice = Promise.resolve({ outcome: "accepted" })
  return e
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
  })

  it("con prompt nativo ofrece Instalar directo", async () => {
    render(<InstallBanner />)
    await act(async () => {
      window.dispatchEvent(dispararPrompt())
    })
    expect(screen.getByRole("button", { name: "Instalar" })).toBeDefined()
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
