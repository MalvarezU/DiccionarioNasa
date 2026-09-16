import { test, expect } from "@playwright/test";
import { Actor } from "./screenplay/actor";
import { NavegarLaWeb } from "./screenplay/habilidades";
import {
  IrAGestionDeCursos,
  CrearCurso,
  AbrirCurso,
  CrearModulo,
  AnadirLeccion,
} from "./screenplay/tasks/cursos";
import { CantidadDeLecciones } from "./screenplay/questions/cursos";

/**
 * Piloto Screenplay (patrón Actor/Task/Question).
 * Replica el caso "doble click crea una sola lección" de admin.spec.ts.
 * Limpieza: el teardown global borra los cursos "E2E *".
 */
test("screenplay: doble click crea una sola lección", async ({ page }) => {
  const stamp = Date.now();
  const curso = `E2E Curso ${stamp}`;
  const modulo = `E2E Módulo ${stamp}`;
  const leccion = `E2E Lección ${stamp}`;

  const admin = Actor.llamado("Admin").con(NavegarLaWeb.con(page));

  await admin.intenta(
    IrAGestionDeCursos.ahora(),
    CrearCurso.titulado(curso),
    AbrirCurso.titulado(curso),
    CrearModulo.titulado(modulo),
    AnadirLeccion.titulada(leccion).dosVecesSeguidas()
  );

  expect(await admin.pregunta(CantidadDeLecciones.tituladas(leccion))).toBe(1);
});
