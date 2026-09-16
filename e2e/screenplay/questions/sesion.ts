import { expect } from "@playwright/test";
import type { Actor, Question } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** La sesión está cerrada (botón de iniciar sesión visible). */
export class SesionCerrada {
  static valor(): Question<boolean> {
    return {
      descripcion: "sesión cerrada",
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByRole("button", { name: /iniciar sesión/i }).first()).toBeVisible({
          timeout: 10000,
        });
        return true;
      },
    };
  }
}
