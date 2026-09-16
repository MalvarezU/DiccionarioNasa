import { expect } from "@playwright/test";
import type { Actor, Question } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** El hub muestra un juego desbloqueado. */
export class HubMuestra {
  static juego(nombre: string | RegExp): Question<boolean> {
    return {
      descripcion: `hub muestra "${nombre}"`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByText(nombre).first()).toBeVisible({ timeout: 15000 });
        return true;
      },
    };
  }
}

/** Cantidad de cards "Próximamente" en el hub (0 = todo desbloqueado). */
export class BloqueosEnHub {
  static cantidad(): Question<number> {
    return {
      descripcion: "cards Próximamente en el hub",
      async responder(actor: Actor): Promise<number> {
        const { page } = actor.usa(NavegarLaWeb);
        return page.getByText("Próximamente").count();
      },
    };
  }
}

/** La partida muestra su primera pregunta (señal de juego real). */
export class PartidaIniciada {
  static conSenal(senal: RegExp): Question<boolean> {
    return {
      descripcion: `partida iniciada (${senal})`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByText(senal).first()).toBeVisible({ timeout: 15000 });
        return true;
      },
    };
  }
}

/** El selector de dificultad de memoria es visible. */
export class GrupoDificultadVisible {
  static valor(): Question<boolean> {
    return {
      descripcion: "grupo Dificultad visible",
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByRole("group", { name: "Dificultad" })).toBeVisible({
          timeout: 15000,
        });
        return true;
      },
    };
  }
}

/** Cantidad de cartas tapadas en el tablero de memoria. */
export class CartasTapadas {
  static cantidad(): Question<number> {
    return {
      descripcion: "cartas tapadas en memoria",
      async responder(actor: Actor): Promise<number> {
        const { page } = actor.usa(NavegarLaWeb);
        return page.getByLabel(/Carta tapada/).count();
      },
    };
  }
}

/**
 * Etiqueta accesible de la carta N (1-based) del tablero.
 * Recién volteada: "texto (Español|Nasa Yuwe)"; tapada: "Carta tapada N".
 */
export class CartaRevelada {
  static numero(n: number): Question<string> {
    return {
      descripcion: `carta ${n} revelada`,
      async responder(actor: Actor): Promise<string> {
        const { page } = actor.usa(NavegarLaWeb);
        const carta = page
          .getByRole("group", { name: "Tablero de memoria" })
          .getByRole("button")
          .nth(n - 1);
        await carta.waitFor({ timeout: 15000 });
        return ((await carta.getAttribute("aria-label")) ?? "").trim();
      },
    };
  }
}
