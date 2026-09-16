import { expect } from "@playwright/test";
import type { Actor, Task } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** Ir a /admin/courses y esperar el panel. */
export class IrAGestionDeCursos implements Task {
  descripcion = "ir a gestión de cursos";
  static ahora(): IrAGestionDeCursos {
    return new IrAGestionDeCursos();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.goto("/admin/courses");
    await expect(page.getByText("Gestión de cursos")).toBeVisible({ timeout: 30000 });
  }
}

/** Crear un curso con el título dado. */
export class CrearCurso implements Task {
  descripcion: string;
  private constructor(private titulo: string) {
    this.descripcion = `crear curso "${titulo}"`;
  }
  static titulado(titulo: string): CrearCurso {
    return new CrearCurso(titulo);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByLabel("Título del nuevo curso").fill(this.titulo);
    await page.getByRole("button", { name: "Crear curso" }).click();
    await expect(page.getByText(this.titulo)).toBeVisible({ timeout: 30000 });
  }
}

/** Abrir (seleccionar) un curso para gestionarlo. */
export class AbrirCurso implements Task {
  descripcion: string;
  private constructor(private titulo: string) {
    this.descripcion = `abrir curso "${titulo}"`;
  }
  static titulado(titulo: string): AbrirCurso {
    return new AbrirCurso(titulo);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByText(this.titulo).click();
    await expect(page.getByLabel("Título del nuevo módulo")).toBeVisible({ timeout: 15000 });
  }
}

/** Crear un módulo dentro del curso abierto. */
export class CrearModulo implements Task {
  descripcion: string;
  private constructor(private titulo: string) {
    this.descripcion = `crear módulo "${titulo}"`;
  }
  static titulado(titulo: string): CrearModulo {
    return new CrearModulo(titulo);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByLabel("Título del nuevo módulo").fill(this.titulo);
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(page.getByText(this.titulo)).toBeVisible({ timeout: 30000 });
  }
}

/**
 * Añadir una lección al módulo abierto.
 * `.dosVecesSeguidas()` simula el doble click (el botón debe bloquear el 2º).
 */
export class AnadirLeccion implements Task {
  descripcion: string;
  private doble = false;
  private constructor(private titulo: string) {
    this.descripcion = `añadir lección "${titulo}"`;
  }
  static titulada(titulo: string): AnadirLeccion {
    return new AnadirLeccion(titulo);
  }
  dosVecesSeguidas(): AnadirLeccion {
    const t = new AnadirLeccion(this.titulo);
    t.doble = true;
    t.descripcion = `intentar añadir "${this.titulo}" dos veces seguidas`;
    return t;
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByLabel(/Título de nueva lección/).fill(this.titulo);
    const boton = page.getByRole("button", { name: "Añadir lección" });
    if (this.doble) {
      await boton.dblclick();
    } else {
      await boton.click();
      await expect(page.getByText(this.titulo)).toBeVisible({ timeout: 30000 });
    }
  }
}

/** Abrir el editor de una lección (pre-rellena título y palabra). */
export class AbrirEditorDeLeccion implements Task {
  descripcion: string;
  private constructor(private titulo: string) {
    this.descripcion = `abrir editor de "${titulo}"`;
  }
  static titulada(titulo: string): AbrirEditorDeLeccion {
    return new AbrirEditorDeLeccion(titulo);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: `Editar lección ${this.titulo}` }).click();
    await expect(page.getByText("Editar lección")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#edit-lesson-title")).toBeVisible({ timeout: 15000 });
  }
}

/**
 * Mover la lección del editor abierto una posición hacia abajo.
 * Espera a que el botón se rehabilite (señal de envío terminado);
 * el número resultante se verifica con NumeroEnModal.
 */
export class MoverLeccion {
  static abajo(): Task {
    return {
      descripcion: "mover lección del editor hacia abajo",
      async ejecutar(actor: Actor): Promise<void> {
        const { page } = actor.usa(NavegarLaWeb);
        const dialog = page.getByRole("dialog");
        const bajar = dialog.getByRole("button", { name: "Bajar lección", exact: true });
        await bajar.click();
        // El POST puede tardar con la BD lenta; el botón se bloquea mientras envía
        await expect(bajar).toBeEnabled({ timeout: 60000 });
      },
    };
  }
}

/** Cerrar el editor con Escape. */
export class CerrarEditor implements Task {
  descripcion = "cerrar editor";
  static ahora(): CerrarEditor {
    return new CerrarEditor();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15000 });
  }
}
