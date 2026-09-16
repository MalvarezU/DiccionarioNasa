import { expect } from "@playwright/test";
import type { Actor, Question } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** Una opción de búsqueda es visible (espera incluida). */
export class OpcionDeBusqueda {
  static conPatron(patron: RegExp): Question<boolean> {
    return {
      descripcion: `opción de búsqueda ${patron}`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByRole("option", { name: patron }).first()).toBeVisible({
          timeout: 25000,
        });
        return true;
      },
    };
  }

  /** Cero opciones (espera con polling: la ausencia es la señal). */
  static ausente(patron: RegExp): Question<boolean> {
    return {
      descripcion: `sin opciones de búsqueda ${patron}`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByRole("option", { name: patron })).toHaveCount(0, {
          timeout: 10000,
        });
        return true;
      },
    };
  }
}

/** Estado del botón de favorita en la ficha abierta: "guardar" o "quitar". */
export class EstadoFavorita {
  static actual(): Question<"guardar" | "quitar"> {
    return {
      descripcion: "estado de favorita",
      async responder(actor: Actor): Promise<"guardar" | "quitar"> {
        const { page } = actor.usa(NavegarLaWeb);
        const quitar = page.getByRole("button", { name: /quitar de favoritos/i });
        if (await quitar.isVisible().catch(() => false)) return "quitar";
        await expect(page.getByRole("button", { name: /guardar en favoritos/i })).toBeVisible({
          timeout: 20000,
        });
        return "guardar";
      },
    };
  }
}

/** El historial del usuario contiene la palabra (espera incluida). */
export class HistorialContiene {
  static palabra(palabra: string): Question<boolean> {
    return {
      descripcion: `historial contiene "${palabra}"`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByText(palabra).first()).toBeVisible({ timeout: 15000 });
        return true;
      },
    };
  }
}
