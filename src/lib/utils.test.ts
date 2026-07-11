import { describe, it, expect } from "vitest"
import { cn, safeParseExamples } from "@/lib/utils"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "end")).toBe("base end")
  })

  it("handles clsx array syntax", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c")
  })

  it("resolves tailwind conflicts (twMerge)", () => {
    expect(cn("px-4", "px-2")).toBe("px-2")
  })

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("")
  })

  it("ignores falsy values", () => {
    expect(cn("a", undefined, null, "", "b")).toBe("a b")
  })
})

describe("safeParseExamples", () => {
  it("parses valid JSON string", () => {
    expect(safeParseExamples('[{"spanish":"casa"}]')).toEqual([
      { spanish: "casa" },
    ])
  })

  it("returns null for null input", () => {
    expect(safeParseExamples(null)).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(safeParseExamples("")).toBeNull()
  })

  it("returns null for invalid JSON", () => {
    expect(safeParseExamples("dialecto Wila\"")).toBeNull()
  })

  it("returns null for partially valid JSON", () => {
    expect(safeParseExamples("[invalid")).toBeNull()
  })

  it("parses empty array JSON", () => {
    expect(safeParseExamples("[]")).toEqual([])
  })
})
