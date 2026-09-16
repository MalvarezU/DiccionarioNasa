import { expect } from "@playwright/test";
import type { Actor, Question } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** Un placeholder (input) es visible. */
export class PlaceholderVisible {
  static conPatron(patron: RegExp): Question<boolean> {
    return {
      descripcion: `placeholder visible ${patron}`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByPlaceholder(patron)).toBeVisible({ timeout: 15000 });
        return true;
      },
    };
  }
}

/** Un texto es visible (espera incluida). */
export class TextoVisible {
  static conTexto(texto: string | RegExp): Question<boolean> {
    return {
      descripcion: `texto visible "${texto}"`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByText(texto).first()).toBeVisible({ timeout: 15000 });
        return true;
      },
    };
  }
}

/** Un encabezado es visible. */
export class EncabezadoVisible {
  static conNombre(nombre: string | RegExp): Question<boolean> {
    return {
      descripcion: `encabezado visible "${nombre}"`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByRole("heading", { name: nombre })).toBeVisible({
          timeout: 15000,
        });
        return true;
      },
    };
  }
}

/** URL actual (para verificar redirecciones). */
export class UrlActual {
  static valor(): Question<string> {
    return {
      descripcion: "URL actual",
      async responder(actor: Actor): Promise<string> {
        return actor.usa(NavegarLaWeb).page.url();
      },
    };
  }
}
