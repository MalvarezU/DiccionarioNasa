import { vi, describe, it, expect, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

vi.mock("./welcome-modal", () => ({
  WelcomeModal: ({ email }: { email: string }) => <div data-testid="welcome-modal">{email}</div>,
}))

import { useSession } from "next-auth/react"
import { WelcomeGate } from "./welcome-gate"

function mockSession(status: "authenticated" | "unauthenticated", email?: string) {
  vi.mocked(useSession).mockReturnValue({
    data: status === "authenticated" ? { user: { email, name: "Test" }, expires: "2099" } : null,
    status,
    update: vi.fn(),
  } as never)
}

describe("WelcomeGate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("renders nothing when unauthenticated and never fetches", () => {
    mockSession("unauthenticated")
    const { container } = render(<WelcomeGate />)
    expect(container.innerHTML).toBe("")
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("opens the welcome modal when onboardedAt is null", async () => {
    mockSession("authenticated", "nuevo@test.com")
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ user: { email: "nuevo@test.com", name: null, onboardedAt: null } })
    )
    render(<WelcomeGate />)

    await waitFor(() => expect(screen.getByTestId("welcome-modal")).toBeDefined())
    expect(global.fetch).toHaveBeenCalledWith("/api/user/profile")
  })

  it("stays closed when onboarding is already complete", async () => {
    mockSession("authenticated", "viejo@test.com")
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({
        user: { email: "viejo@test.com", name: "Viejo", onboardedAt: new Date().toISOString() },
      })
    )
    const { container } = render(<WelcomeGate />)

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(container.querySelector('[data-testid="welcome-modal"]')).toBeNull()
  })
})
