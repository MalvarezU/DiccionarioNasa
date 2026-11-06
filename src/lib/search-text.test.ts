import { describe, it, expect } from "vitest"
import { normalizeSearchText } from "./search-text"

describe("normalizeSearchText", () => {
  it("insensible a mayúsculas y tildes", () => {
    expect(normalizeSearchText("Maíz sagrado")).toBe("maiz sagrado")
    expect(normalizeSearchText("MAÍZ").includes("maiz")).toBe(true)
  })

  it("cadena vacía y espacios", () => {
    expect(normalizeSearchText("")).toBe("")
    expect(normalizeSearchText("  ")).toBe("  ")
  })
})
