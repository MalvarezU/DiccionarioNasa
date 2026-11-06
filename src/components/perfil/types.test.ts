import { describe, it, expect } from "vitest"
import { groupHistoryByDate, parsePerfilTab } from "./types"

describe("parsePerfilTab", () => {
  it("defaults to favorites on null, empty or unknown", () => {
    expect(parsePerfilTab(null)).toBe("favorites")
    expect(parsePerfilTab("")).toBe("favorites")
    expect(parsePerfilTab("nope")).toBe("favorites")
  })

  it("parses english tab values", () => {
    expect(parsePerfilTab("favorites")).toBe("favorites")
    expect(parsePerfilTab("history")).toBe("history")
    expect(parsePerfilTab("progress")).toBe("progress")
  })

  it("parses spanish aliases", () => {
    expect(parsePerfilTab("favoritos")).toBe("favorites")
    expect(parsePerfilTab("historial")).toBe("history")
    expect(parsePerfilTab("avance")).toBe("progress")
    expect(parsePerfilTab("progreso")).toBe("progress")
    expect(parsePerfilTab("mi-avance")).toBe("progress")
  })
})

describe("groupHistoryByDate", () => {
  it("groups entries sharing the same day", () => {
    const grouped = groupHistoryByDate([
      { createdAt: "2026-03-15T10:00:00.000Z" },
      { createdAt: "2026-03-15T14:00:00.000Z" },
      { createdAt: "2026-03-16T10:00:00.000Z" },
    ])
    expect(Object.keys(grouped)).toHaveLength(2)
    expect(Object.values(grouped).map((g) => g.length).sort()).toEqual([1, 2])
  })

  it("returns empty object for empty history", () => {
    expect(groupHistoryByDate([])).toEqual({})
  })
})
