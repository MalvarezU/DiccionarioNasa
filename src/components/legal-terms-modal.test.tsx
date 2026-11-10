import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { LegalTermsModal } from "./legal-terms-modal"

describe("LegalTermsModal", () => {
  const onOpenChange = vi.fn()
  const onAccept = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders nothing when closed", () => {
    const { container } = render(
      <LegalTermsModal open={false} onOpenChange={onOpenChange} onAccept={onAccept} />
    )
    expect(container.innerHTML).toBe("")
  })

  it("shows summary and full text of the initial tab", () => {
    render(
      <LegalTermsModal open={true} onOpenChange={onOpenChange} onAccept={onAccept} initialTab="terms" />
    )
    expect(screen.getByRole("heading", { name: /términos y privacidad/i })).toBeDefined()
    expect(screen.getByText("En resumen")).toBeDefined()
    // Terms summary bullet, user-facing copy
    expect(
      screen.getAllByText(/proyecto de preservación y difusión de la lengua Nasa Yuwe/i).length
    ).toBeGreaterThan(0)
  })

  it("switches to the privacy tab", async () => {
    const user = userEvent.setup()
    render(
      <LegalTermsModal open={true} onOpenChange={onOpenChange} onAccept={onAccept} initialTab="terms" />
    )
    await user.click(screen.getByRole("tab", { name: /política de privacidad/i }))
    expect(
      screen.getByText(/no vendemos ni compartimos tus datos con fines comerciales/i)
    ).toBeDefined()
  })

  it("opens on the privacy tab when requested", () => {
    render(
      <LegalTermsModal open={true} onOpenChange={onOpenChange} onAccept={onAccept} initialTab="privacy" />
    )
    expect(
      screen.getByText(/guardamos tu correo, tu nombre si lo indicas/i)
    ).toBeDefined()
  })

  it("accept calls onAccept and closes", async () => {
    const user = userEvent.setup()
    render(
      <LegalTermsModal open={true} onOpenChange={onOpenChange} onAccept={onAccept} />
    )
    await user.click(screen.getByRole("button", { name: /aceptar términos y privacidad/i }))
    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("close button closes without accepting", async () => {
    const user = userEvent.setup()
    render(
      <LegalTermsModal open={true} onOpenChange={onOpenChange} onAccept={onAccept} />
    )
    await user.click(screen.getByRole("button", { name: /^cerrar$/i }))
    expect(onAccept).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("exposes no implementation details", () => {
    render(
      <LegalTermsModal open={true} onOpenChange={onOpenChange} onAccept={onAccept} initialTab="privacy" />
    )
    const forbidden = ["bcrypt", "supabase", "vercel", "resend", "rate-limit", "https"]
    for (const word of forbidden) {
      expect(screen.queryByText(new RegExp(word, "i"))).toBeNull()
    }
  })
})
