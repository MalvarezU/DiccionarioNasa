# Screenplay E2E — convenciones (leer antes de tocar `e2e/screenplay/`)

Actor/Task/Question sobre Playwright, nombres de negocio en español.

## Reparto de responsabilidades

1. **Tasks hacen y esperan estabilidad.** Pueden usar `expect()` SOLO para
   esperas de visibilidad/habilitado (`toBeVisible`, `toBeEnabled`,
   `toHaveCount(0)` cuando "ausencia" es la señal). Nunca aserciones finales.
2. **Questions devuelven valores** (`string`/`number`/`boolean`). La aserción
   final vive en el spec con `expect()`. Para "ausencia" (count 0) la Question
   espera con polling interno y devuelve el valor.
3. **Locators SOLO dentro de Tasks/Questions.** El spec nombra negocio
   (`MoverLeccion.abajo()`), nunca selectores.
4. Todo spec arranca con `test.describe.configure({ timeout: 180000 })`
   (BD gratuita lenta; ver `admin.spec.ts:13`).
5. Todo dato de prueba con prefijo `E2E ` → lo limpia el teardown global.
6. `setup.ts`/`teardown.ts` NO se migran (infra).
7. Side effects inevitables (descarga de CSV, `waitForEvent`) se encapsulan en
   la Task/Question con comentario que lo declare.

## Dónde va cada cosa

- `actor.ts`, `habilidades.ts`, `actores.ts` — núcleo (no tocar sin motivo).
- `tasks/<dominio>.ts` — una clase por acción de negocio.
- `questions/<dominio>.ts` — una clase por valor observable.
- `../<dominio>.screenplay.spec.ts` — guiones (un test = un flujo de usuario).

## Ejemplo

```ts
await admin.intenta(
  IrAGestionDeCursos.ahora(),
  AnadirLeccion.titulada(leccion).dosVecesSeguidas()
);
expect(await admin.pregunta(CantidadDeLecciones.tituladas(leccion))).toBe(1);
```
