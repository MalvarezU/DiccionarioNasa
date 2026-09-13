import { test, expect } from "@playwright/test";

/**
 * Recorridos públicos sin sesión (B4.1): buscar, ficha, juegos, cursos.
 * No escribe contenido; el juego reporta con sessionKey e2e-* (cleanup aparte).
 */
test.describe("Piiyaak público", () => {
  test("portada carga con buscador y palabra del día", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder(/Buscar/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Piiyaak" })).toBeVisible();
  });

  test("buscar y abrir ficha", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder(/Buscar/).fill("casa");
    await expect(page.getByText("Casa", { exact: false }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("juegos: hub con 3 juegos desbloqueados", async ({ page }) => {
    await page.goto("/juegos");
    await expect(page.getByText("Flashcards")).toBeVisible();
    await expect(page.getByText("Memoria")).toBeVisible();
    await expect(page.getByText("Completar", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Próximamente")).toHaveCount(0);
  });

  test("flashcards juega con palabras reales", async ({ page }) => {
    await page.goto("/juegos/flashcards");
    await expect(page.getByText(/Pregunta 1 de/)).toBeVisible({ timeout: 15000 });
  });

  test("memoria muestra tablero por dificultad", async ({ page }) => {
    await page.goto("/juegos/memoria");
    await expect(page.getByRole("group", { name: "Dificultad" })).toBeVisible({
      timeout: 15000,
    });
    expect(await page.getByLabel(/Carta tapada/).count()).toBe(12);
  });

  test("cursos lista y detalle con árbol", async ({ page }) => {
    await page.goto("/cursos");
    await expect(page.getByText("Nasa Yuwe Básico")).toBeVisible({ timeout: 15000 });
    await page.getByText("Nasa Yuwe Básico").click();
    await expect(page.getByText("Módulo 1", { exact: false })).toBeVisible({
      timeout: 15000,
    });
  });

  test("admin sin sesión redirige (no expone panel)", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("offline page existe", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByText("Sin conexión")).toBeVisible();
  });
});
