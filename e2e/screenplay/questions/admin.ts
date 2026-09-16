import { expect } from "@playwright/test";
import type { Actor, Question } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** El panel admin muestra una métrica/texto (espera incluida). */
export class PanelMuestra {
  static texto(texto: string | RegExp): Question<boolean> {
    return {
      descripcion: `panel muestra "${texto}"`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByText(texto).first()).toBeVisible({ timeout: 15000 });
        return true;
      },
    };
  }
}
