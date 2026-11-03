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
        return page.locator("#lesson-title").inputValue({ timeout: 15000 });
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

/** Mensaje de error al guardar (p.ej. 409 por duplicado).
 * El modal viejo lo mostraba inline; el modal de contenido usa toast. */
export class ErrorEnModal {
  static valor(): Question<string> {
    return {
      descripcion: "error mostrado al guardar",
      async responder(actor: Actor): Promise<string> {
        const { page } = actor.usa(NavegarLaWeb);
        const enDialogo = page.getByRole("dialog").locator("p.text-destructive").first();
        if (await enDialogo.isVisible().catch(() => false)) {
          return ((await enDialogo.textContent()) ?? "").trim();
        }
        // El toast trae título ("No se pudo guardar") + descripción con el
        // motivo: se lee la descripción, que es lo que afirma el spec.
        const detalle = page.getByText(/Ya existe otra lección/).first();
        await detalle.waitFor({ timeout: 15000 });
        return ((await detalle.textContent()) ?? "").trim();
      },
    };
  }
}

/** ¿El editor de contenido abierto tiene EXACTAMENTE estos tipos de bloque? */
export class BloquesDeLeccion {
  static guardados(tipos: string[]): Question<boolean> {
    return {
      descripcion: `la lección tiene bloques ${tipos.join(", ")}`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        // El encabezado de cada tarjeta muestra el tipo en un Badge.
        const badges = page.locator("[data-testid^='block-card-'] [data-slot='badge']");
        const textos = (await badges.allTextContents()).map((t) => t.trim());
        return JSON.stringify(textos) === JSON.stringify(tipos);
      },
    };
  }
}

/** El curso muestra SU portada en el catálogo público (/cursos). */
export class PortadaEnCatalogo {
  static delCurso(titulo: string): Question<boolean> {
    return {
      descripcion: `portada del curso "${titulo}" visible en /cursos`,
      async responder(actor: Actor): Promise<boolean> {
        const { page } = actor.usa(NavegarLaWeb);
        await page.goto("/cursos");
        const img = page.getByAltText(`Portada de ${titulo}`);
        await img.waitFor({ timeout: 30000 });
        const src = await img.getAttribute("src");
        if (!src) return false;
        // Igual que la allowlist del servidor: legacy /api/media o base R2.
        if (src.startsWith("/api/media/")) return true;
        const base = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
        return !!base && src.startsWith(`${base}/`);
      },
    };
  }
}
