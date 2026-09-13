import { test as setup, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { config as dotenv } from "dotenv";

dotenv({ path: path.resolve(__dirname, "../.env") });

const AUTH_DIR = path.resolve(__dirname, ".auth");

// Setup con bcrypt cost 12 + BD gratuita lenta: margen amplio
setup.describe.configure({ timeout: 180000 });

/** Registro + login de usuario de prueba por UI; verificación directa en BD. */
setup("autentica usuario de prueba", async ({ page }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const stamp = Date.now();
  const email = `e2e-${stamp}@test.local`;
  const password = `E2ePass-${stamp}!`;

  await page.goto("/");
  await page.getByRole("button", { name: /iniciar sesión/i }).first().click();
  await page.getByRole("button", { name: /^regístrate$/i }).click();
  await page.getByPlaceholder("Tu nombre").fill("E2E User");
  await page.getByPlaceholder("tu@email.com").fill(email);
  await page.getByPlaceholder("Mínimo 8 caracteres").fill(password);
  await page.getByPlaceholder("Repite tu contraseña").fill(password);
  await page.getByRole("button", { name: /crear cuenta/i }).click();

  // El registro puede auto-loguear: espera a que se asiente (cierre del
  // modal o mensaje de verificación) antes de decidir el login manual.
  await page
    .waitForFunction(
      () => {
        const btns = Array.from(
          document.querySelectorAll('button')
        ).filter((b) => /iniciar sesión/i.test(b.textContent ?? ""));
        return btns.length === 0;
      },
      { timeout: 20000 }
    )
    .catch(() => {});

  const loginBtn = page.getByRole("button", { name: /iniciar sesión/i });
  if (await loginBtn.first().isVisible().catch(() => false)) {
    // No hubo auto-login: login manual por UI
    await loginBtn.first().click();
    await page.getByPlaceholder("tu@email.com").fill(email);
    await page.getByPlaceholder("Tu contraseña").fill(password);
    await page.getByRole("button", { name: /^iniciar sesión$/i }).click();
  }

  // Sin Resend en local el registro auto-verifica; si exigiera correo,
  // se activa directo en BD (el flujo de UI ya quedó probado arriba).
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    await db.user.updateMany({
      where: { email },
      data: { emailVerified: new Date(), verifyToken: null, verifyExpires: null },
    });
  } finally {
    await db.$disconnect();
  }

  // Estado final: sesión activa (por auto-login o por el manual de arriba)
  await page.goto("/");
  await expect(page.getByRole("button", { name: /iniciar sesión/i })).toBeHidden({
    timeout: 20000,
  });
  await page.context().storageState({ path: path.join(AUTH_DIR, "user.json") });

  fs.writeFileSync(
    path.join(AUTH_DIR, "meta.json"),
    JSON.stringify({ stamp, email, password })
  );
});

/** Login de admin real por UI (credenciales del .env local, jamás commiteadas). */
setup("autentica admin", async ({ page }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  setup.skip(!email || !password, "Sin ADMIN_EMAIL/PASSWORD en entorno");

  await page.goto("/");
  await page.getByRole("button", { name: /iniciar sesión/i }).first().click();
  await page.getByPlaceholder("tu@email.com").fill(email!);
  await page.getByPlaceholder("Tu contraseña").fill(password!);
  await page.getByRole("button", { name: /^iniciar sesión$/i }).click();
  await expect(page.getByRole("button", { name: /iniciar sesión/i })).toBeHidden({
    timeout: 15000,
  });
  await page.context().storageState({ path: path.join(AUTH_DIR, "admin.json") });
});
