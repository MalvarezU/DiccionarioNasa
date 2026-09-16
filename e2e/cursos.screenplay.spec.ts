import { test, expect } from "@playwright/test";
import { actorAdmin } from "./screenplay/actores";
import {
  IrAGestionDeCursos,
  CrearCurso,
  AbrirCurso,
  CrearModulo,
  AnadirLeccion,
  AbrirEditorDeLeccion,
  MoverLeccion,
  CerrarEditor,
} from "./screenplay/tasks/cursos";
import {
  CantidadDeLecciones,
  TituloEnEditor,
  NumeroEnModal,
  NumeroEnFila,
} from "./screenplay/questions/cursos";

/**
 * Piloto Screenplay (patrón Actor/Task/Question).
 * Replica el caso "doble click crea una sola lección" de admin.spec.ts.
 * Limpieza: el teardown global borra los cursos "E2E *".
 */
// BD gratuita lenta: timeouts amplios (igual que admin.spec.ts)
test.describe.configure({ timeout: 180000 });
test("screenplay: doble click crea una sola lección", async ({ page }) => {
  const stamp = Date.now();
  const curso = `E2E Curso ${stamp}`;
  const modulo = `E2E Módulo ${stamp}`;
  const leccion = `E2E Lección ${stamp}`;

  const admin = actorAdmin(page);

  await admin.intenta(
    IrAGestionDeCursos.ahora(),
    CrearCurso.titulado(curso),
    AbrirCurso.titulado(curso),
    CrearModulo.titulado(modulo),
    AnadirLeccion.titulada(leccion).dosVecesSeguidas()
  );

  expect(await admin.pregunta(CantidadDeLecciones.tituladas(leccion))).toBe(1);
});

test("screenplay: editor pre-rellena y reordenar re-numera", async ({ page }) => {
  const stamp = Date.now();
  const curso = `E2E Curso Ed ${stamp}`;
  const modulo = `E2E Mod ${stamp}`;
  const primera = `E2E Primera ${stamp}`;
  const segunda = `E2E Segunda ${stamp}`;

  const admin = actorAdmin(page);

  await admin.intenta(
    IrAGestionDeCursos.ahora(),
    CrearCurso.titulado(curso),
    AbrirCurso.titulado(curso),
    CrearModulo.titulado(modulo),
    AnadirLeccion.titulada(primera),
    AnadirLeccion.titulada(segunda),
    AbrirEditorDeLeccion.titulada(primera)
  );

  // El editor pre-rellena el título
  expect(await admin.pregunta(TituloEnEditor.mostrado())).toBe(primera);

  // Mover la primera hacia abajo: el modal refleja 1.2...
  await admin.intenta(MoverLeccion.abajo());
  expect(await admin.pregunta(NumeroEnModal.mostrado())).toBe("1.2");

  // ...y en la lista la segunda ahora es 1.1
  await admin.intenta(CerrarEditor.ahora());
  expect(await admin.pregunta(NumeroEnFila.titulada(segunda))).toBe("1.1");
});
