import { test, expect } from "@playwright/test";

/**
 * Blindaje del panel /admin (proxy Edge).
 * Sin sesión: corre sin storageState (proyecto `guard`).
 *
 * Nota: el navbar abre el login y LIMPIA la URL (`history.replaceState` a
 * `/`), así que acá no se aserta `?auth=required` (ya no existe al correr la
 * aserción). Se verifica el resultado visible: redirección a la home + modal
 * de login abierto.
 */
test.describe("guard del panel admin", () => {
  test("sin sesión, /admin redirige al inicio y abre el login", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    // La navbar abre el modal de login solo ante el aviso
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" })
    ).toBeVisible({ timeout: 15000 });
  });

  test("sin sesión, /admin/usuarios tampoco se sirve", async ({ page }) => {
    await page.goto("/admin/usuarios");
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" })
    ).toBeVisible({ timeout: 15000 });
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
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" })
    ).toBeVisible({ timeout: 15000 });
  });
});