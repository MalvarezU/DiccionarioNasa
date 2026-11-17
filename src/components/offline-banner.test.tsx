import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"

vi.mock("@/hooks/use-online-status", () => ({
  useOnlineStatus: vi.fn(),
}))

import { useOnlineStatus } from "@/hooks/use-online-status"
import { OfflineBanner } from "./offline-banner"

describe("OfflineBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("no renderiza online", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    const { container } = render(<OfflineBanner />)
    expect(container.innerHTML).toBe("")
  })

  it("muestra banda persistente con CTA offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    const { container } = render(<OfflineBanner />)
    expect(container.textContent).toMatch(/sin conexi/i)
    const link = container.querySelector('a[href="/offline"]')
    expect(link?.textContent).toMatch(/ver lo disponible/i)
  })
})
