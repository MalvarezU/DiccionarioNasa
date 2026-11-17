import { test, expect, devices } from "@playwright/test";

/**
 * PWA-web: el gesto atrás cierra overlays sin cambiar de ruta.
 * Viewport móvil (la ficha abre como Sheet) contra dev server :3000.
 */
test.use({ ...devices["Pixel 5"] });

test.describe("overlay + gesto atrás", () => {
  // BD gratuita lenta: timeout amplio.
  test.describe.configure({ timeout: 180000 });

  test("atrás cierra la ficha sin cambiar de ruta; el siguiente atrás navega", async ({
    page,
  }) => {
    // Dos entradas previas para que el segundo atrás tenga a dónde navegar.
    await page.goto("/");
    await page.goto("/diccionario");

    await page.getByPlaceholder(/Buscar/).fill("casa");
    const opcion = page.getByRole("option", { name: /casa/i }).first();
    await expect(opcion).toBeVisible({ timeout: 20000 });
    await opcion.click();

    const ficha = page.getByRole("dialog");
    await expect(ficha).toBeVisible({ timeout: 20000 });

    // X visible: 40×40 con nombre en español.
    const cerrar = ficha.getByRole("button", { name: "Cerrar" }).first();
    await expect(cerrar).toBeVisible();
    const caja = await cerrar.boundingBox();
    expect(caja?.width).toBe(40);
    expect(caja?.height).toBe(40);
    await page.screenshot({ path: "test-results/overlay-back-ficha.png" });

    // 1.er atrás: cierra la hoja, la URL sigue en /diccionario.
    await page.goBack();
    await expect(ficha).toBeHidden({ timeout: 10000 });
    expect(page.url()).toContain("/diccionario");

    // 2.º atrás: ya sin overlay, navega de verdad (vuelve a la portada).
    await page.goBack();
    await expect(page).not.toHaveURL(/\/diccionario/);
  });
});
