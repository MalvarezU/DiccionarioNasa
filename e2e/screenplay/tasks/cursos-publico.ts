import { expect } from "@playwright/test";
import type { Actor, Task } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** Abrir un curso del catálogo público y esperar su árbol. */
export class AbrirCursoPublico implements Task {
  descripcion: string;
  private constructor(private titulo: string) {
    this.descripcion = `abrir curso público "${titulo}"`;
  }
  static titulado(titulo: string): AbrirCursoPublico {
    return new AbrirCursoPublico(titulo);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByText(this.titulo).click();
    await expect(page.getByText("Módulo 1", { exact: false })).toBeVisible({ timeout: 30000 });
  }
}

/**
 * Marcar completada la primera lección del módulo abierto por defecto.
 * Si la lección 1.1 requiere abrirse primero, la abre (igual que user.spec).
 */
export class MarcarPrimeraLeccionCompletada implements Task {
  descripcion = "completar primera lección";
  static ahora(): MarcarPrimeraLeccionCompletada {
    return new MarcarPrimeraLeccionCompletada();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    const leccion = page.getByRole("button", { name: /lección 1\.1/i }).first();
    if (await leccion.isVisible().catch(() => false)) {
      await leccion.click();
    }
    await page.getByRole("button", { name: /marcar como completada/i }).first().click();
  }
}
