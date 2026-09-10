import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// next-auth/react intenta consultar `/api/auth/session` (y loguear a
// `/api/auth/_log`) al montarse; mockeamos el proveedor para aislar el test.
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { SessionProvider } from "./session-provider"

describe("SessionProvider", () => {
  it("renders children wrapped in NextAuth SessionProvider", () => {
    render(
      <SessionProvider>
        <div data-testid="child">test content</div>
      </SessionProvider>
    )
    expect(screen.getByTestId("child")).toBeDefined()
    expect(screen.getByText("test content")).toBeDefined()
  })
})
