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
