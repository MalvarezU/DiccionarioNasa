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
  ArchivarCursoAbierto,
  EliminarCurso,
  AbrirContenidoDeLeccion,
  AgregarBloqueDeTexto,
  AgregarBloqueDeVocabulario,
  GuardarContenido,
  CerrarContenido,
  SubirPortadaDelCurso,
  GuardarCursoMeta,
} from "./screenplay/tasks/cursos";
import { OpcionDeBusqueda } from "./screenplay/questions/fichas";
import { BloquesDeLeccion, PortadaEnCatalogo } from "./screenplay/questions/cursos";
import { PanelMuestra } from "./screenplay/questions/admin";
import { CursoListado, CursoAusente } from "./screenplay/questions/cursos-publico";
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
    await admin.intenta(IrA.a("/diccionario"), BuscarPalabra.conTermino(palabra));
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
    await admin.intenta(IrA.a("/diccionario"), BuscarPalabra.conTermino(palabra));
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
    const mod1 = `E2E Módulo A ${stamp}`;
    const mod2 = `E2E Módulo B ${stamp}`;
    const leccion = `E2E Lección ${stamp}`;
    const admin = actorAdmin(page);

    await admin.intenta(
      IrAGestionDeCursos.ahora(),
      CrearCurso.titulado(curso),
      AbrirCurso.titulado(curso),
      CrearModulo.titulado(mod1),
      CrearModulo.titulado(mod2),
      // Doble click en el formulario DEL SEGUNDO módulo
      AnadirLeccion.aModulo(mod2, leccion).dosVecesSeguidas()
    );

    expect(await admin.pregunta(CantidadDeLecciones.tituladas(leccion))).toBe(1);
  });

  test("curso: publicar por UI muestra badge y lista en catálogo", async ({ page }) => {
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

    // Verificación real: aparece en el catálogo público
    await admin.intenta(IrA.a("/cursos"));
    expect(await admin.pregunta(CursoListado.titulado(curso))).toBe(true);
  });

  test("curso: archivar por UI lo saca del catálogo", async ({ page }) => {
    const stamp = Date.now();
    const curso = `E2E Arch ${stamp}`;
    const admin = actorAdmin(page);

    await admin.intenta(
      IrAGestionDeCursos.ahora(),
      CrearCurso.titulado(curso),
      AbrirCurso.titulado(curso),
      PublicarCursoAbierto.ahora(),
      ArchivarCursoAbierto.ahora()
    );
    expect(await admin.pregunta(PanelMuestra.texto("Archivado"))).toBe(true);

    // Verificación real: ya no está en el catálogo público
    await admin.intenta(IrA.a("/cursos"));
    expect(await admin.pregunta(CursoAusente.titulado(curso))).toBe(true);
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

    // ...y de vuelta hacia arriba: el modal refleja 1.1
    await admin.intenta(MoverLeccion.arriba());
    expect(await admin.pregunta(NumeroEnModal.mostrado())).toBe("1.1");

    // En la lista, todo volvió a su lugar: la segunda es 1.2
    await admin.intenta(CerrarEditor.ahora());
    expect(await admin.pregunta(NumeroEnFila.titulada(segunda))).toBe("1.2");

    // Limpieza explícita (ya estamos en el detalle: cascada a módulos y lecciones)
    await admin.intenta(EliminarCurso.titulado(curso));
  });

  // Fase 3 de cursos: el editor de contenido (bloques) con vista previa.
  test("curso: el editor de contenido arma y guarda la lección", async ({ page }) => {
    const stamp = Date.now();
    const curso = `E2E Contenido ${stamp}`;
    const modulo = `E2E Módulo C ${stamp}`;
    const leccion = `E2E Lección ${stamp}`;
    const admin = actorAdmin(page);

    await admin.intenta(
      IrAGestionDeCursos.ahora(),
      CrearCurso.titulado(curso),
      AbrirCurso.titulado(curso),
      CrearModulo.titulado(modulo),
      AnadirLeccion.aModulo(modulo, leccion),
      AbrirContenidoDeLeccion.titulada(leccion),
      AgregarBloqueDeTexto.conTexto(
        "# El saludo\n\nEn Nasa Yuwe el saludo cambia según la hora."
      ),
      AgregarBloqueDeVocabulario.conUnaPalabra("Casa"),
      GuardarContenido.deLaLeccion()
    );

    // Verificación REAL: cerrar, reabrir y encontrar los bloques guardados
    await admin.intenta(CerrarContenido.ahora());
    await admin.intenta(AbrirContenidoDeLeccion.titulada(leccion));
    expect(
      await admin.pregunta(BloquesDeLeccion.guardados(["Texto", "Vocabulario"]))
    ).toBe(true);
  });

  // Fase 5: portada del curso — se sube, se guarda, se publica y el catálogo
  // la muestra. Creamos módulo+lección para que la ficha sea navegable (una
  // sin lecciones es "Próximamente" a propósito y la muted no muestra cover).
  test("curso: la portada se sube y el catálogo la muestra", async ({ page }) => {
    const stamp = Date.now();
    const curso = `E2E Portada ${stamp}`;
    const admin = actorAdmin(page);

    await admin.intenta(
      IrAGestionDeCursos.ahora(),
      CrearCurso.titulado(curso),
      CrearModulo.titulado("Módulo P"),
      AnadirLeccion.aModulo("Módulo P", "Lección P"),
      SubirPortadaDelCurso.ahora(),
      GuardarCursoMeta.ahora(),
      PublicarCursoAbierto.ahora()
    );

    expect(await admin.pregunta(PortadaEnCatalogo.delCurso(curso))).toBe(true);
  });

  // Fase 6: stats de progreso + preview como estudiante en el panel.
  test("curso: stats de progreso y preview como estudiante", async ({ page }) => {
    const stamp = Date.now();
    const curso = `E2E Stats ${stamp}`;
    const admin = actorAdmin(page);

    await admin.intenta(
      IrAGestionDeCursos.ahora(),
      CrearCurso.titulado(curso)
    );

    // La fila de stats siempre está (aunque sea en cero); es un question:
    // verifica visible y Parsing de las piezas.
    const stats = page.getByTestId("curso-stats");
    await expect(stats).toBeVisible({ timeout: 15000 });
    await expect(stats).toContainText("alumno");
    await expect(stats).toContainText("lección");

    // El vínculo apunta al curso público (borradores lo ven los editores).
    const preview = page.getByRole("link", { name: /Ver como estudiante/i });
    await expect(preview).toBeVisible({ timeout: 15000 });
    const href = await preview.getAttribute("href");
    expect(href).toMatch(/^\/cursos\//);
  });

  // Fase 1 de cursos: las imágenes van a Postgres (bytea) y se sirven por
  // /api/media/[id]. Prueba de ida y vuelta contra el server real.
  const PNG_1X1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
    "base64"
  );

  test("imagen de curso: sube a Postgres y vuelve idéntica", async ({ page }) => {
    const subida = await page.request.post("/api/admin/upload-image", {
      multipart: {
        file: { name: "e2e-curso.png", mimeType: "image/png", buffer: PNG_1X1 },
      },
    });
    expect(subida.status()).toBe(200);
    const body = await subida.json();
    expect(body.url).toMatch(/^\/api\/media\//);
    expect(body.mimeType).toBe("image/png");

    const servida = await page.request.get(body.url);
    expect(servida.status()).toBe(200);
    expect(servida.headers()["content-type"]).toBe("image/png");
    expect(servida.headers()["cache-control"]).toContain("immutable");
    expect(servida.headers()["x-content-type-options"]).toBe("nosniff");

    // Los bytes vuelven EXACTOS: es lo que prueba que el bytea está sano.
    expect((await servida.body()).equals(PNG_1X1)).toBe(true);
  });

  test("imagen de curso: rechaza SVG disfrazado de PNG", async ({ page }) => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    );
    const res = await page.request.post("/api/admin/upload-image", {
      multipart: {
        file: { name: "e2e-malicioso.png", mimeType: "image/png", buffer: svg },
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toMatch(/SVG/);
  });

  test("imagen inexistente devuelve 404", async ({ page }) => {
    const res = await page.request.get("/api/media/no-existe-esta-imagen");
    expect(res.status()).toBe(404);
  });
});
