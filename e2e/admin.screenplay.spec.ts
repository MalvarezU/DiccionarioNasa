import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import { actorAdmin } from "./screenplay/actores";
import { IrA } from "./screenplay/tasks/acciones";
import { BuscarPalabra } from "./screenplay/tasks/fichas";
import { IrADashboard } from "./screenplay/tasks/admin";
import {
  AbrirNuevaFicha,
  CrearYPublicarFicha,
  AbrirGestionFichas,
  BuscarFichaEnGestion,
  AbrirPrimeraEdicion,
  ArchivarFicha,
  ImportarCorpus,
} from "./screenplay/tasks/admin-fichas";
import { AbrirLogCompleto, descargarBitacora } from "./screenplay/tasks/admin-gobierno";
import {
  IrAGestionDeCursos,
  CrearCurso,
  AbrirCurso,
  CrearModulo,
  AnadirLeccion,
  AbrirEditorDeLeccion,
  MoverLeccion,
  CerrarEditor,
  PublicarCursoAbierto,
} from "./screenplay/tasks/cursos";
import { OpcionDeBusqueda } from "./screenplay/questions/fichas";
import { PanelMuestra } from "./screenplay/questions/admin";
import {
  CantidadDeLecciones,
  TituloEnEditor,
  NumeroEnModal,
  NumeroEnFila,
} from "./screenplay/questions/cursos";

/**
 * Flujos de admin (migración de admin.spec.ts + los 2 de cursos).
 * Crea palabras/cursos "E2E *" que el teardown borra.
 */
test.describe("admin Piiyaak (Screenplay)", () => {
  // BD gratuita lenta: timeouts amplios
  test.describe.configure({ timeout: 180000 });

  test("panel muestra estadísticas", async ({ page }) => {
    const admin = actorAdmin(page);
    await admin.intenta(IrADashboard.ahora());
    expect(await admin.pregunta(PanelMuestra.texto("Total de palabras"))).toBe(true);
  });

  test("ciclo de ficha: crear, publicar, archivar", async ({ page }) => {
    const stamp = Date.now();
    const palabra = `E2E Palabra ${stamp}`;
    const admin = actorAdmin(page);

    await admin.intenta(
      IrADashboard.ahora(),
      AbrirNuevaFicha.ahora(),
      CrearYPublicarFicha.conPalabras(palabra, `E2ENy ${stamp}`)
    );

    // Visible en búsqueda pública
    await admin.intenta(IrA.a("/"), BuscarPalabra.conTermino(palabra));
    expect(await admin.pregunta(OpcionDeBusqueda.conPatron(new RegExp(palabra, "i")))).toBe(true);

    // Archivar desde el modal de edición
    await admin.intenta(
      IrADashboard.ahora(),
      AbrirGestionFichas.ahora(),
      BuscarFichaEnGestion.conTermino(palabra),
      AbrirPrimeraEdicion.ahora(),
      ArchivarFicha.ahora()
    );

    // Ya no aparece en búsqueda pública
    await admin.intenta(IrA.a("/"), BuscarPalabra.conTermino(palabra));
    expect(await admin.pregunta(OpcionDeBusqueda.ausente(new RegExp(palabra, "i")))).toBe(true);
  });

  test("importar xlsx con preview y confirmación", async ({ page }) => {
    const stamp = Date.now();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Palabra_esp: `E2E Imp ${stamp} A`, Palabra_nyW: "ImpNyA" },
        { Palabra_esp: `E2E Imp ${stamp} B`, Palabra_nyW: "ImpNyB", Estado: "BORRADOR" },
        { Palabra_esp: "", Palabra_nyW: "" },
      ]),
      "Hoja1"
    );
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const admin = actorAdmin(page);
    await admin.intenta(IrADashboard.ahora(), ImportarCorpus.desdeBuffer(buf));
  });

  test("bitácora filtra y exporta CSV", async ({ page }) => {
    const admin = actorAdmin(page);
    await admin.intenta(IrADashboard.ahora(), AbrirLogCompleto.ahora());
    const { nombre, hayArchivo } = await descargarBitacora(admin);
    expect(nombre).toContain("bitacora-");
    expect(hayArchivo).toBe(true);
  });

  test("gestión de usuarios visible", async ({ page }) => {
    const admin = actorAdmin(page);
    await admin.intenta(IrADashboard.ahora());
    expect(await admin.pregunta(PanelMuestra.texto(/administra los roles/i))).toBe(true);
  });

  test("curso: crear módulo, doble click crea una sola lección", async ({ page }) => {
    const stamp = Date.now();
    const curso = `E2E Curso ${stamp}`;
    const admin = actorAdmin(page);

    await admin.intenta(
      IrAGestionDeCursos.ahora(),
      CrearCurso.titulado(curso),
      AbrirCurso.titulado(curso),
      CrearModulo.titulado(`E2E Módulo ${stamp}`),
      AnadirLeccion.titulada(`E2E Lección ${stamp}`).dosVecesSeguidas()
    );

    expect(await admin.pregunta(CantidadDeLecciones.tituladas(`E2E Lección ${stamp}`))).toBe(1);
  });

  test("curso: publicar por UI muestra badge", async ({ page }) => {
    const stamp = Date.now();
    const curso = `E2E Pub ${stamp}`;
    const admin = actorAdmin(page);

    await admin.intenta(
      IrAGestionDeCursos.ahora(),
      CrearCurso.titulado(curso),
      AbrirCurso.titulado(curso),
      PublicarCursoAbierto.ahora()
    );
    expect(await admin.pregunta(PanelMuestra.texto("Publicado"))).toBe(true);
  });

  test("curso: editor pre-rellena y reordenar re-numera", async ({ page }) => {
    const stamp = Date.now();
    const curso = `E2E Curso Ed ${stamp}`;
    const primera = `E2E Primera ${stamp}`;
    const segunda = `E2E Segunda ${stamp}`;
    const admin = actorAdmin(page);

    await admin.intenta(
      IrAGestionDeCursos.ahora(),
      CrearCurso.titulado(curso),
      AbrirCurso.titulado(curso),
      CrearModulo.titulado(`E2E Mod ${stamp}`),
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
});
