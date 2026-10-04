import { expect } from "@playwright/test";
import type { Actor, Question } from "../actor";
import { LlamarLaApi, NavegarLaWeb } from "../habilidades";

/** Un curso aparece en el catálogo público. */
export class CursoListado {
  static titulado(titulo: string): Question<boolean> {
    return {
      descripcion: `curso "${titulo}" listado`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByText(titulo)).toBeVisible({ timeout: 15000 });
        return true;
      },
    };
  }
}

/** Un curso NO aparece en el catálogo público (espera con polling). */
export class CursoAusente {
  static titulado(titulo: string): Question<boolean> {
    return {
      descripcion: `curso "${titulo}" ausente del catálogo`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByText(titulo)).toHaveCount(0, { timeout: 15000 });
        return true;
      },
    };
  }
}
/** Un módulo es visible en el detalle del curso. */
export class ModuloVisible {
  static conPatron(patron: string | RegExp): Question<boolean> {
    return {
      descripcion: `módulo visible "${patron}"`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByText(patron, { exact: false })).toBeVisible({ timeout: 30000 });
        return true;
      },
    };
  }
}

/** Una lección numerada es visible (numeración persistida desde BD). */
export class LeccionNumerada {
  static conPatron(patron: RegExp): Question<boolean> {
    return {
      descripcion: `lección numerada ${patron}`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByRole("button", { name: patron })).toBeVisible({
          timeout: 15000,
        });
        return true;
      },
    };
  }
}

/** El progreso del curso muestra el valor esperado (espera con polling). */
export class ProgresoEs {
  static valor(esperado: string): Question<boolean> {
    return {
      descripcion: `progreso del curso "${esperado}"`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await expect(page.getByText(esperado, { exact: false }).first()).toBeVisible({
          timeout: 15000,
        });
        return true;
      },
    };
  }
}

/** Id del primer curso publicado (vía API, para navegar directo). */
export class PrimerCursoId {
  static valor(): Question<string> {
    return {
      descripcion: "id del primer curso",
      async responder(actor: Actor): Promise<string> {
        const { request } = actor.usa(LlamarLaApi);
        const res = await request.get("/api/courses");
        if (!res.ok()) throw new Error(`GET /api/courses → ${res.status()}`);
        const { courses } = await res.json();
        if (!courses?.length) throw new Error("sin cursos publicados");
        return courses[0].id as string;
      },
    };
  }
}

/**
 * Estado de un módulo en el detalle público, por título.
 * `.trasCompletar()` espera con polling a que desaparezca el badge
 * (el árbol tarda un refetch en reflejar el desbloqueo).
 */
export class EstadoDeModulo {
  descripcion: string;
  private esperaCambio = false;
  private constructor(private titulo: string) {
    this.descripcion = `estado del módulo "${titulo}"`;
  }
  static titulado(titulo: string): EstadoDeModulo {
    return new EstadoDeModulo(titulo);
  }
  trasCompletar(): EstadoDeModulo {
    this.esperaCambio = true;
    return this;
  }
  private bloque(page: import("@playwright/test").Page) {
    return page.locator(
      `[data-testid="module-block"][data-module-title="${this.titulo}"]`
    );
  }
  async responder(actor: Actor): Promise<"bloqueado" | "desbloqueado"> {
    const { page } = actor.usa(NavegarLaWeb);
    const bloque = this.bloque(page);
    await bloque.waitFor({ timeout: 30000 });
    const badge = bloque.getByText("Bloqueado", { exact: true });
    if (!this.esperaCambio) {
      return (await badge.count()) > 0 ? "bloqueado" : "desbloqueado";
    }
    try {
      await expect(badge).toHaveCount(0, { timeout: 20000 });
      return "desbloqueado";
    } catch {
      return "bloqueado";
    }
  }
}

/** Una lección del acordeón está completada (data-completed en la fila). */
export class LeccionCompleta {
  static es(patron: RegExp): Question<boolean> {
    return {
      descripcion: `lección ${patron} completada`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        const fila = page.getByRole("button", { name: patron }).first();
        await fila.waitFor({ timeout: 30000 });
        // Polling interno: el progreso llega del backend tras recargar.
        await expect(fila).toHaveAttribute("data-completed", "true", {
          timeout: 30000,
        });
        return true;
      },
    };
  }
}
