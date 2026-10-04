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

/**
 * Abrir una lección por su número (p.ej. 1.3) en el detalle público.
 * El acordeón del módulo ya está abierto por defecto (módulo 1).
 */
export class AbrirLeccionNumerada implements Task {
  descripcion: string;
  private constructor(private patron: RegExp) {
    this.descripcion = `abrir lección ${patron}`;
  }
  static conPatron(patron: RegExp): AbrirLeccionNumerada {
    return new AbrirLeccionNumerada(patron);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    const fila = page.getByRole("button", { name: this.patron }).first();
    await fila.waitFor({ timeout: 30000 });
    // Solo clic si está cerrada; si está abierta, no hace nada (idempotente)
    if ((await fila.getAttribute("aria-expanded")) !== "true") {
      await fila.click();
    }
    // Señal de contenido listo: el quiz del bloque
    await expect(page.getByTestId("quiz-interactivo")).toBeVisible({ timeout: 30000 });
  }
}

/** Resolver el quiz interactivo de la lección abierta, respondiendo todo bien. */
export class ResolverQuizInteractivo {
  static delBloque(): Task {
    const tarea: Task = {
      descripcion: "resolver el quiz respondiendo las opciones correctas",
      ejecutar: async (actor: Actor) => {
        const { page } = actor.usa(NavegarLaWeb);
        // Responde la PRIMERA opción de cada pregunta: en el seed, la correcta
        // de las dos es la primera. Preguntas por la marca aria-pressed.
        const preguntas = page.getByTestId("quiz-interactivo").locator("li");
        const total = await preguntas.count();
        for (let i = 0; i < total; i++) {
          await page
            .getByRole("button", { name: `Opción 1 de la pregunta ${i + 1}` })
            .click();
        }
        await page.getByRole("button", { name: "Revisar" }).click();
        await expect(page.getByText(/Aprobaste/)).toBeVisible({ timeout: 15000 });
      },
    };
    return tarea;
  }
}
