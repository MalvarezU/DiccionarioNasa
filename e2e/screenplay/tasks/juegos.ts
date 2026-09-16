import { expect } from "@playwright/test";
import type { Actor, Task } from "../actor";
import { NavegarLaWeb } from "../habilidades";

export interface PalabraDeJuego {
  spanish: string;
  nasaYuwe: string;
}

/**
 * Juego fijo para completar (mock de /api/games/words).
 * Deben ser ≥4 o el juego cae a DEMO_WORDS; simples y sin tildes/espacios
 * para que los inputs de una letra las acepten siempre.
 */
const PALABRAS_FIJAS: PalabraDeJuego[] = [
  { spanish: "casa", nasaYuwe: "yat" },
  { spanish: "agua", nasaYuwe: "yu" },
  { spanish: "luna", nasaYuwe: "ate" },
  { spanish: "sol", nasaYuwe: "sek" },
];

/**
 * Abrir completar con juego fijo (mock; el reporte anónimo no persiste).
 * Determinista: la pregunta actual siempre sale de PALABRAS_FIJAS.
 */
export class AbrirCompletar implements Task {
  descripcion = "abrir completar con juego fijo";
  static ahora(): AbrirCompletar {
    return new AbrirCompletar();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.route("**/api/games/words*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          words: PALABRAS_FIJAS.map((w, i) => ({ id: `e2e-w${i + 1}`, ...w, pronunciation: null })),
          total: PALABRAS_FIJAS.length,
        }),
      })
    );
    await page.goto("/juegos/completar");
  }
}

/**
 * Resolver la palabra actual de completar: reconstruye la palabra cruzando
 * las letras visibles de la fila con el juego fijo, rellena los huecos
 * y verifica. Falla honesto si ninguna palabra matchea el patrón.
 */
export class CompletarPalabraActual implements Task {
  descripcion = "completar palabra actual";
  static ahora(): CompletarPalabraActual {
    return new CompletarPalabraActual();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    const fila = page.getByTestId("letter-row");
    await expect(fila.locator("input").first()).toBeVisible({ timeout: 15000 });

    // Hijos en orden de slot: INPUT → hueco (posición por aria-label),
    // SPAN → letra visible.
    const hijos = fila.locator(":scope > *");
    const n = await hijos.count();
    const patron: (string | null)[] = [];
    const posiciones: number[] = [];
    for (let i = 0; i < n; i++) {
      const h = hijos.nth(i);
      if ((await h.evaluate((el) => el.tagName)) === "INPUT") {
        const name = (await h.getAttribute("aria-label")) ?? "";
        const m = name.match(/Letra (\d+) de (\d+)/);
        if (!m) throw new Error(`input sin posición: "${name}"`);
        patron.push(null);
        posiciones.push(parseInt(m[1], 10));
      } else {
        patron.push((((await h.textContent()) ?? "").trim() || " ").toLowerCase());
      }
    }
    const M = patron.length;
    const candidatas = PALABRAS_FIJAS.map((w) => w.spanish.toLowerCase()).filter(
      (w) => w.length === M && patron.every((ch, i) => ch === null || w[i] === ch)
    );
    if (!candidatas.length) {
      throw new Error(
        `ninguna palabra matchea "${patron.map((c) => c ?? "_").join("")}" (M=${M})`
      );
    }
    const palabra = candidatas[0];
    for (const pos of posiciones) {
      await page
        .getByRole("textbox", { name: `Letra ${pos} de ${M}`, exact: true })
        .fill(palabra[pos - 1]);
    }
    await page.getByRole("button", { name: "Verificar" }).click();
    await expect(page.getByText("¡Correcto!")).toBeVisible({ timeout: 15000 });
  }
}

/** Responder la flashcard actual con la opción indicada (default: primera). */
export class ResponderFlashcard implements Task {
  descripcion: string;
  private constructor(private indice: number) {
    this.descripcion = `responder flashcard (opción ${indice + 1})`;
  }
  static opcion(indice = 0): ResponderFlashcard {
    return new ResponderFlashcard(indice);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByTestId("flash-option").nth(this.indice).click();
    await expect(page.getByRole("button", { name: "Siguiente", exact: true })).toBeVisible({
      timeout: 15000,
    });
  }
}

/** Avanzar a la siguiente flashcard. */
export class AvanzarFlashcard implements Task {
  descripcion = "avanzar flashcard";
  static ahora(): AvanzarFlashcard {
    return new AvanzarFlashcard();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  }
}

/** Cambiar la dificultad de memoria y esperar el tablero correspondiente. */
export class CambiarDificultadMemoria implements Task {
  descripcion: string;
  private constructor(
    private nivel: string,
    private cartas: number
  ) {
    this.descripcion = `dificultad memoria a ${nivel} (${cartas} cartas)`;
  }
  static a(nivel: "Fácil" | "Medio" | "Difícil"): CambiarDificultadMemoria {
    const cartas = nivel === "Fácil" ? 12 : nivel === "Medio" ? 16 : 24;
    return new CambiarDificultadMemoria(nivel, cartas);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    // El botón muestra "Difícil (12)": match por prefijo
    await page.getByRole("button", { name: new RegExp(`^${this.nivel}`) }).click();
    await expect(page.getByLabel(/Carta tapada/)).toHaveCount(this.cartas, { timeout: 15000 });
  }
}

/** Voltear la carta N de memoria (1-based). */
export class VoltearCartaMemoria implements Task {
  descripcion: string;
  private constructor(private n: number) {
    this.descripcion = `voltear carta ${n}`;
  }
  static numero(n: number): VoltearCartaMemoria {
    return new VoltearCartaMemoria(n);
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: `Carta tapada ${this.n}`, exact: true }).click();
  }
}

/** Pasar a la siguiente palabra de completar (tras un acierto). */
export class SiguientePalabra implements Task {
  descripcion = "siguiente palabra";
  static ahora(): SiguientePalabra {
    return new SiguientePalabra();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect(page.getByText("¡Correcto!")).toHaveCount(0, { timeout: 15000 });
  }
}
