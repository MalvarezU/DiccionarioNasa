import type { APIRequestContext, Page } from "@playwright/test";
import { request as playwrightRequest } from "@playwright/test";
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

/**
 * Contexto API autenticado como admin (para Tasks Preparar* en specs
 * multi-actor, donde no hay fixture `request` con sesión).
 */
export async function apiDeAdmin(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    storageState: "e2e/.auth/admin.json",
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
  });
}

/** Actor sin página: solo planta escenarios vía API (Tasks Preparar*). */
export function actorPreparador(request: APIRequestContext): Actor {
  return Actor.llamado("Preparador").con(LlamarLaApi.con(request));
}
