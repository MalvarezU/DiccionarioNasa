import { test, expect } from "@playwright/test"

const CURSO = "Nasa Yuwe Básico"

test.describe("editor de texto — tipografía unificada", () => {
  test("el h1 del editor y el de la vista previa usan la misma fuente serif", async ({ page }) => {
    await page.goto("/admin/cursos", { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: new RegExp(CURSO) }).first().click()
    const filas = page.locator('[data-testid="lesson-row"]')
    await filas.first().waitFor()
    await filas.first().getByRole("button", { name: /Contenido de lección/ }).click()

    // La edición vive en página propia (ya no es un dialog)
    await expect(page).toHaveURL(/\/lecciones\//, { timeout: 15000 })
    await expect(page.locator("#lesson-title")).toBeVisible({ timeout: 15000 })

    // Bloque de texto nuevo (no se guarda)
    await page.getByRole("button", { name: "Texto", exact: true }).click()
    await page.getByRole("button", { name: "Título 1", exact: true }).click()
    await page.keyboard.type("Título de prueba")
    await page.keyboard.press("Enter")
    await page.keyboard.type("Párrafo de prueba")

    // Fuente calculada del h1 dentro del editor
    const fuenteEditor = await page
      .locator(".ProseMirror h1")
      .filter({ hasText: "Título de prueba" })
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily)

    // Vista previa in-page (modo vista, sin dialog)
    await page.getByRole("button", { name: "Vista previa" }).click()
    await page.getByRole("button", { name: "Volver a edición" }).waitFor({ timeout: 15000 })
    const fuentePreview = await page
      .locator("main h1")
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
