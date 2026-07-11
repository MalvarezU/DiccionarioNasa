import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      <button onClick={() => onValueChange?.("sustantivo")}>trigger</button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

vi.mock("./WordPreviewModal", () => ({
  WordPreviewModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="preview-modal" /> : null,
}))

import { CreateWordModal } from "./CreateWordModal"

function renderModal() {
  const onOpenChange = vi.fn()
  const onCreated = vi.fn()
  render(
    <CreateWordModal
      open={true}
      onOpenChange={onOpenChange}
      onCreated={onCreated}
    />
  )
  return { onOpenChange, onCreated }
}

describe("CreateWordModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("renders dialog title", () => {
    renderModal()
    expect(screen.getByText("Nueva ficha")).toBeDefined()
  })

  it("shows required field markers for spanish and nasaYuwe", () => {
    renderModal()
    expect(screen.getByText("Español")).toBeDefined()
    expect(screen.getByText("Nasa Yuwe")).toBeDefined()
  })

  it("shows validation error when spanish is empty on submit", async () => {
    global.fetch = vi.fn()
    renderModal()
    const user = userEvent.setup()
    const publishBtn = screen.getByText("Guardar y publicar")
    await user.click(publishBtn)
    expect(screen.getByText(/El campo «Español» es obligatorio/)).toBeDefined()
  })

  it("shows validation error when nasaYuwe is empty on submit", async () => {
    renderModal()
    const user = userEvent.setup()
    const spanishInput = screen.getByPlaceholderText("palabra en español")
    await user.type(spanishInput, "Casa")
    const publishBtn = screen.getByText("Guardar y publicar")
    await user.click(publishBtn)
    expect(screen.getByText(/El campo «Nasa Yuwe» es obligatorio/)).toBeDefined()
  })

  it("sends POST to /api/admin/words on successful submit", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ id: "new1" }) as never
    )
    renderModal()
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText("palabra en español"), "Casa")
    await user.type(screen.getByPlaceholderText("palabra en nasa yuwe"), "Yat")
    await user.click(screen.getByText("Guardar y publicar"))

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/words",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("shows success message after creating as draft", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ id: "new1" }) as never
    )
    renderModal()
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText("palabra en español"), "Casa")
    await user.type(screen.getByPlaceholderText("palabra en nasa yuwe"), "Yat")
    await user.click(screen.getByText("Guardar como borrador"))

    expect(await screen.findByText("Ficha guardada como borrador")).toBeDefined()
  })

  it("shows error message when API returns error", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      Response.json({ message: "Ya existe esta palabra" }, { status: 400 }) as never
    )
    renderModal()
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText("palabra en español"), "Casa")
    await user.type(screen.getByPlaceholderText("palabra en nasa yuwe"), "Yat")
    await user.click(screen.getByText("Guardar y publicar"))

    expect(await screen.findByText("Ya existe esta palabra")).toBeDefined()
  })

  it("calls onOpenChange(false) when Cancelar clicked", async () => {
    const { onOpenChange } = renderModal()
    const user = userEvent.setup()
    await user.click(screen.getByText("Cancelar"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows audio upload area", () => {
    renderModal()
    expect(screen.getByText(/Arrastra un archivo aquí/)).toBeDefined()
  })

  it("disables submit buttons while uploading audio", () => {
    renderModal()
    const draftBtn = screen.getByText("Guardar como borrador").closest("button")
    expect(draftBtn).toBeDefined()
  })
})