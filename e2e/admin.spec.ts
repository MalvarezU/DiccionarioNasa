import { test, expect, type Page } from "@playwright/test";
import * as XLSX from "xlsx";

/**
 * Flujos de admin (proyecto "admin", con storageState).
 * Crea palabras "E2E *" que el teardown borra (con sus audios si los hubiera).
 */
const stamp = Date.now();
const WORD_ES = `E2E Palabra ${stamp}`;

test.describe("admin Piiyaak", () => {
  // BD gratuita lenta: timeouts amplios
  test.describe.configure({ timeout: 180000 });

  /** Dashboard listo antes de operar. */
  async function readyDashboard(page: Page) {
    await page.goto("/admin");
    await expect(page.getByText("Total de palabras")).toBeVisible({ timeout: 30000 });
  }

  test("panel muestra estadísticas", async ({ page }) => {
    await readyDashboard(page);
  });

  test("ciclo de ficha: crear, publicar, archivar", async ({ page }) => {
    await readyDashboard(page);
    await page.getByRole("button", { name: /nueva ficha/i }).click();

    await page.getByLabel(/español/i).fill(WORD_ES);
    await page.getByLabel(/nasa yuwe/i).fill(`E2ENy ${stamp}`);
    await page.getByRole("button", { name: /guardar y publicar/i }).click();
    await expect(page.getByText(/ficha guardada|éxito|publicada/i).first()).toBeVisible({
      timeout: 15000,
    });

    // Visible en búsqueda pública
    await page.goto("/");
    await page.getByPlaceholder(/Buscar/).fill(WORD_ES);
    await expect(page.getByRole("option", { name: new RegExp(WORD_ES, "i") }).first()).toBeVisible({
      timeout: 25000,
    });

    // Archivar desde el modal de edición
    await readyDashboard(page);
    await page.getByRole("button", { name: /gestionar fichas/i }).click();
    await expect(page.getByText("Gestión de fichas")).toBeVisible({ timeout: 20000 });
    const search = page.getByPlaceholder(/buscar/i);
    if (await search.isVisible().catch(() => false)) {
      await search.fill(WORD_ES);
    }
    await page.getByRole("button", { name: /editar/i }).first().click();
    const archiveBtn = page.getByRole("button", { name: /archivar/i }).first();
    if (await archiveBtn.isVisible().catch(() => false)) {
      await archiveBtn.click();
      await expect(page.getByText(/archivada/i).first()).toBeVisible({ timeout: 10000 });
    }

    // Ya no aparece en búsqueda pública
    await page.goto("/");
    await page.getByPlaceholder(/Buscar/).fill(WORD_ES);
    await expect(
      page.getByRole("option", { name: new RegExp(WORD_ES, "i") })
    ).toHaveCount(0, { timeout: 10000 } as never);
  });

  test("importar xlsx con preview y confirmación", async ({ page }) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Palabra_esp: `E2E Imp ${stamp} A`, Palabra_nyW: "ImpNyA" },
        { Palabra_esp: `E2E Imp ${stamp} B`, Palabra_nyW: "ImpNyB", Estado: "BORRADOR" },
        { Palabra_esp: "", Palabra_nyW: "" },
      ]),
      "Hoja1"
    );
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    await readyDashboard(page);
    await page.getByRole("button", { name: /importar corpus/i }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "corpus-e2e.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: buf,
    });

    await expect(page.getByText(/vista previa/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/2 listas/i)).toBeVisible();
    await page.getByRole("button", { name: /confirmar/i }).click();
    await expect(page.getByText(/importación completada/i)).toBeVisible({ timeout: 15000 });
  });

  test("bitácora filtra y exporta CSV", async ({ page }) => {
    await readyDashboard(page);
    await page.getByRole("button", { name: /ver log completo/i }).click();
    await expect(page.getByText(/log de auditoría/i).first()).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /exportar csv/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("bitacora-");
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
  });

  test("gestión de usuarios visible", async ({ page }) => {
    await readyDashboard(page);
    await expect(page.getByText(/administra los roles/i)).toBeVisible({ timeout: 15000 });
  });
});
