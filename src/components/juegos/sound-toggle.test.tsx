import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SoundToggle } from "./sound-toggle"
import { isSoundMuted } from "@/lib/game-sound"

describe("SoundToggle [Fase 2]", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("alterna el mute y lo persiste en localStorage", async () => {
    const user = userEvent.setup()
    render(<SoundToggle />)

    expect(isSoundMuted()).toBe(false)
    await user.click(
      screen.getByRole("button", { name: /silenciar sonido/i })
    )
    expect(isSoundMuted()).toBe(true)
    expect(
      screen.getByRole("button", { name: /activar sonido/i })
    ).toBeDefined()

    await user.click(screen.getByRole("button", { name: /activar sonido/i }))
    expect(isSoundMuted()).toBe(false)
  })

  it("respeta el flag persistido al montar", () => {
    localStorage.setItem("piiyaak:game:sound-muted", "1")
    render(<SoundToggle />)
    expect(
      screen.getByRole("button", { name: /activar sonido/i })
    ).toBeDefined()
  })
})
