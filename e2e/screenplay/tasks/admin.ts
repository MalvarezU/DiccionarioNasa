import { expect } from "@playwright/test";
import type { Actor, Task } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/**
 * Ir al dashboard admin y esperar que cargue (equivale a `readyDashboard`).
 * Señal: la métrica "Total de palabras".
 */
export class IrADashboard implements Task {
  descripcion = "ir al dashboard admin";
  static ahora(): IrADashboard {
    return new IrADashboard();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Panel de Administración" })).toBeVisible({
      timeout: 30000,
    });
    // Las stats agregadas fallan a veces con la BD saturada: un reintento
    // (igual que haría un humano con el botón "Reintentar")
    if (await page.getByText("Error al cargar las estadísticas").isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Reintentar" }).click();
    }
    // Stats agregadas sobre BD gratuita: hasta 60 s bajo carga
    await expect(page.getByText("Total de palabras")).toBeVisible({ timeout: 60000 });
  }
}
