import { test, expect } from "@playwright/test";
import { actorUsuario } from "./screenplay/actores";
import { IrA, Recargar, CerrarOverlay, AbrirMenuUsuario } from "./screenplay/tasks/acciones";
import { AbrirFicha, MarcarFavorita, QuitarFavorita } from "./screenplay/tasks/fichas";
import { AbrirHistorial, CerrarSesion } from "./screenplay/tasks/sesion";
import { MarcarPrimeraLeccionCompletada } from "./screenplay/tasks/cursos-publico";
import { EstadoFavorita, HistorialContiene } from "./screenplay/questions/fichas";
import { SesionCerrada } from "./screenplay/questions/sesion";
import { PrimerCursoId, ProgresoEs } from "./screenplay/questions/cursos-publico";
import { AbrirLeccionNumerada, ResolverQuizInteractivo } from "./screenplay/tasks/cursos-publico";
import { LeccionCompleta } from "./screenplay/questions/cursos-publico";

/**
 * Flujos de usuario autenticado (migración de user.spec.ts).
 * Sin escrituras destructivas: favoritas/historial/progreso del e2e-user
 * se borran en cascada con el usuario (teardown).
 */
test.describe("usuario Piiyaak (Screenplay)", () => {
  // La BD gratuita responde 3-12 s bajo carga: timeouts amplios
  test.describe.configure({ timeout: 180000 });

  test("favorita persiste al recargar", async ({ page }) => {
    const usuario = actorUsuario(page);
    await usuario.intenta(
      IrA.a("/diccionario"),
      AbrirFicha.conTermino("Casa", /casa/i),
      MarcarFavorita.ahora(),
      Recargar.ahora(),
      AbrirFicha.conTermino("Casa", /casa/i)
    );
    // Sigue marcada tras recargar...
    expect(await usuario.pregunta(EstadoFavorita.actual())).toBe("quitar");
    // ...y se puede quitar (limpieza)
    await usuario.intenta(QuitarFavorita.ahora());
    expect(await usuario.pregunta(EstadoFavorita.actual())).toBe("guardar");
  });

  test("historial registra la visita", async ({ page }) => {
    const usuario = actorUsuario(page);
    await usuario.intenta(
      IrA.a("/diccionario"),
      AbrirFicha.conTermino("Agua", /agua/i),
      // Cerrar la ficha (el overlay tapa el menú de usuario)
      CerrarOverlay.ahora(),
      AbrirMenuUsuario.ahora(),
      AbrirHistorial.ahora()
    );
    expect(await usuario.pregunta(HistorialContiene.palabra("Agua"))).toBe(true);
  });

  test("curso: completar lección persiste progreso", async ({ page, request }) => {
    const usuario = actorUsuario(page, request);
    const courseId = await usuario.pregunta(PrimerCursoId.valor());
    await usuario.intenta(IrA.a(`/cursos/${courseId}`));
    expect(await usuario.pregunta(ProgresoEs.valor("0/"))).toBe(true);
    await usuario.intenta(MarcarPrimeraLeccionCompletada.ahora());
    expect(await usuario.pregunta(ProgresoEs.valor("1/"))).toBe(true);
    await usuario.intenta(Recargar.ahora());
    expect(await usuario.pregunta(ProgresoEs.valor("1/"))).toBe(true);
  });

  // Fase 4 de cursos: la lección rica (bloques) se juega y se completa.
  // Va DESPUÉS del test de progreso: el counter es por curso, así que acá no
  // se afirma el contador sino la lección misma (señal por fila).
  test("curso: la lección con quiz propio se completa y persiste", async ({ page, request }) => {
    const usuario = actorUsuario(page, request);
    const courseId = await usuario.pregunta(PrimerCursoId.valor());
    await usuario.intenta(
      IrA.a(`/cursos/${courseId}`),
      AbrirLeccionNumerada.conPatron(/1\.3/),
      ResolverQuizInteractivo.delBloque()
    );
    // La fila quedó marcada como completada...
    expect(await usuario.pregunta(LeccionCompleta.es(/1\.3/))).toBe(true);
    // ...y el progreso persiste en el backend: al recargar sigue.
    await usuario.intenta(Recargar.ahora());
    expect(await usuario.pregunta(LeccionCompleta.es(/1\.3/))).toBe(true);
  });

  // ÚLTIMO: mata su propia sesión (no afecta el storageState global).
  test("logout cierra la sesión", async ({ page }) => {
    const usuario = actorUsuario(page);
    await usuario.intenta(IrA.a("/"), AbrirMenuUsuario.ahora(), CerrarSesion.ahora());
    expect(await usuario.pregunta(SesionCerrada.valor())).toBe(true);
  });
});
