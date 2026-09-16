import type { Page } from "@playwright/test";

/** Habilidad: interactuar con la web mediante una Page de Playwright. */
export class NavegarLaWeb {
  constructor(readonly page: Page) {}

  static con(page: Page): NavegarLaWeb {
    return new NavegarLaWeb(page);
  }
}
