import type { APIRequestContext, Page } from "@playwright/test";
import { Actor } from "./actor";
import { AceptarConfirmaciones, LlamarLaApi, NavegarLaWeb } from "./habilidades";

/**
 * Builders de Actor por persona. El `request` es opcional: solo los actores
 * que consultan la API (p.ej. ElegirPrimerCurso) necesitan LlamarLaApi.
 * El admin acepta confirmaciones nativas (elimina/archiva sin prompts inline).
 */
export function actorVisitante(page: Page, request?: APIRequestContext): Actor {
  return base("Visitante", page, request);
}

export function actorUsuario(page: Page, request?: APIRequestContext): Actor {
  return base("Usuario", page, request);
}

export function actorAdmin(page: Page, request?: APIRequestContext): Actor {
  return base("Admin", page, request).con(AceptarConfirmaciones.siempre(page));
}

function base(nombre: string, page: Page, request?: APIRequestContext): Actor {
  const actor = Actor.llamado(nombre).con(NavegarLaWeb.con(page));
  if (request) actor.con(LlamarLaApi.con(request));
  return actor;
}
