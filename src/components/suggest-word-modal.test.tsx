import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

import { useToast } from "@/hooks/use-toast"
import { SuggestWordModal } from "./suggest-word-modal"

const onOpenChange = vi.fn()

describe("SuggestWordModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    vi.mocked(useToast).mockReturnValue({ toast: vi.fn() })
  })

  it("renders the form with term pre-filled", () => {
    render(
      <SuggestWordModal
        open={true}
        onOpenChange={onOpenChange}
        initialTerm="test word"
      />
    )
    expect(screen.getByText("Sugerir una palabra")).toBeDefined()
    expect(screen.getByDisplayValue("test word")).toBeDefined()
  })

  it("submit button is disabled when term is empty", () => {
    render(
      <SuggestWordModal
        open={true}
        onOpenChange={onOpenChange}
        initialTerm=""
      />
    )
    expect(screen.getByRole("button", { name: /enviar sugerencia/i })).toBeDisabled()
  })

  it("submit button is enabled when term is not empty", () => {
    render(
      <SuggestWordModal
        open={true}
        onOpenChange={onOpenChange}
        initialTerm="test word"
      />
    )
    expect(screen.getByRole("button", { name: /enviar sugerencia/i })).toBeEnabled()
  })

  it("calls fetch on submit and shows success toast", async () => {
    const { toast } = vi.mocked(useToast)()
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ok: true }))
    const user = userEvent.setup()

    render(
      <SuggestWordModal
        open={true}
        onOpenChange={onOpenChange}
        initialTerm="palabra"
      />
    )
    await user.click(screen.getByRole("button", { name: /enviar sugerencia/i }))

    expect(fetch).toHaveBeenCalledWith("/api/dictionary/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: "palabra", comment: "" }),
    })
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "¡Sugerencia enviada!" })
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows error toast when submit fails", async () => {
    const { toast } = vi.mocked(useToast)()
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))
    const user = userEvent.setup()

    render(
      <SuggestWordModal
        open={true}
        onOpenChange={onOpenChange}
        initialTerm="test"
      />
    )
    await user.click(screen.getByRole("button", { name: /enviar sugerencia/i }))

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error al enviar" })
    )
  })
})
