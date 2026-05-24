import { describe, it, expect } from "vitest"
import { normalize, getRelevance } from "./route"

describe("normalize", () => {
  it("lowercases", () => {
    expect(normalize("CASA")).toBe("casa")
  })

  it("strips accents", () => {
    expect(normalize("árbol")).toBe("arbol")
  })

  it("handles ñ", () => {
    expect(normalize("muñeca")).toBe("muneca")
  })

  it("handles Ü/ü", () => {
    expect(normalize("pingüino")).toBe("pinguino")
  })

  it("trims whitespace", () => {
    expect(normalize("  casa  ")).toBe("casa")
  })

  it("handles mixed accented uppercase", () => {
    expect(normalize("ÁRBOL")).toBe("arbol")
  })

  it("returns empty for empty string", () => {
    expect(normalize("")).toBe("")
  })

  it("preserves non-letter characters", () => {
    expect(normalize("¡hola!")).toBe("¡hola!")
  })

  it("handles multiple accents and ñ together", () => {
    expect(normalize("canción ñoña")).toBe("cancion nona")
  })
})

describe("getRelevance", () => {
  describe("happy path", () => {
    it("returns 0 for exact match", () => {
      expect(getRelevance("casa", "casa")).toBe(0)
    })

    it("returns 0 despite accent differences", () => {
      expect(getRelevance("árbol", "arbol")).toBe(0)
    })

    it("returns 0 despite case differences", () => {
      expect(getRelevance("CASA", "casa")).toBe(0)
    })

    it("returns 1 for prefix match", () => {
      expect(getRelevance("casa", "cas")).toBe(1)
    })

    it("returns 2 for partial match", () => {
      expect(getRelevance("casa", "as")).toBe(2)
    })

    it("returns 3 for no match", () => {
      expect(getRelevance("casa", "xyz")).toBe(3)
    })
  })

  describe("edge cases", () => {
    it("returns 1 when query is empty (startsWith returns true for empty)", () => {
      expect(getRelevance("casa", "")).toBe(1)
    })

    it("returns 3 when field is empty and query is not", () => {
      expect(getRelevance("", "a")).toBe(3)
    })

    it("matches on both fields equally", () => {
      expect(getRelevance("sol", "sol")).toBe(0)
      expect(getRelevance("sol", "so")).toBe(1)
      expect(getRelevance("sol", "ol")).toBe(2)
    })

    it("handles special regex characters safely", () => {
      expect(getRelevance("casa (hogar)", "hogar")).toBe(2)
    })

    it("partial match when punctuation remains in normalized field", () => {
      expect(getRelevance("¿cómo?", "como")).toBe(2)
    })
  })
})
