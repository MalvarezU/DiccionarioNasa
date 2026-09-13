import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import OfflinePage from "./page"

vi.mock("@/components/navbar", () => ({
  NavBar: () => <div data-testid="navbar" />,
}))

describe("/offline [B3.2]", () => {
  it("explica el estado y ofrece reintentar", () => {
    render(<OfflinePage />)
    expect(screen.getByText("Sin conexión")).toBeDefined()
    expect(screen.getByText(/Reintentar inicio/)).toBeDefined()
  })
})
