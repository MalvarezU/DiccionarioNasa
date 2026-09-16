import type { Actor, Task } from "../actor";
import { NavegarLaWeb } from "../habilidades";
import { IrA } from "./acciones";

/** Abrir una ruta de juegos (la observación queda en las Questions). */
export class AbrirJuego implements Task {
  descripcion: string;
  private constructor(private ruta: string) {
    this.descripcion = `abrir ${ruta}`;
  }
  static en(ruta: "/juegos" | "/juegos/flashcards" | "/juegos/memoria"): AbrirJuego {
    return new AbrirJuego(ruta);
  }
  async ejecutar(actor: Actor): Promise<void> {
    await actor.intenta(IrA.a(this.ruta));
    // La navegación queda asentada cuando la Question observa su señal.
    await actor.usa(NavegarLaWeb).page.waitForLoadState("domcontentloaded").catch(() => {});
  }
}
