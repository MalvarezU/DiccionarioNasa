import { expect } from "@playwright/test";
import type { Actor, Task } from "../actor";
import { NavegarLaWeb } from "../habilidades";

/** Abrir el log completo de auditoría desde el dashboard. */
export class AbrirLogCompleto implements Task {
  descripcion = "abrir log de auditoría";
  static ahora(): AbrirLogCompleto {
    return new AbrirLogCompleto();
  }
  async ejecutar(actor: Actor): Promise<void> {
    const { page } = actor.usa(NavegarLaWeb);
    await page.getByRole("button", { name: /ver log completo/i }).click();
    await expect(page.getByText(/log de auditoría/i).first()).toBeVisible({ timeout: 15000 });
  }
}

/**
 * Exportar la bitácora a CSV.
 * SIDE EFFECT declarado: captura el evento `download`. Devuelve nombre, ruta
 * y si el archivo existe, para que el spec aserte sin tocar locators.
 */
export async function descargarBitacora(
  actor: Actor
): Promise<{ nombre: string; ruta: string | null; hayArchivo: boolean }> {
  const { page } = actor.usa(NavegarLaWeb);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /exportar csv/i }).click();
  const download = await downloadPromise;
  const path = await download.path();
  return { nombre: download.suggestedFilename(), ruta: path, hayArchivo: Boolean(path) };
}
