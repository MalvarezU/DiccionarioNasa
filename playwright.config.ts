import { defineConfig, devices } from "@playwright/test";

/**
 * E2E Piiyaak (B4): suite GUI completa.
 * - public: sin sesión (existente).
 * - setup: registra usuario e2e + logins, guarda storageStates.
 * - user/admin: flujos con sesión (dependen del setup).
 * Limpieza: globalTeardown borra datos e2e-* (ver e2e/teardown.ts).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /setup\.ts/ },
    {
      // Guardas de paleta: sin sesión ni datos. Corre primero para que una
      // regresión de color se reporte antes que la suite pesada.
      name: "paleta",
      testMatch: /paleta\.screenplay\.spec\.ts/,
    },
    {
      name: "screenplay-public",
      testMatch: /publico\.screenplay\.spec\.ts/,
    },
    {
      name: "screenplay-user",
      testMatch: /usuario\.screenplay\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: "e2e/.auth/user.json" },
    },
    {
      name: "screenplay-admin",
      testMatch: /admin\.screenplay\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: "e2e/.auth/admin.json" },
    },
    {
      // Sin sesión global: cada test crea sus contextos (admin/user/visitante)
      name: "screenplay-multi",
      testMatch: /multiactor\.screenplay\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
  globalTeardown: "./e2e/teardown.ts",
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // NODE_ENV explícito: Playwright lo fuerza a `test` y `next dev`
        // se niega a correr fuera de development (antes andaba solo porque
        // reusaba un dev server ya abierto).
        command: "NODE_ENV=development npx next dev -p 3000",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120000,
      },
});
