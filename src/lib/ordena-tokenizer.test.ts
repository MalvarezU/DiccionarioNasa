import { describe, it, expect } from "vitest"
import {
  isOrdenaEligible,
  normalizeOrdenaApos,
  tokenizeOrdena,
} from "./ordena-tokenizer"

describe("ordena-tokenizer", () => {
  it("normaliza ’ (U+2019) y ´ (U+00B4) a apóstrofo", () => {
    expect(normalizeOrdenaApos("Yu’")).toBe("Yu'")
    expect(normalizeOrdenaApos("A´te")).toBe("A'te")
    expect(normalizeOrdenaApos("Yat")).toBe("Yat")
  })

  it("Çu'm → Ç + u' + m (vocal glotal indivisible)", () => {
    expect(tokenizeOrdena("Çu'm")).toEqual(["Ç", "u'", "m"])
  })

  it("Açxa → A + çx + a (cluster çx)", () => {
    expect(tokenizeOrdena("Açxa")).toEqual(["A", "çx", "a"])
  })

  it("E'txh → E' + txh (glotal + trigrafo; solo 2 fichas)", () => {
    expect(tokenizeOrdena("E'txh")).toEqual(["E'", "txh"])
  })

  it("Sxib → Sx + i + b (cluster con mayúscula inicial)", () => {
    expect(tokenizeOrdena("Sxib")).toEqual(["Sx", "i", "b"])
  })

  it("Çxh → Çx + h (greedy: çx gana a çh; solo 2 fichas)", () => {
    expect(tokenizeOrdena("Çxh")).toEqual(["Çx", "h"])
  })

  it("preserva mayúsculas originales y compara en minúscula", () => {
    // TXH en mayúsculas sigue siendo un solo cluster
    expect(tokenizeOrdena("ATXH")).toEqual(["A", "TXH"])
    expect(tokenizeOrdena("Thak")).toEqual(["Th", "a", "k"])
  })

  it("preserva ç/Ç ũ/Ũ ã/Ã y forma ũ'/ã' glotales", () => {
    expect(tokenizeOrdena("Ũ'sa")).toEqual(["Ũ'", "s", "a"])
    expect(tokenizeOrdena("Çãpx")).toEqual(["Ç", "ã", "px"])
  })

  it("normaliza apóstrofos curvos dentro de la palabra", () => {
    expect(tokenizeOrdena("Yu’")).toEqual(["Y", "u'"])
  })

  it("acepta palabras jugables (≥3 fichas, ES distinto)", () => {
    expect(isOrdenaEligible({ spanish: "Casa", nasaYuwe: "Açxa" })).toBe(true)
    expect(isOrdenaEligible({ spanish: "Rana", nasaYuwe: "Sxib" })).toBe(true)
  })

  it("descarta ≤2 fichas, espacios, glosas, ES vacío o idéntico", () => {
    // 2 fichas: nada que ordenar
    expect(isOrdenaEligible({ spanish: "Sol", nasaYuwe: "E'txh" })).toBe(false)
    expect(isOrdenaEligible({ spanish: "X", nasaYuwe: "Çxh" })).toBe(false)
    expect(isOrdenaEligible({ spanish: "Agua", nasaYuwe: "Yu'" })).toBe(false)
    // multi-palabra
    expect(isOrdenaEligible({ spanish: "Buenos días", nasaYuwe: "paya paya" })).toBe(false)
    // glosa con marcador (Esp
    expect(isOrdenaEligible({ spanish: "Casa", nasaYuwe: "Yat (Esp casa)" })).toBe(false)
    // español vacío o idéntico al NY
    expect(isOrdenaEligible({ spanish: "   ", nasaYuwe: "Açxa" })).toBe(false)
    expect(isOrdenaEligible({ spanish: "yat", nasaYuwe: "Yat" })).toBe(false)
  })
})
