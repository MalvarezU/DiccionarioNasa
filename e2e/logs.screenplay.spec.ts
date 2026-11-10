import { test, expect } from "@playwright/test";
import { actorAdmin } from "./screenplay/actores";
import { IrA } from "./screenplay/tasks/acciones";

/**
 * Ciclo completo del módulo de logs/sugerencias contra API + BD reales:
 * sugerencia pública → panel → decisión → re-sugerencia.
 *
 * Rate limit del endpoint: 5 POST/min por IP compartida con toda la suite.
 * Este spec hace EXACTAMENTE 5 POSTs (A:1, B:3, C:1) y no prueba el 429
 * (cubierto por unit tests). Términos únicos por intento (stamp adentro del
 * body) para que un retry de Playwright arranque limpio.
 */

/** Locator de la card que contiene un término. */
function cardDe(page: import("@playwright/test").Page, term: string) {
  return page.locator('[data-slot="card"]').filter({ hasText: term });
}

/**
 * POST público de sugerencia. Devuelve body para asertar dedup.
 * El endpoint limita 5 POST/min por IP compartida con toda la suite: ante
 * 429 espera la ventana (Retry-After, en segundos) y reintenta una vez.
 */
async function sugerir(
  request: import("@playwright/test").APIRequestContext,
  term: string
): Promise<{ alreadySuggested?: boolean; success?: boolean }> {
  const post = async () =>
    request.post("/api/dictionary/suggest", {
      data: { term, comment: "comentario e2e" },
    });
  let res = await post();
  if (res.status() === 429) {
    const wait = Number(res.headers()["retry-after"] ?? "60") * 1000 + 1000;
    await new Promise((r) => setTimeout(r, wait));
    res = await post();
  }
  expect(res.ok(), `POST suggest → ${res.status()}`).toBeTruthy();
  return res.json();
}

/** Id del log SUGGEST más reciente para un término (API admin). */
async function idDeSugerencia(
  request: import("@playwright/test").APIRequestContext,
  term: string
): Promise<string> {
  const res = await request.get("/api/admin/audit-logs?action=SUGGEST&page=1&pageSize=100");
  expect(res.ok(), "GET audit-logs").toBeTruthy();
  const { logs } = await res.json();
  const log = logs.find((l: { changes: string }) => l.changes.includes(`"term":"${term}"`));
  expect(log, `log SUGGEST para ${term}`).toBeTruthy();
  return log.id;
}

test.describe("módulo de logs (Screenplay)", () => {
  test.describe.configure({ timeout: 180000 });

  test("A: sugerencia pública aparece en el panel y 'Atendida' la mueve de tab", async ({
    page,
    request,
  }) => {
    const term = `E2E Sug ${Date.now()} ciclo`;
    await sugerir(request, term);

    const admin = actorAdmin(page, request);
    await admin.intenta(IrA.a("/admin/sugerencias"));

    // Tab por defecto: Pendientes, con la card nueva.
    await expect(cardDe(page, term)).toBeVisible({ timeout: 30000 });
    // Contador del tab Pendientes >= 1.
    await expect(page.getByRole("tab", { name: /Pendientes/ })).toContainText(/[1-9]/);

    // Decidir: Atendida → la card sale de Pendientes (recarga post-PATCH).
    await cardDe(page, term).getByRole("button", { name: "Atendida" }).click();
    await expect(cardDe(page, term)).toBeHidden({ timeout: 30000 });

    // Aparece en la tab Atendidas.
    await page.getByRole("tab", { name: /Atendidas/ }).click();
    await expect(cardDe(page, term)).toBeVisible({ timeout: 30000 });
  });

  test("B: dedup normalizado y reapertura del ciclo (API)", async ({ page, request }) => {
    const stamp = Date.now();
    const term = `E2E Sug ${stamp} camíir`;

    // 1er POST: término nuevo, se guarda.
    const first = await sugerir(request, term);
    expect(first.alreadySuggested).toBeFalsy();

    // 2do POST: misma palabra en MAYÚSCULAS y sin tilde (mismo stamp) →
    // dedup normalizado: normalizeTerm baja caso y saca tildes antes de comparar.
    const dup = await sugerir(request, `E2E SUG ${stamp} CAMIIR`);
    expect(dup.alreadySuggested).toBe(true);

    // Decidir DONE por API.
    const id = await idDeSugerencia(request, term);
    const patch = await request.patch(`/api/admin/suggestions/${id}`, {
      data: { action: "DONE" },
    });
    expect(patch.ok(), `PATCH DONE → ${patch.status()}`).toBeTruthy();

    // 3er POST: ya decidida → el ciclo se reabre (se acepta de nuevo).
    const reopened = await sugerir(request, term);
    expect(reopened.alreadySuggested).toBeFalsy();

    // En el panel: la original quedó en Atendidas y la nueva en Pendientes.
    const admin = actorAdmin(page, request);
    await admin.intenta(IrA.a("/admin/sugerencias"));
    await page.getByRole("tab", { name: /Atendidas/ }).click();
    await expect(cardDe(page, term)).toBeVisible({ timeout: 30000 });
    await page.getByRole("tab", { name: /Pendientes/ }).click();
    await expect(cardDe(page, term)).toBeVisible({
      timeout: 30000,
    });
  });

  test("C: Archivar y Reabrir desde el panel", async ({ page, request }) => {
    const term = `E2E Sug ${Date.now()} archivo`;
    await sugerir(request, term);

    const admin = actorAdmin(page, request);
    await admin.intenta(IrA.a("/admin/sugerencias"));
    await expect(cardDe(page, term)).toBeVisible({ timeout: 30000 });

    // Archivar → sale de Pendientes.
    await cardDe(page, term).getByRole("button", { name: /Archivar/ }).click();
    await expect(cardDe(page, term)).toBeHidden({ timeout: 30000 });

    // Aparece en Archivadas con botón Reabrir.
    await page.getByRole("tab", { name: /Archivadas/ }).click();
    await expect(cardDe(page, term)).toBeVisible({ timeout: 30000 });

    // Reabrir → vuelve a Pendientes.
    await cardDe(page, term).getByRole("button", { name: /Reabrir/ }).click();
    await page.getByRole("tab", { name: /Pendientes/ }).click();
    await expect(cardDe(page, term)).toBeVisible({ timeout: 30000 });
  });
});
