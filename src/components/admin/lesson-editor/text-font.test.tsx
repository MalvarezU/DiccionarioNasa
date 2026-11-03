import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { TEXT_BLOCK_PROSE } from "@/lib/courses/lesson-html"

const EDITOR_SRC = readFileSync(
  resolve(process.cwd(), "src/components/admin/lesson-editor/text-editor.tsx"),
  "utf-8"
)

describe("editor de texto — tipografía única (contrato)", () => {
  it("el EditorContent usa TEXT_BLOCK_PROSE (única fuente de estilo)", () => {
    // El editor no puede tener su propia lista paralela de clases de títulos:
    // eso fue lo que dejó los h1/h2/h3 sin font-serif en el primer bug.
    expect(EDITOR_SRC).toContain("TEXT_BLOCK_PROSE")
  })

  it("no hay clases paralelas [&_h1]:text-xl duplicadas en el editor", () => {
    // Si aparecen, alguien re-introdujo la segunda especificación.
    expect(EDITOR_SRC).not.toMatch(/\[&_h1\]:text-xl \[&_h1\]:font-bold/)
  })

  it("TEXT_BLOCK_PROSE incluye font-serif en los tres niveles de título", () => {
    expect(TEXT_BLOCK_PROSE).toContain("[&_h1]:font-serif")
    expect(TEXT_BLOCK_PROSE).toContain("[&_h2]:font-serif")
    expect(TEXT_BLOCK_PROSE).toContain("[&_h3]:font-serif")
  })
})

describe("globals.css — sin override paralelo de fuente", () => {
  const CSS = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf-8")
  it("no define font-family para .ProseMirror/.tiptap h1 (la fuente vive en TEXT_BLOCK_PROSE)", () => {
    expect(CSS).not.toMatch(/\.ProseMirror\s+h1[\s\S]*?font-family/)
    expect(CSS).not.toMatch(/\.tiptap\s+h1[\s\S]*?font-family/)
  })
})
