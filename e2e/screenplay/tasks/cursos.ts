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
    // first(): el detalle abierto muestra el mismo título en su header;
    // en local (rápido) ambos ya están visibles y el matcher estricto falla.
    await expect(page.getByText(this.titulo).first()).toBeVisible({ timeout: 30000 });
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
 * `.aModulo(m)` elige el formulario de ese módulo (varios módulos en vista).
 */
export class AnadirLeccion implements Task {
  descripcion: string;
  private doble = false;
  private modulo?: string;
  private constructor(private titulo: string) {
    this.descripcion = `añadir lección "${titulo}"`;
  }
  static titulada(titulo: string): AnadirLeccion {
    return new AnadirLeccion(titulo);
  }
  static aModulo(modulo: string, titulo: string): AnadirLeccion {
    const t = new AnadirLeccion(titulo);
    t.modulo = modulo;
    t.descripcion = `añadir lección "${titulo}" al módulo "${modulo}"`;
    return t;
  }
  dosVecesSeguidas(): AnadirLeccion {
    const t = this.modulo
      ? AnadirLeccion.aModulo(this.modulo, this.titulo)
      : new AnadirLeccion(this.titulo);
    t.doble = true;
    t.descripcion = `intentar añadir "${this.titulo}" dos veces seguidas`;
    return t;
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    let boton;
    if (this.modulo) {
      // El label ya viene aislado por módulo; el botón se busca en su bloque
      const campo = page.getByLabel(`Título de nueva lección en ${this.modulo}`);
      const bloque = page.locator("div.rounded-lg", { has: campo });
      await campo.fill(this.titulo);
      boton = bloque.getByRole("button", { name: "Añadir lección" });
    } else {
      await page.getByLabel(/Título de nueva lección/).fill(this.titulo);
      boton = page.getByRole("button", { name: "Añadir lección" });
    }
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
 * Mover la lección del editor abierto una posición (arriba o abajo).
 * Espera a que el botón se rehabilite (señal de envío terminado);
 * el número resultante se verifica con NumeroEnModal.
 */
export class MoverLeccion {
  static abajo(): Task {
    return moverLeccion("Bajar lección", "hacia abajo");
  }
  static arriba(): Task {
    return moverLeccion("Subir lección", "hacia arriba");
  }
}

function moverLeccion(boton: string, direccion: string): Task {
  return {
    descripcion: `mover lección del editor ${direccion}`,
    async ejecutar(actor: Actor): Promise<void> {
      const { page } = actor.usa(NavegarLaWeb);
      const dialog = page.getByRole("dialog");
      const mover = dialog.getByRole("button", { name: boton, exact: true });
      await mover.click();
      // El POST puede tardar con la BD lenta; el botón se bloquea mientras envía
      await expect(mover).toBeEnabled({ timeout: 60000 });
    },
  };
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

/**
 * Eliminar el curso abierto (cascada a módulos y lecciones).
 * Requiere la habilidad AceptarConfirmaciones (la trae actorAdmin).
 */
export class EliminarCurso implements Task {
  descripcion: string;
  private constructor(private titulo: string) {
    this.descripcion = `eliminar curso "${titulo}"`;
  }
  static titulado(titulo: string): EliminarCurso {
    return new EliminarCurso(titulo);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(page.getByText(this.titulo)).toHaveCount(0, { timeout: 30000 });
  }
}

/**
 * Publicar el curso abierto (Estado → Publicado + Guardar).
 * Espera el PATCH real por red (el texto "Publicado" aparece con solo
 * seleccionar; no prueba guardado). La verificación real la hace el catálogo.
 */
export class PublicarCursoAbierto implements Task {
  descripcion = "publicar curso abierto";
  static ahora(): PublicarCursoAbierto {
    return new PublicarCursoAbierto();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("combobox", { name: "Estado del curso" }).click();
    await page.getByRole("option", { name: "Publicado" }).click();
    const guardado = page.waitForResponse(
      (r) => /\/api\/courses\/[^/?]+$/.test(r.url()) && r.request().method() === "PATCH",
      { timeout: 60000 }
    );
    await page.getByRole("button", { name: "Guardar curso" }).click();
    await guardado;
    await expect(page.getByText("Publicado").first()).toBeVisible({ timeout: 30000 });
  }
}

/**
 * Archivar el curso abierto (Estado → Archivado + Guardar).
 * Espera el PATCH real por red, igual que al publicar.
 * Desaparece del catálogo público (se verifica con CursoAusente).
 */
export class ArchivarCursoAbierto implements Task {
  descripcion = "archivar curso abierto";
  static ahora(): ArchivarCursoAbierto {
    return new ArchivarCursoAbierto();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("combobox", { name: "Estado del curso" }).click();
    await page.getByRole("option", { name: "Archivado" }).click();
    const guardado = page.waitForResponse(
      (r) => /\/api\/courses\/[^/?]+$/.test(r.url()) && r.request().method() === "PATCH",
      { timeout: 60000 }
    );
    await page.getByRole("button", { name: "Guardar curso" }).click();
    await guardado;
    await expect(page.getByText("Archivado").first()).toBeVisible({ timeout: 30000 });
  }
}

/** Cambiar el título en el editor abierto (sin guardar). */
export class RenombrarLeccionEnEditor implements Task {
  descripcion: string;
  private constructor(private titulo: string) {
    this.descripcion = `renombrar a "${titulo}" en el editor`;
  }
  static a(titulo: string): RenombrarLeccionEnEditor {
    return new RenombrarLeccionEnEditor(titulo);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.locator("#edit-lesson-title").fill(this.titulo);
  }
}

/**
 * Guardar el editor abierto. Termina cuando el modal cierra (éxito) o
 * muestra error (p.ej. 409 por duplicado); el resultado se lee con ErrorEnModal.
 */
export class GuardarLeccionEnEditor implements Task {
  descripcion = "guardar editor de lección";
  static ahora(): GuardarLeccionEnEditor {
    return new GuardarLeccionEnEditor();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect
      .poll(
        async () => {
          if ((await dialog.count()) === 0) return "cerrado";
          if ((await dialog.locator("p.text-destructive").count()) > 0) return "error";
          return "esperando";
        },
        { timeout: 30000 }
      )
      .not.toBe("esperando");
  }
}

// -------------------------------------------------------------------------- 
// Fase 3: editor de contenido (bloques) con vista previa del estudiante.
// --------------------------------------------------------------------------

/** Abrir el editor de contenido (bloques) de una lección. */
export class AbrirContenidoDeLeccion implements Task {
  descripcion: string;
  private constructor(private titulo: string) {
    this.descripcion = `abrir contenido de "${titulo}"`;
  }
  static titulada(titulo: string): AbrirContenidoDeLeccion {
    return new AbrirContenidoDeLeccion(titulo);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: `Contenido de lección ${this.titulo}` }).click();
    // El header del dialog: "Contenido · N. título". first(): el título
    // también está en la fila de fondo.
    await expect(page.getByText("Contenido ·").first()).toBeVisible({ timeout: 15000 });
    // Señal de editor listo: vale para lección VACÍA (mostraría "Agregá el
    // primer bloque") y para lección CON contenido (mostraría sus bloques).
    await expect(
      page.getByRole("button", { name: "Guardar lección" })
    ).toBeVisible({ timeout: 15000 });
  }
}

/** Agregar un bloque de texto con el markdown dado. */
export class AgregarBloqueDeTexto implements Task {
  descripcion: string;
  private constructor(private markdown: string) {
    this.descripcion = "agregar bloque de texto";
  }
  static conTexto(markdown: string): AgregarBloqueDeTexto {
    return new AgregarBloqueDeTexto(markdown);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    // Botón del estante "Agregar bloque" (exact: los badges de tipo no son botones)
    await page.getByRole("button", { name: "Texto", exact: true }).click();
    const area = page.getByLabel(/Texto de la lección/i).last();
    await expect(area).toBeVisible({ timeout: 10000 });
    await area.fill(this.markdown);
  }
}

/** Agregar un bloque de vocabulario con UNA palabra buscada por su español. */
export class AgregarBloqueDeVocabulario implements Task {
  descripcion: string;
  private constructor(private espanol: string) {
    this.descripcion = `agregar vocabulario con "${espanol}"`;
  }
  static conUnaPalabra(espanol: string): AgregarBloqueDeVocabulario {
    return new AgregarBloqueDeVocabulario(espanol);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: "Vocabulario", exact: true }).click();
    const buscador = page.getByLabel("Buscar palabra en el diccionario");
    await expect(buscador).toBeVisible({ timeout: 10000 });
    await buscador.fill(this.espanol);
    // Resultado de la búsqueda: botón con la palabra elegida
    const resultado = page.getByRole("button", { name: new RegExp(this.espanol) }).first();
    await expect(resultado).toBeVisible({ timeout: 30000 });
    await resultado.click();
  }
}

/** Guardar la lección y esperar la confirmación. */
export class GuardarContenido {
  static deLaLeccion(): Task {
    const tarea: Task = {
      descripcion: "guardar la lección",
      ejecutar: async (actor: Actor) => {
        const { page } = actor.usa(NavegarLaWeb);
        await page.getByRole("button", { name: "Guardar lección" }).click();
        // first(): el toast puede aparecer más de una vez (reintento del
        // guardado). Un solo elemento es la señal.
        await expect(page.getByText("Lección guardada").first()).toBeVisible({ timeout: 30000 });
      },
    };
    return tarea;
  }
}

/** Cerrar el editor de contenido. */
export class CerrarContenido {
  static ahora(): Task {
    const tarea: Task = {
      descripcion: "cerrar el editor de contenido",
      ejecutar: async (actor: Actor) => {
        const { page } = actor.usa(NavegarLaWeb);
        // OJO: mientras el toast "Lección guardada" está visible, Escape no
        // cierra el dialog (la capa del toast consume la tecla). Usamos el
        // botón X (sr-only "Close" en el DialogContent del editor).
        const dialogo = page
          .locator(".bg-background[data-state='open'], [data-slot='dialog-content']")
          .filter({ hasText: "Contenido ·" });
        await dialogo.locator('[data-slot="dialog-close"]').click();
        await expect(page.getByText("Contenido ·")).toHaveCount(0, { timeout: 15000 });
      },
    };
    return tarea;
  }
}
