import { test, expect } from "@playwright/test"

const CURSO = "Nasa Yuwe Básico"

test.describe("editor de texto — tipografía unificada", () => {
  test("el h1 del editor y el de la vista previa usan la misma fuente serif", async ({ page }) => {
    await page.goto("/admin/courses", { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: new RegExp(CURSO) }).first().click()
    const filas = page.locator('[data-testid="lesson-row"]')
    await filas.first().waitFor()
    await filas.first().getByRole("button", { name: /Contenido de lección/ }).click()

    const dialogo = page.getByRole("dialog").filter({ hasText: "Contenido ·" })
    await dialogo.waitFor()

    // Bloque de texto nuevo (no se guarda)
    await dialogo.getByRole("button", { name: "Texto", exact: true }).click()
    await dialogo.getByRole("button", { name: "Título 1", exact: true }).last().click()
    await page.keyboard.type("Título de prueba")
    await page.keyboard.press("Enter")
    await page.keyboard.type("Párrafo de prueba")

    // Fuente calculada del h1 dentro del editor
    const fuenteEditor = await dialogo
      .locator(".ProseMirror h1")
      .filter({ hasText: "Título de prueba" })
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily)

    await dialogo.getByRole("button", { name: /Vista previa: exactamente/ }).click()
    const preview = page.getByRole("dialog").filter({ hasText: "Vista previa —" })
    await preview.waitFor()
    const fuentePreview = await preview
      .locator("h1")
      .filter({ hasText: "Título de prueba" })
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily)

    // Ambos lados deben resolver a Newsreader (la variable montada por next/font).
    expect(fuenteEditor.toLowerCase()).toContain("newsreader")
    expect(fuentePreview.toLowerCase()).toContain("newsreader")
    // Y deben coincidir entre sí.
    expect(fuenteEditor).toBe(fuentePreview)
  })
})
