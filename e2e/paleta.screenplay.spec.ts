import { test, expect } from "@playwright/test";

/**
 * Invariantes de la paleta Habano.
 *
 * No valida el CSS: valida los BYTES que el navegador pinta. Tailwind v4
 * serializa colores computados como oklab()/lab(), así que el canvas es la
 * única forma de obtener sRGB sin adivinar.
 */

const ratio = (a: number[], b: number[]) => {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = (p: number[]) =>
    0.2126 * lin(p[0]!) + 0.7152 * lin(p[1]!) + 0.0722 * lin(p[2]!);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test.describe("paleta", () => {
  test.describe.configure({ timeout: 90_000 });

  test("el borde de un control alcanza 3:1 contra su propio relleno (WCAG 1.4.11)", async ({
    page,
  }) => {
    await page.goto("/diccionario", { waitUntil: "domcontentloaded" });

    const medido = await page.evaluate(() => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1;
      const ctx = cv.getContext("2d")!;
      const bytes = (color: string): number[] | null => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return d[3] === 0 ? null : [d[0]!, d[1]!, d[2]!];
      };
      const input = document.querySelector<HTMLInputElement>(
        'input[role="combobox"]'
      );
      if (!input) return null;
      const cs = getComputedStyle(input);
      return {
        borde: bytes(cs.borderTopColor),
        relleno: bytes(cs.backgroundColor),
        grosor: parseFloat(cs.borderTopWidth),
      };
    });

    expect(medido, "no se encontró el buscador del diccionario").not.toBeNull();
    expect(medido!.grosor).toBeGreaterThan(0);

    const cr = ratio(medido!.borde!, medido!.relleno!);
    // Contexto: un borde de 1px es decorativo; el valor de corte para
    // identificar un control es 3:1. Antes de la Onda 1 daba 1.28:1.
    expect(
      cr,
      `borde ${cr.toFixed(2)}:1 — el campo se pierde sobre el papel`
    ).toBeGreaterThanOrEqual(3);
  });

  test("las superficies se separan del fondo con escalón perceptible", async ({
    page,
  }) => {
    await page.goto("/juegos", { waitUntil: "domcontentloaded" });

    const medido = await page.evaluate(() => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1;
      const ctx = cv.getContext("2d")!;
      const bytes = (color: string): number[] | null => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return d[3] === 0 ? null : [d[0]!, d[1]!, d[2]!];
      };
      const card = document.querySelector<HTMLElement>('[data-slot="card"]');
      return {
        fondo: bytes(getComputedStyle(document.body).backgroundColor),
        card: card ? bytes(getComputedStyle(card).backgroundColor) : null,
      };
    });

    expect(medido.card, "no se encontró un card en /juegos").not.toBeNull();

    const cr = ratio(medido.card!, medido.fondo!);
    // No es un umbral WCAG (eso es para texto y contornos): es el mínimo
    // para que el ojo registre el relieve. Antes los tres niveles de
    // superficie vivían con 0.02 de diferencia y los cards no se veían.
    expect(cr, `card contra fondo = ${cr.toFixed(3)} — superficie plana`).toBeGreaterThan(1.03);
  });
});