import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Tests co-localizados con el código fuente (`src/**`), más los tests de
    // integridad de datos del seed y utilidades de CSV alojados en `prisma/`,
    // más los tests de Fase A (`tests/fase-a/`, cambio apk-offline-seed-fase-a).
    include: [
      "src/**/*.test.{ts,tsx}",
      "prisma/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
      "scripts/**/*.test.{ts,tsx}",
    ],
    clearMocks: true,
    restoreMocks: true,
    pool: "forks",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/components/ui/**",
      ],
      thresholds: {
        lines: 60,
        branches: 55,
        functions: 60,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
