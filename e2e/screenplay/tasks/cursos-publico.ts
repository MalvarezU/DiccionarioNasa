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
    // Señal estructural (no depende del título de los módulos): el conteo
    await expect(page.getByText(/lecciones/).first()).toBeVisible({ timeout: 30000 });
  }
}

/**
 * Marcar completada la primera lección del módulo abierto por defecto.
 * Busca el botón "1.1 · …" (formato público) y lo abre si hace falta.
 */
export class MarcarPrimeraLeccionCompletada implements Task {
  descripcion = "completar primera lección";
  static ahora(): MarcarPrimeraLeccionCompletada {
    return new MarcarPrimeraLeccionCompletada();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    const leccion = page.getByRole("button", { name: /1\.1/ }).first();
    if (await leccion.isVisible().catch(() => false)) {
      await leccion.click();
    }
    await page.getByRole("button", { name: /marcar como completada/i }).first().click();
  }
}
