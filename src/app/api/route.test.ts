import { describe, it, expect } from "vitest"
import { GET } from "./route"

describe("GET /api", () => {
  it("returns hello world message", async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.message).toBe("Hello, world!")
  })

  it("returns 200 status", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
  })
})