import { describe, it, expect } from "vitest"
import { matchIllustrationFiles } from "./bulk-match"

const WORDS = [
  { id: "w1", spanish: "Casa", nasaYuwe: "Yat" },
  { id: "w2", spanish: "Agua", nasaYuwe: "Yu'" },
  { id: "w3", spanish: "Luna", nasaYuwe: "A'te" },
]

describe("matchIllustrationFiles", () => {
  it("matchea por español o nasa yuwe sin importar acentos ni mayúsculas", () => {
    const { matched, unmatched } = matchIllustrationFiles(
      [{ name: "casa.png" }, { name: "YAT.webp" }, { name: "Água.jpg" }],
      WORDS
    )
    expect(matched.map((m) => m.wordId)).toEqual(["w1", "w1", "w2"])
    expect(unmatched).toEqual([])
  })

  it("matchea por extensión cualquiera y apóstrofes", () => {
    const { matched } = matchIllustrationFiles([{ name: "a'te.jpeg" }], WORDS)
    expect(matched[0]).toMatchObject({ wordId: "w3" })
  })

  it("sin coincidencia no se adivina", () => {
    const { matched, unmatched } = matchIllustrationFiles([{ name: "perro.png" }], WORDS)
    expect(matched).toEqual([])
    expect(unmatched).toEqual([{ file: { name: "perro.png" }, reason: "sin coincidencia" }])
  })

  it("ambiguo (misma forma en dos fichas) no se adivina", () => {
    const dupes = [
      ...WORDS,
      { id: "w9", spanish: "Casa", nasaYuwe: "Yat2" },
    ]
    const { matched, unmatched } = matchIllustrationFiles([{ name: "casa.png" }], dupes)
    expect(matched).toEqual([])
    expect(unmatched).toEqual([{ file: { name: "casa.png" }, reason: "ambiguo" }])
  })

  it("nombre vacío o sin stem no matchea", () => {
    const { unmatched } = matchIllustrationFiles([{ name: ".png" }, { name: "" }], WORDS)
    expect(unmatched).toHaveLength(2)
  })
})
