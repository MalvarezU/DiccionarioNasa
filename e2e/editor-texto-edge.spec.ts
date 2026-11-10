import { test, expect } from "@playwright/test"

const CURSO = "Nasa Yuwe Básico"
const LECCION_RICA = "Lección 1.3: El saludo (contenido)"

test.describe.configure({ timeout: 180000 })

async function irALeccion(page: import("@playwright/test").Page, titulo: string) {
  await page.goto("/admin/cursos", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: new RegExp(CURSO) }).first().click()
  const filas = page.locator('[data-testid="lesson-row"]')
  await filas.first().waitFor({ timeout: 15000 })
  const fila = page.locator('[data-testid="lesson-row"]').filter({ hasText: titulo }).first()
  await fila.getByRole("button", { name: /Contenido de lección/ }).click()
  await expect(page).toHaveURL(/\/lecciones\//, { timeout: 15000 })
  await expect(page.locator("#lesson-title")).toBeVisible({ timeout: 15000 })
}

test.describe("editor de texto — edge E2E", () => {
  test("autosave persiste el contenido tras recargar la página", async ({ page }) => {
    await irALeccion(page, LECCION_RICA)

    await page.getByRole("button", { name: "Texto", exact: true }).click()
    await page.waitForTimeout(300)
    const editable = page.locator(".ProseMirror").last()
    await editable.waitFor({ state: "visible", timeout: 10000 })
    await editable.click()
    await page.keyboard.type("Autosave E2E prueba")

    await expect(page.getByText(/Guardado ✓/)).toBeVisible({ timeout: 15000 })

    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(page.locator("#lesson-title")).toBeVisible({ timeout: 15000 })
    await expect(page.locator(".ProseMirror").last()).toContainText("Autosave E2E prueba", { timeout: 15000 })
  })

  test("documento limpio no muestra 'Cambios sin guardar'", async ({ page }) => {
    await irALeccion(page, LECCION_RICA)
    await page.waitForTimeout(500)
    await expect(page.getByText("Cambios sin guardar")).not.toBeVisible()
  })

  test("Ctrl+Z dentro del editor deshace a nivel Tiptap", async ({ page }) => {
    await irALeccion(page, LECCION_RICA)

    await page.getByRole("button", { name: "Texto", exact: true }).click()
    await page.waitForTimeout(300)
    const editable = page.locator(".ProseMirror").last()
    await editable.waitFor({ state: "visible", timeout: 10000 })
    await editable.click()
    await page.keyboard.type("Texto para deshacer")
    await expect(editable).toContainText("Texto para deshacer", { timeout: 5000 })

    await page.keyboard.press("Control+z")
    await expect(editable).not.toContainText("Texto para deshacer", { timeout: 5000 })
  })

  test("sanitizer: el payload con <script> no se guarda ni se ejecuta", async ({ page, request }) => {
    await irALeccion(page, LECCION_RICA)
    const lessonId = page.url().match(/\/lecciones\/([^/?]+)/)?.[1]
    expect(lessonId).toBeTruthy()

    let dialogFired = false
    page.on("dialog", (d) => {
      dialogFired = true
      void d.dismiss()
    })

    const res = await request.put(`/api/lessons/${lessonId}`, {
      data: {
        content: {
          version: 2,
          blocks: [{ id: "e2e_xss", type: "text", html: "<p>ok</p><script>window.__XSS__=1;alert('xss')</script>" }],
        },
      },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    const savedHtml = body.lesson?.content?.blocks?.[0]?.html ?? ""
    expect(savedHtml).toContain("ok")
    expect(savedHtml).not.toContain("<script")
    expect(savedHtml).not.toContain("alert")

    await page.reload({ waitUntil: "domcontentloaded" })
    await expect(page.locator("#lesson-title")).toBeVisible({ timeout: 15000 })
    await expect(page.locator(".ProseMirror").last()).toContainText("ok", { timeout: 15000 })
    await page.waitForTimeout(500)
    expect(dialogFired).toBe(false)
  })
})
