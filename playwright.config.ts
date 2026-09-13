import { defineConfig, devices } from "@playwright/test";

/**
 * E2E Piiyaak (B4): flujos de lectura + juegos/cursos sin sesión.
 * No crea usuarios ni toca contenido: los resultados de juego usan
 * sessionKey "e2e-*" y se limpian post-run (ver e2e/cleanup).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- -p 3000",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120000,
      },
});
