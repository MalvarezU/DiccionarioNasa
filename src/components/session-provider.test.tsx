import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
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
