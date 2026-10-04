import { expect } from "@playwright/test";
import type { Actor, Task } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** Abrir el modal de nueva ficha desde el dashboard. */
export class AbrirNuevaFicha implements Task {
  descripcion = "abrir nueva ficha";
  static ahora(): AbrirNuevaFicha {
    return new AbrirNuevaFicha();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: /nueva ficha/i }).click();
  }
}

/** Crear y publicar una ficha (español + nasa yuwe). */
export class CrearYPublicarFicha implements Task {
  descripcion: string;
  private constructor(
    private espanol: string,
    private nasaYuwe: string
  ) {
    this.descripcion = `crear y publicar ficha "${espanol}"`;
  }
  static conPalabras(espanol: string, nasaYuwe: string): CrearYPublicarFicha {
    return new CrearYPublicarFicha(espanol, nasaYuwe);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByLabel(/español/i).fill(this.espanol);
    await page.getByLabel(/nasa yuwe/i).fill(this.nasaYuwe);
    await page.getByRole("button", { name: /guardar y publicar/i }).click();
    await expect(page.getByText(/ficha guardada|éxito|publicada/i).first()).toBeVisible({
      timeout: 15000,
    });
  }
}

/** Abrir la gestión de fichas desde el dashboard. */
export class AbrirGestionFichas implements Task {
  descripcion = "abrir gestión de fichas";
  static ahora(): AbrirGestionFichas {
    return new AbrirGestionFichas();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: /gestionar fichas/i }).click();
    await expect(page.getByText("Gestión de fichas")).toBeVisible({ timeout: 20000 });
  }
}

/** Buscar una ficha en la gestión (si hay buscador visible). */
export class BuscarFichaEnGestion implements Task {
  descripcion: string;
  private constructor(private termino: string) {
    this.descripcion = `buscar ficha "${termino}" en gestión`;
  }
  static conTermino(termino: string): BuscarFichaEnGestion {
    return new BuscarFichaEnGestion(termino);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    const search = page.getByPlaceholder(/buscar/i);
    if (await search.isVisible().catch(() => false)) {
      await search.fill(this.termino);
      // La búsqueda del modal es BAJO DEMANDA (botón Buscar o Enter): si solo
      // llenábamos el input y seguíamos, la lista podía seguir sin filtrar.
      // Entonces "AbrirPrimeraEdicion" abría la PRIMERA fila de la lista
      // completa ("Agua", alfabético) y el archivar le pegaba a la palabra
      // seed — dos corridas la dejaron ARCHIVED. Señal estable: la fila
      // filtrada tiene que estar visible antes de seguir.
      await page.getByRole("button", { name: "Buscar" }).click();
      await expect(
        page.getByRole("cell", { name: this.termino }).first()
      ).toBeVisible({ timeout: 30000 });
    }
  }
}

/** Abrir la edición de la primera ficha de la lista. */
export class AbrirPrimeraEdicion implements Task {
  descripcion = "abrir primera edición";
  static ahora(): AbrirPrimeraEdicion {
    return new AbrirPrimeraEdicion();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: /editar/i }).first().click();
  }
}

/**
 * Archivar la ficha en edición, si el botón está disponible.
 * Espera el mensaje de confirmación cuando archiva (igual que admin.spec).
 */
export class ArchivarFicha implements Task {
  descripcion = "archivar ficha en edición";
  static ahora(): ArchivarFicha {
    return new ArchivarFicha();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    const archiveBtn = page.getByRole("button", { name: /archivar/i }).first();
    if (await archiveBtn.isVisible().catch(() => false)) {
      await archiveBtn.click();
      await expect(page.getByText(/archivada/i).first()).toBeVisible({ timeout: 10000 });
    }
  }
}

/**
 * Importar un corpus xlsx desde un buffer (el spec genera el archivo).
 * Espera preview + confirmación + mensaje de completitud.
 */
export class ImportarCorpus implements Task {
  descripcion = "importar corpus xlsx";
  private constructor(private buffer: Buffer) {
    this.descripcion = "importar corpus xlsx";
  }
  static desdeBuffer(buffer: Buffer): ImportarCorpus {
    return new ImportarCorpus(buffer);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: /importar corpus/i }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "corpus-e2e.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: this.buffer,
    });
    await expect(page.getByText(/vista previa/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/2 listas/i)).toBeVisible();
    await page.getByRole("button", { name: /confirmar/i }).click();
    await expect(page.getByText(/importación completada/i)).toBeVisible({ timeout: 15000 });
  }
}
