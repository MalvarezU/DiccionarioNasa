import { test, expect } from "@playwright/test";
import { actorVisitante } from "./screenplay/actores";
import { IrA } from "./screenplay/tasks/acciones";
import { BuscarPalabra } from "./screenplay/tasks/fichas";
import { AbrirJuego } from "./screenplay/tasks/juegos";
import { AbrirCursoPublico } from "./screenplay/tasks/cursos-publico";
import {
  PlaceholderVisible,
  TextoVisible,
  EncabezadoVisible,
  UrlActual,
} from "./screenplay/questions/acciones";
import { OpcionDeBusqueda } from "./screenplay/questions/fichas";
import {
  HubMuestra,
  BloqueosEnHub,
  PartidaIniciada,
  GrupoDificultadVisible,
  CartasTapadas,
} from "./screenplay/questions/juegos";
import {
  CursoListado,
  ModuloVisible,
  LeccionNumerada,
} from "./screenplay/questions/cursos-publico";

/**
 * Recorridos públicos sin sesión (migración de public.spec.ts).
 * No escribe contenido; el juego reporta con sessionKey e2e-* (cleanup aparte).
 */
test.describe("Piiyaak público (Screenplay)", () => {
  // BD gratuita lenta: timeouts amplios
  test.describe.configure({ timeout: 180000 });

  test("portada carga con buscador y palabra del día", async ({ page }) => {
    const visitante = actorVisitante(page);
    await visitante.intenta(IrA.a("/"));
    expect(await visitante.pregunta(PlaceholderVisible.conPatron(/Buscar/))).toBe(true);
    expect(await visitante.pregunta(EncabezadoVisible.conNombre("Piiyaak"))).toBe(true);
  });

  test("buscar y abrir ficha", async ({ page }) => {
    const visitante = actorVisitante(page);
    await visitante.intenta(IrA.a("/"), BuscarPalabra.conTermino("casa"));
    expect(await visitante.pregunta(OpcionDeBusqueda.conPatron(/Casa/))).toBe(true);
  });

  test("juegos: hub con 3 juegos desbloqueados", async ({ page }) => {
    const visitante = actorVisitante(page);
    await visitante.intenta(AbrirJuego.en("/juegos"));
    expect(await visitante.pregunta(HubMuestra.juego(/Flashcards/))).toBe(true);
    expect(await visitante.pregunta(HubMuestra.juego(/Memoria/))).toBe(true);
    expect(await visitante.pregunta(HubMuestra.juego(/Completar/))).toBe(true);
    expect(await visitante.pregunta(BloqueosEnHub.cantidad())).toBe(0);
  });

  test("flashcards juega con palabras reales", async ({ page }) => {
    const visitante = actorVisitante(page);
    await visitante.intenta(AbrirJuego.en("/juegos/flashcards"));
    expect(await visitante.pregunta(PartidaIniciada.conSenal(/Pregunta 1 de/))).toBe(true);
  });

  test("memoria muestra tablero por dificultad", async ({ page }) => {
    const visitante = actorVisitante(page);
    await visitante.intenta(AbrirJuego.en("/juegos/memoria"));
    expect(await visitante.pregunta(GrupoDificultadVisible.valor())).toBe(true);
    expect(await visitante.pregunta(CartasTapadas.cantidad())).toBe(12);
  });

  test("cursos lista y detalle con árbol", async ({ page }) => {
    const visitante = actorVisitante(page);
    await visitante.intenta(IrA.a("/cursos"));
    expect(await visitante.pregunta(CursoListado.titulado("Nasa Yuwe Básico"))).toBe(true);
    await visitante.intenta(AbrirCursoPublico.titulado("Nasa Yuwe Básico"));
    expect(await visitante.pregunta(ModuloVisible.conPatron(/Módulo 1/))).toBe(true);
    // Numeración persistida "1.1" visible en la primera lección
    expect(await visitante.pregunta(LeccionNumerada.conPatron(/1\.1 · Lección/))).toBe(true);
  });

  test("admin sin sesión redirige (no expone panel)", async ({ page }) => {
    const visitante = actorVisitante(page);
    await visitante.intenta(IrA.a("/admin"));
    expect(await visitante.pregunta(UrlActual.valor())).not.toMatch(/\/admin/);
  });

  test("offline page existe", async ({ page }) => {
    const visitante = actorVisitante(page);
    await visitante.intenta(IrA.a("/offline"));
    expect(await visitante.pregunta(TextoVisible.conTexto("Sin conexión"))).toBe(true);
  });
});
