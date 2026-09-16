import type { APIRequestContext, Page } from "@playwright/test";

/** Habilidad: interactuar con la web mediante una Page de Playwright. */
export class NavegarLaWeb {
  constructor(readonly page: Page) {}

  static con(page: Page): NavegarLaWeb {
    return new NavegarLaWeb(page);
  }
}

/** Habilidad: llamar a la API del backend (fixture `request`). */
export class LlamarLaApi {
  constructor(readonly request: APIRequestContext) {}

  static con(request: APIRequestContext): LlamarLaApi {
    return new LlamarLaApi(request);
  }
}

/**
 * Habilidad: aceptar automáticamente los diálogos nativos de confirmación.
 * Se instala al construirla; úsala en actores que eliminan/archivan.
 */
export class AceptarConfirmaciones {
  constructor(page: Page) {
    page.on("dialog", (d) => void d.accept());
  }

  static siempre(page: Page): AceptarConfirmaciones {
    return new AceptarConfirmaciones(page);
  }
}
