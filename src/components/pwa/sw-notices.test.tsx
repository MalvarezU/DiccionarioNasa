import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { SWNotices } from "./sw-notices"

/**
 * SWNotices: sin serviceWorker (jsdom) renderiza null y no rompe.
 * El flujo con waiting/quota se verifica en E2E (el mock de SW en jsdom
 * mentiría sobre el comportamiento real del worker).
 */
describe("SWNotices", () => {
  it("renderiza null sin service worker ni avisos", () => {
    const { container } = render(<SWNotices />)
    expect(container.innerHTML).toBe("")
  })
})
