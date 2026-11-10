import { describe, expect, it } from "vitest"

import { htmlToPlainText } from "./html-to-text"

// Conversión HTML del editor rico -> texto plano para prompt/question.
// El render del estudiante usa white-space normal, así que los bloques y
// los <br> colapsan a un solo espacio (ver html-to-text.ts).
describe("htmlToPlainText", () => {
  it("un <br> separa con un espacio", () => {
    expect(htmlToPlainText("hola<br>mundo")).toBe("hola mundo")
  })

  it("descarta el formato inline pero conserva el texto anidado", () => {
    expect(htmlToPlainText("<p>Hola <strong>mundo</strong> <em>!</em></p>")).toBe("Hola mundo !")
  })

  it("pasa el texto sin tags y el vacío tal cual", () => {
    expect(htmlToPlainText("solo texto")).toBe("solo texto")
    expect(htmlToPlainText("")).toBe("")
  })
})
