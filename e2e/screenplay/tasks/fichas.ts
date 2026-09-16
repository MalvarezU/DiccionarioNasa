import { expect } from "@playwright/test";
import type { Actor, Task } from "../actor";
import { NavegarLaWeb } from "../habilidades";
import { CerrarOverlay } from "./acciones";

/** Escribir un término en el buscador (las sugerencias aparecen solas). */
export class BuscarPalabra implements Task {
  descripcion: string;
  private constructor(private termino: string) {
    this.descripcion = `buscar "${termino}"`;
  }
  static conTermino(termino: string): BuscarPalabra {
    return new BuscarPalabra(termino);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByPlaceholder(/Buscar/).fill(this.termino);
  }
}

/**
 * Abrir la ficha de una palabra desde el buscador.
 * Equivale al helper `openWord` de user.spec.ts: cierra overlays previos,
 * elige la opción y espera la ficha con su botón de favoritos.
 */
export class AbrirFicha implements Task {
  descripcion: string;
  private constructor(
    private termino: string,
    private patron: RegExp
  ) {
    this.descripcion = `abrir ficha de "${termino}"`;
  }
  static conTermino(termino: string, patron: RegExp): AbrirFicha {
    return new AbrirFicha(termino, patron);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await actor.intenta(CerrarOverlay.ahora());
    await page.getByPlaceholder(/Buscar/).fill(this.termino);
    const opcion = page.getByRole("option", { name: this.patron }).first();
    await expect(opcion).toBeVisible({ timeout: 20000 });
    await opcion.click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: new RegExp(this.termino, "i") })
    ).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: /favorit/i }).first()).toBeVisible({
      timeout: 20000,
    });
  }
}

/** Marcar la ficha abierta como favorita. */
export class MarcarFavorita implements Task {
  descripcion = "marcar favorita";
  static ahora(): MarcarFavorita {
    return new MarcarFavorita();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: /guardar en favoritos/i }).click();
    await expect(page.getByRole("button", { name: /quitar de favoritos/i })).toBeVisible({
      timeout: 20000,
    });
  }
}

/** Quitar la ficha abierta de favoritas. */
export class QuitarFavorita implements Task {
  descripcion = "quitar favorita";
  static ahora(): QuitarFavorita {
    return new QuitarFavorita();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: /quitar de favoritos/i }).click();
    await expect(page.getByRole("button", { name: /guardar en favoritos/i })).toBeVisible({
      timeout: 20000,
    });
  }
}
