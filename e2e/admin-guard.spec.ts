import { test, expect } from "@playwright/test";

/**
 * Blindaje del panel /admin (middleware Edge).
 * Sin sesión: corre sin storageState (proyecto `guard`).
 */
test.describe("guard del panel admin", () => {
  test("sin sesión, /admin redirige al inicio y abre el login", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\?auth=required/, { timeout: 30000 });
    // La navbar abre el modal de login solo ante el aviso
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" })
    ).toBeVisible({ timeout: 15000 });
  });

  test("sin sesión, /admin/usuarios tampoco se sirve", async ({ page }) => {
    await page.goto("/admin/usuarios");
    await expect(page).toHaveURL(/\?auth=required/, { timeout: 30000 });
  });

  test("con cookie de sesión inválida indica sesión expirada", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "next-auth.session-token",
        value: "stale",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/auth=expired/, { timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" })
    ).toBeVisible({ timeout: 15000 });
  });
});
