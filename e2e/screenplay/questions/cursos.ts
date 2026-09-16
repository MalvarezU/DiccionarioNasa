import type { Actor, Question } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** Cuántas veces aparece un título de lección (para probar dedupe/doble click). */
export class CantidadDeLecciones {
  static tituladas(titulo: string): Question<number> {
    return {
      descripcion: `cantidad de lecciones tituladas "${titulo}"`,
      async responder(actor: Actor): Promise<number> {
        const { page } = actor.usa(NavegarLaWeb);
        await page.getByText(titulo).first().waitFor({ timeout: 30000 });
        return page.getByText(titulo).count();
      },
    };
  }
}
