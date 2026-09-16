import { expect } from "@playwright/test";
import type { Actor, Task } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** Navegar a una ruta de la app. */
export class IrA implements Task {
  descripcion: string;
  private constructor(private ruta: string) {
    this.descripcion = `ir a ${ruta}`;
  }
  static a(ruta: string): IrA {
    return new IrA(ruta);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.goto(this.ruta);
  }
}

/** Recargar la página actual. */
export class Recargar implements Task {
  descripcion = "recargar la página";
  static ahora(): Recargar {
    return new Recargar();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.reload();
  }
}

/**
 * Cerrar overlays/modales con Escape (p.ej. la ficha tapa el menú).
 * No falla si no hay nada que cerrar.
 */
export class CerrarOverlay implements Task {
  descripcion = "cerrar overlay con Escape";
  static ahora(): CerrarOverlay {
    return new CerrarOverlay();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.keyboard.press("Escape").catch(() => {});
  }
}

/** Abrir el menú de usuario autenticado (botón con su nombre). */
export class AbrirMenuUsuario implements Task {
  descripcion = "abrir menú de usuario";
  static ahora(): AbrirMenuUsuario {
    return new AbrirMenuUsuario();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: /E2E User/ }).click();
    await expect(page.getByRole("menuitem").first()).toBeVisible({ timeout: 15000 });
  }
}
