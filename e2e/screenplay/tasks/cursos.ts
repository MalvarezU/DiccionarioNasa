import { expect } from "@playwright/test";
import type { Actor, Task } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** Ir a /admin/cursos y esperar el panel. */
export class IrAGestionDeCursos implements Task {
  descripcion = "ir a gestión de cursos";
  static ahora(): IrAGestionDeCursos {
    return new IrAGestionDeCursos();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.goto("/admin/cursos");
    await expect(page.getByRole("heading", { name: "Gestión de cursos" })).toBeVisible({ timeout: 30000 });
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
    // Preciso por rol: el título también aparece en el card de detalle y
    // getByText rompe en strict mode cuando ambos están visibles.
    await page.getByRole("button", { name: this.titulo }).click();
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
      // El label ya viene aislado por módulo; el botón se busca en su bloque.
      // El bloque es el Accordion.Item del módulo (div[data-module-id]);
      // el viejo div.rounded-lg dejó de matchear con el restyle de las cards.
      const campo = page.getByLabel(`Título de nueva lección en ${this.modulo}`);
      const bloque = page.locator("div[data-module-id]", { has: campo });
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

/**
 * Mover una lección una posición con los botones ↑/↓ de su fila.
 * Termina cuando la insignia de la fila cambia (señal de re-render
 * tras el POST + loadDetail).
 */
export class MoverLeccion {
  static abajo(titulo: string): Task {
    return moverLeccion("Bajar lección", titulo, "hacia abajo");
  }
  static arriba(titulo: string): Task {
    return moverLeccion("Subir lección", titulo, "hacia arriba");
  }
}

function moverLeccion(boton: string, titulo: string, direccion: string): Task {
  return {
    descripcion: `mover lección "${titulo}" ${direccion}`,
    async ejecutar(actor: Actor): Promise<void> {
      const { page } = actor.usa(NavegarLaWeb);
      const fila = page.locator(
        `[data-testid="lesson-row"][data-lesson-title="${titulo}"]`
      );
      const insignia = fila.getByText(/^\d+\.\d+$/).first();
      await insignia.waitFor({ timeout: 30000 });
      const antes = ((await insignia.textContent()) ?? "").trim();
      await page.getByRole("button", { name: `${boton} ${titulo}`, exact: true }).click();
      await expect
        .poll(async () => ((await insignia.textContent()) ?? "").trim(), {
          timeout: 60000,
        })
        .not.toBe(antes);
    },
  };
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
    // El panel usa ConfirmDialog (Radix AlertDialog), no window.confirm:
    // AceptarConfirmaciones (page.on dialog) no lo captura. Confirmamos acá.
    const confirmBtn = page.getByRole("button", { name: "Eliminar", exact: true }).last();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }
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
    await page.locator("#lesson-title").fill(this.titulo);
  }
}

/**
 * Guardar el editor abierto. El modal de contenido NO cierra al guardar:
 * termina cuando aparece el toast de éxito o el de error (p.ej. 409 por
 * duplicado); el resultado se lee con ErrorEnModal o el toast.
 */
export class GuardarLeccionEnEditor implements Task {
  descripcion = "guardar editor de lección";
  static ahora(): GuardarLeccionEnEditor {
    return new GuardarLeccionEnEditor();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: "Guardar lección" }).click();
    await expect
      .poll(
        async () => {
          if (await page.getByText("Lección guardada").first().isVisible().catch(() => false)) return "guardado";
          if (await page.getByText("No se pudo guardar").first().isVisible().catch(() => false)) return "error";
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
    // La edición vive en página propia: URL con el id + título prellenado.
    await expect(page).toHaveURL(/\/lecciones\//, { timeout: 15000 });
    await expect(page.locator("#lesson-title")).toHaveValue(this.titulo, { timeout: 15000 });
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
    const area = page.getByLabel(/Texto de la lección/i).last().locator(".tiptap, .ProseMirror").first();
    await expect(area).toBeVisible({ timeout: 10000 });
    await area.click();
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
        await page.getByRole("button", { name: "Volver a Gestión de cursos" }).click();
        // Vuelve a la lista del gestor (ya guardó: el guard no frena).
        await expect(page.getByTestId("cursos-lista")).toBeVisible({ timeout: 15000 });
      },
    };
    return tarea;
  }
}

/** Subir la imagen de portada del curso abierto (input del MediaPicker). */
export class SubirPortadaDelCurso {
  static ahora(): Task {
    const tarea: Task = {
      descripcion: "subir portada del curso",
      ejecutar: async (actor: Actor) => {
        const { page } = actor.usa(NavegarLaWeb);
        const input = page.getByLabel("Elegir imagen del dispositivo");
        await input.setInputFiles({
          name: "e2e-portada.png",
          mimeType: "image/png",
          // URL de prueba 1x1 (buffer directo: no requiere archivo en disco)
          buffer: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
            "base64"
          ),
        });
        // La subida comprime en el cliente y después patchea: señal = preview
        await expect(page.getByAltText("Portada del curso")).toBeVisible({ timeout: 30000 });
      },
    };
    return tarea;
  }
}

/** Guardar los metadatos del curso (nessuno: PATCH + refresh del detalle). */
export class GuardarCursoMeta {
  static ahora(): Task {
    const tarea: Task = {
      descripcion: "guardar curso",
      ejecutar: async (actor: Actor) => {
        const { page } = actor.usa(NavegarLaWeb);
        await page.getByRole("button", { name: "Guardar curso" }).click();
        // El PATCH + reload del detalle; señal estable: el botón sigue
        await expect(page.getByRole("button", { name: "Guardar curso" })).toBeVisible({ timeout: 30000 });
      },
    };
    return tarea;
  }
}
