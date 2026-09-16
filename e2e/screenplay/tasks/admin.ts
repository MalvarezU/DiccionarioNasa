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
    await expect(page.getByText("Total de palabras")).toBeVisible({ timeout: 30000 });
  }
}
