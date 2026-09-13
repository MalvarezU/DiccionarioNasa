import { test, expect, type Page } from "@playwright/test";

/**
 * Flujos de usuario autenticado (proyecto "user", con storageState).
 * Sin escrituras destructivas: favoritas/historial/progreso del e2e-user
 * se borran en cascada con el usuario (teardown).
 */
test.describe("usuario Piiyaak", () => {
  // La BD gratuita responde 3-12 s bajo carga: timeouts amplios
  test.describe.configure({ timeout: 120000 });

  /** Abre una ficha desde el buscador (cierra diálogos previos). */
  async function openWord(page: Page, term: string, optionRe: RegExp) {
    await page.keyboard.press("Escape").catch(() => {});
    await page.getByPlaceholder(/Buscar/).fill(term);
    const option = page.getByRole("option", { name: optionRe }).first();
    await expect(option).toBeVisible({ timeout: 20000 });
    await option.click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: new RegExp(term, "i") })
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /favorit/i }).first()).toBeVisible({
      timeout: 20000,
    });
  }

  test("favorita persiste al recargar", async ({ page }) => {
    await page.goto("/");
    await openWord(page, "Casa", /casa/i);

    const favBtn = page.getByRole("button", { name: /guardar en favoritos/i });
    await expect(favBtn).toBeVisible({ timeout: 10000 });
    await favBtn.click();
    await expect(
      page.getByRole("button", { name: /quitar de favoritos/i })
    ).toBeVisible({ timeout: 20000 });

    await page.reload();
    await openWord(page, "Casa", /casa/i);
    await expect(
      page.getByRole("button", { name: /quitar de favoritos/i })
    ).toBeVisible({ timeout: 15000 });

    // Limpieza: quitarla
    await page.getByRole("button", { name: /quitar de favoritos/i }).click();
    await expect(
      page.getByRole("button", { name: /guardar en favoritos/i })
    ).toBeVisible({ timeout: 20000 });
  });

  test("historial registra la visita", async ({ page }) => {
    await page.goto("/");
    await openWord(page, "Agua", /agua/i);

    // Cerrar la ficha (el overlay tapa el menú de usuario)
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /E2E User/ }).click();
    await page.getByRole("menuitem", { name: /mi historial/i }).click();
    await expect(page.getByText("Agua").first()).toBeVisible({ timeout: 15000 });
  });

  test("curso: completar lección persiste progreso", async ({ page, request }) => {
    const list = await request.get("/api/courses");
    expect(list.ok()).toBe(true);
    const { courses } = await list.json();
    expect(courses.length).toBeGreaterThan(0);
    const courseId = courses[0].id as string;

    await page.goto(`/cursos/${courseId}`);
    await expect(page.getByText("0/", { exact: false }).first()).toBeVisible({
      timeout: 15000,
    });
    // Primera lección del módulo abierto por defecto
    const completeBtn = page.getByRole("button", { name: /marcar como completada/i }).first();
    // Puede requerir abrir la lección primero
    const lessonBtn = page.getByRole("button", { name: /lección 1\.1/i }).first();
    if (await lessonBtn.isVisible().catch(() => false)) {
      await lessonBtn.click();
    }
    await completeBtn.click();
    await expect(page.getByText("1/", { exact: false }).first()).toBeVisible({
      timeout: 10000,
    });

    await page.reload();
    await expect(page.getByText("1/", { exact: false }).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("logout cierra la sesión", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /E2E User/ }).click();
    await page.getByRole("menuitem", { name: /cerrar sesión/i }).click();
    await expect(
      page.getByRole("button", { name: /iniciar sesión/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
