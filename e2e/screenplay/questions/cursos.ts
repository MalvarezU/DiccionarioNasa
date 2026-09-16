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

const NUMERO = /^\d+\.\d+$/;

/** Título pre-rellenado en el campo del editor abierto. */
export class TituloEnEditor {
  static mostrado(): Question<string> {
    return {
      descripcion: "título pre-rellenado en el editor",
      async responder(actor: Actor): Promise<string> {
        const { page } = actor.usa(NavegarLaWeb);
        return page.locator("#edit-lesson-title").inputValue({ timeout: 15000 });
      },
    };
  }
}

/** Número jerárquico (badge) que muestra el editor abierto. */
export class NumeroEnModal {
  static mostrado(): Question<string> {
    return {
      descripcion: "número jerárquico en el editor",
      async responder(actor: Actor): Promise<string> {
        const { page } = actor.usa(NavegarLaWeb);
        const badge = page.getByRole("dialog").getByText(NUMERO).first();
        await badge.waitFor({ timeout: 60000 });
        return (await badge.textContent())?.trim() ?? "";
      },
    };
  }
}

/** Número jerárquico (badge) de la fila de una lección en la lista. */
export class NumeroEnFila {
  static titulada(titulo: string): Question<string> {
    return {
      descripcion: `número jerárquico de la fila "${titulo}"`,
      async responder(actor: Actor): Promise<string> {
        const { page } = actor.usa(NavegarLaWeb);
        const fila = page.locator(
          `[data-testid="lesson-row"][data-lesson-title="${titulo}"]`
        );
        const badge = fila.getByText(NUMERO).first();
        await badge.waitFor({ timeout: 30000 });
        return (await badge.textContent())?.trim() ?? "";
      },
    };
  }
}

/** Mensaje de error mostrado en el editor abierto (p.ej. 409 por duplicado). */
export class ErrorEnModal {
  static valor(): Question<string> {
    return {
      descripcion: "error mostrado en el editor",
      async responder(actor: Actor): Promise<string> {
        const { page } = actor.usa(NavegarLaWeb);
        const msg = page.getByRole("dialog").locator("p.text-destructive").first();
        await msg.waitFor({ timeout: 15000 });
        return ((await msg.textContent()) ?? "").trim();
      },
    };
  }
}
