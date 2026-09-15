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

  test("curso: crear módulo, doble click crea una sola lección", async ({ page }) => {
    const stamp = Date.now();
    const courseTitle = `E2E Curso ${stamp}`;
    const lessonTitle = `E2E Lección ${stamp}`;

    await page.goto("/admin/courses");
    await expect(page.getByText("Gestión de cursos")).toBeVisible({ timeout: 30000 });

    // Crear curso
    await page.getByLabel("Título del nuevo curso").fill(courseTitle);
    await page.getByRole("button", { name: "Crear curso" }).click();
    await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 30000 });

    // Crear módulo
    await page.getByText(courseTitle).click();
    await page.getByLabel("Título del nuevo módulo").fill(`E2E Módulo ${stamp}`);
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(page.getByText(`E2E Módulo ${stamp}`)).toBeVisible({ timeout: 30000 });

    // Doble click rápido en añadir lección → una sola lección
    await page.getByLabel(/Título de nueva lección/).fill(lessonTitle);
    await page.getByRole("button", { name: "Añadir lección" }).dblclick();
    // El botón se bloquea mientras envía
    await expect(page.getByText(lessonTitle).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(lessonTitle)).toHaveCount(1, { timeout: 15000 });
  });

  test("curso: editor pre-rellena y reordenar re-numera", async ({ page }) => {
    const stamp = Date.now();
    const courseTitle = `E2E Curso Ed ${stamp}`;

    await page.goto("/admin/courses");
    await expect(page.getByText("Gestión de cursos")).toBeVisible({ timeout: 30000 });

    await page.getByLabel("Título del nuevo curso").fill(courseTitle);
    await page.getByRole("button", { name: "Crear curso" }).click();
    await expect(page.getByText(courseTitle)).toBeVisible({ timeout: 30000 });
    await page.getByText(courseTitle).click();
    await page.getByLabel("Título del nuevo módulo").fill(`E2E Mod ${stamp}`);
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(page.getByText(`E2E Mod ${stamp}`)).toBeVisible({ timeout: 30000 });

    // Dos lecciones
    await page.getByLabel(/Título de nueva lección/).fill(`E2E Primera ${stamp}`);
    await page.getByRole("button", { name: "Añadir lección" }).click();
    await expect(page.getByText(`E2E Primera ${stamp}`)).toBeVisible({ timeout: 30000 });
    await page.getByLabel(/Título de nueva lección/).fill(`E2E Segunda ${stamp}`);
    await page.getByRole("button", { name: "Añadir lección" }).click();
    await expect(page.getByText(`E2E Segunda ${stamp}`)).toBeVisible({ timeout: 30000 });

    // Abrir editor: pre-rellena título
    await page.getByRole("button", { name: `Editar lección E2E Primera ${stamp}` }).click();
    await expect(page.getByText("Editar lección")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#edit-lesson-title")).toHaveValue(`E2E Primera ${stamp}`);
    const dialog = page.getByRole("dialog");

    // Mover la primera hacia abajo y esperar a que el modal refleje 1.2
    // (el POST puede tardar con la BD lenta; el botón se bloquea mientras envía)
    await dialog.getByRole("button", { name: "Bajar lección", exact: true }).click();
    await expect(dialog.getByText("1.2", { exact: true })).toBeVisible({ timeout: 60000 });
    // El botón vuelve a habilitarse cuando termina el envío
    await expect(dialog.getByRole("button", { name: "Bajar lección", exact: true })).toBeEnabled({
      timeout: 60000,
    });
    await page.keyboard.press("Escape");

    // En la lista, la fila de "E2E Segunda" ahora muestra el 1.1
    const segundaRow = page.locator(
      `[data-testid="lesson-row"][data-lesson-title="E2E Segunda ${stamp}"]`
    );
    await expect(segundaRow.getByText("1.1", { exact: true })).toBeVisible({ timeout: 30000 });

    // Limpieza: eliminar el curso (cascada a módulos y lecciones)
    page.on("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(page.getByText(courseTitle)).toHaveCount(0, { timeout: 30000 });
  });

});

  test("ZZ shot modal", async ({ page }) => {
    await page.goto("/admin/courses");
    await expect(page.getByText("Gestión de cursos")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: /módulos ·/ }).first().click();
    await page.getByRole("button", { name: /^Editar lección / }).first().click();
    await expect(page.locator("#edit-lesson-title")).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: "/tmp/modal-shot.png" });
    console.log("shot ok");
  });
