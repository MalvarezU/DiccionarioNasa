import { expect } from "@playwright/test";
import type { Actor, Task } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** Abrir el historial desde el menú de usuario. */
export class AbrirHistorial implements Task {
  descripcion = "abrir mi historial";
  static ahora(): AbrirHistorial {
    return new AbrirHistorial();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("menuitem", { name: /mi historial/i }).click();
  }
}

/** Cerrar la sesión desde el menú de usuario. */
export class CerrarSesion implements Task {
  descripcion = "cerrar sesión";
  static ahora(): CerrarSesion {
    return new CerrarSesion();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("menuitem", { name: /cerrar sesión/i }).click();
  }
}
