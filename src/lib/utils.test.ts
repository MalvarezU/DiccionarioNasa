import { describe, it, expect } from "vitest"
import { cn } from "@/lib/utils"

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
