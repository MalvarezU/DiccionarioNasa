import { test as setup, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { config as dotenv } from "dotenv";
import bcrypt from "bcryptjs";

dotenv({ path: path.resolve(__dirname, "../.env") });

const AUTH_DIR = path.resolve(__dirname, ".auth");

// Setup con bcrypt cost 10 + BD gratuita lenta: margen amplio
setup.describe.configure({ timeout: 180000 });

/**
 * Gates de setup:
 * 1. Fusible anti-prod: la suite SOLO corre contra BD local. Si DATABASE_URL
 *    no es local, se aborta antes de tocar nada (los dependientes se skippean).
 * 2. Salud: si la BD no responde, aborta en segundos con mensaje claro.
 */
setup("verifica entorno local", async ({ request }) => {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1|piiyaak_test/.test(dbUrl)) {
    throw new Error(
      "E2E bloqueado: DATABASE_URL no es local. Corre con ./scripts/e2e-local.sh (usa .env.test)."
    );
  }
  const res = await request.get("/api/courses", { timeout: 30000 }).catch(() => null);
  if (!res || !res.ok()) {
    throw new Error(
      "Backend/BD no responde (GET /api/courses falló). Revisa que el pg local esté arriba: npm run db:test:up."
    );
  }
});

/** Alta directa en BD + login por UI con correo y contraseña.
 * El registro por UI ya no existe (POST /api/auth/register → 410 Gone,
 * app Google-first): el usuario se crea con Prisma (hash bcrypt cost 10 y
 * emailVerified seteado — el callback signIn de credenciales lo exige) y
 * se loguea por el modal nuevo ("Iniciar sesión" → "Usar correo y
 * contraseña" → submit "Iniciar sesión con correo"). */
setup("autentica usuario de prueba", async ({ page }) => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const stamp = Date.now();
  const email = `e2e-${stamp}@test.local`;
  const password = `E2ePass-${stamp}!`;

  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    await db.user.create({
      data: {
        email,
        name: "E2E User",
        password: await bcrypt.hash(password, 10),
        emailVerified: new Date(),
      },
    });
  } finally {
    await db.$disconnect();
  }

  await page.goto("/");
  await page.getByRole("button", { name: /iniciar sesión/i }).first().click();
  const toggle = page.getByRole("button", { name: /usar correo y contraseña/i });
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
  await page.getByPlaceholder("tu@email.com").fill(email);
  await page.getByPlaceholder("Tu contraseña").fill(password);
  await page.getByRole("button", { name: /iniciar sesión con correo/i }).click();

  // Login con bcrypt + BD gratuita: hasta 60 s bajo carga
  await expect(page.getByRole("button", { name: /iniciar sesión/i })).toBeHidden({
    timeout: 60000,
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
  const toggle = page.getByRole("button", { name: /usar correo y contraseña/i });
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
  await page.getByPlaceholder("tu@email.com").fill(email!);
  await page.getByPlaceholder("Tu contraseña").fill(password!);
  await page.getByRole("button", { name: /iniciar sesión con correo/i }).click();
  // Login con bcrypt cost 12 + BD gratuita: hasta 60 s bajo carga
  await expect(page.getByRole("button", { name: /iniciar sesión/i })).toBeHidden({
    timeout: 60000,
  });
  await page.context().storageState({ path: path.join(AUTH_DIR, "admin.json") });
});
