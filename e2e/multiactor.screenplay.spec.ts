import { test, expect } from "@playwright/test";
import * as fs from "fs";
import {
  actorAdmin,
  actorUsuario,
  actorVisitante,
  actorPreparador,
  apiDeAdmin,
} from "./screenplay/actores";
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
} from "./screenplay/tasks/admin-fichas";
import { AbrirLogCompleto, descargarBitacora } from "./screenplay/tasks/admin-gobierno";
import { PrepararCurso } from "./screenplay/tasks/preparar";
import {
  IrAGestionDeCursos,
  CrearCurso,
  AbrirCurso,
  CrearModulo,
  AnadirLeccion,
  AbrirEditorDeLeccion,
  RenombrarLeccionEnEditor,
  GuardarLeccionEnEditor,
  PublicarCursoAbierto,
} from "./screenplay/tasks/cursos";
import {
  AbrirCursoPublico,
  MarcarPrimeraLeccionCompletada,
} from "./screenplay/tasks/cursos-publico";
import { OpcionDeBusqueda } from "./screenplay/questions/fichas";
import {
  CursoListado,
  ProgresoEs,
  EstadoDeModulo,
} from "./screenplay/questions/cursos-publico";
import { ErrorEnModal } from "./screenplay/questions/cursos";

/**
 * Escenarios multi-actor (Fase 3): dos o más actores sobre el mismo dato.
 * Los contextos se crean a mano con su storageState; el proyecto no usa
 * sesión global. Limpieza: teardown borra los "E2E *".
 * Timeout 300 s: 2-3 actores × BD gratuita lenta acumulan más de 180 s.
 */
test.describe("multi-actor (Screenplay)", () => {
  test.describe.configure({ timeout: 300000 });

  test("publicar→visible y archivar→invisible (admin + visitante)", async ({ browser }) => {
    const stamp = Date.now();
    const palabra = `E2E Multi ${stamp}`;

    const adminCtx = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    const visitCtx = await browser.newContext();
    try {
      const admin = actorAdmin(await adminCtx.newPage());
      const visitante = actorVisitante(await visitCtx.newPage());

      await admin.intenta(
        IrADashboard.ahora(),
        AbrirNuevaFicha.ahora(),
        CrearYPublicarFicha.conPalabras(palabra, `E2ENyM ${stamp}`)
      );

      // El visitante la encuentra en el buscador
      await visitante.intenta(IrA.a("/"), BuscarPalabra.conTermino(palabra));
      expect(
        await visitante.pregunta(OpcionDeBusqueda.conPatron(new RegExp(palabra, "i")))
      ).toBe(true);

      // El admin la archiva...
      await admin.intenta(
        IrADashboard.ahora(),
        AbrirGestionFichas.ahora(),
        BuscarFichaEnGestion.conTermino(palabra),
        AbrirPrimeraEdicion.ahora(),
        ArchivarFicha.ahora()
      );

      // ...y el visitante ya no la ve
      await visitante.intenta(IrA.a("/"), BuscarPalabra.conTermino(palabra));
      expect(
        await visitante.pregunta(OpcionDeBusqueda.ausente(new RegExp(palabra, "i")))
      ).toBe(true);
    } finally {
      await adminCtx.close();
      await visitCtx.close();
    }
  });

  test("bitácora refleja la acción del admin", async ({ browser }) => {
    const stamp = Date.now();
    const palabra = `E2E Audit ${stamp}`;

    const adminCtx = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    try {
      const admin = actorAdmin(await adminCtx.newPage());
      await admin.intenta(
        IrADashboard.ahora(),
        AbrirNuevaFicha.ahora(),
        CrearYPublicarFicha.conPalabras(palabra, `E2ENyA ${stamp}`),
        AbrirLogCompleto.ahora()
      );
      const { nombre, ruta, hayArchivo } = await descargarBitacora(admin);
      expect(nombre).toContain("bitacora-");
      expect(hayArchivo).toBe(true);
      expect(ruta).toBeTruthy();
      const csv = fs.readFileSync(ruta as string, "utf-8");
      expect(csv).toContain(palabra);
    } finally {
      await adminCtx.close();
    }
  });

  test("bloqueo secuencial: completar desbloquea (usuario), visitante ve bloqueado", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const curso = `E2E Sec ${stamp}`;
    const mod1 = `E2E SecM1 ${stamp}`;
    const mod2 = `E2E SecM2 ${stamp}`;

    const userCtx = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    const visitCtx = await browser.newContext();
    const apiCtx = await apiDeAdmin();
    try {
      const usuario = actorUsuario(await userCtx.newPage());
      const visitante = actorVisitante(await visitCtx.newPage());

      // Dado por API (rápido), ya publicado; la publicación por UI se prueba
      // en admin.screenplay.spec.ts ("curso: publicar por UI muestra badge")
      await actorPreparador(apiCtx).intenta(
        PrepararCurso.con({
          titulo: curso,
          publicado: true,
          modulos: [
            { titulo: mod1, lecciones: [`E2E SecL1 ${stamp}`] },
            { titulo: mod2, lecciones: [`E2E SecL2 ${stamp}`] },
          ],
        })
      );

      // El visitante ve el módulo 2 bloqueado
      await visitante.intenta(IrA.a("/cursos"));
      expect(await visitante.pregunta(CursoListado.titulado(curso))).toBe(true);
      await visitante.intenta(AbrirCursoPublico.titulado(curso));
      expect(await visitante.pregunta(EstadoDeModulo.titulado(mod2))).toBe("bloqueado");

      // El usuario completa la lección 1 y desbloquea el módulo 2
      await usuario.intenta(IrA.a("/cursos"), AbrirCursoPublico.titulado(curso));
      expect(await usuario.pregunta(EstadoDeModulo.titulado(mod2))).toBe("bloqueado");
      await usuario.intenta(MarcarPrimeraLeccionCompletada.ahora());
      expect(await usuario.pregunta(ProgresoEs.valor("1/"))).toBe(true);
      expect(await usuario.pregunta(EstadoDeModulo.titulado(mod2).trasCompletar())).toBe(
        "desbloqueado"
      );
    } finally {
      await userCtx.close();
      await visitCtx.close();
      await apiCtx.dispose();
    }
  });

  test("doble editor: el segundo guardado ve 409 sin crash", async ({ browser }) => {    const stamp = Date.now();
    const curso = `E2E Duelo ${stamp}`;
    const modulo = `E2E DueM ${stamp}`;
    const base1 = `E2E Base1 ${stamp}`;
    const base2 = `E2E Base2 ${stamp}`;
    const duelo = `E2E Duelo ${stamp}`;

    const ctxA = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    const ctxB = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    const apiCtx = await apiDeAdmin();
    try {
      // Dado por API: DOS lecciones distintas; el duelo va por UI
      await actorPreparador(apiCtx).intenta(
        PrepararCurso.con({ titulo: curso, modulos: [{ titulo: modulo, lecciones: [base1, base2] }] })
      );

      const editorA = actorAdmin(await ctxA.newPage());
      const editorB = actorAdmin(await ctxB.newPage());

      // A renombra la primera a "duelo" y guarda (éxito, el modal cierra)...
      await editorA.intenta(
        IrAGestionDeCursos.ahora(),
        AbrirCurso.titulado(curso),
        AbrirEditorDeLeccion.titulada(base1),
        RenombrarLeccionEnEditor.a(duelo),
        GuardarLeccionEnEditor.ahora()
      );

      // ...B renombra la segunda al mismo título y recibe 409 visible, sin crash
      await editorB.intenta(
        IrAGestionDeCursos.ahora(),
        AbrirCurso.titulado(curso),
        AbrirEditorDeLeccion.titulada(base2),
        RenombrarLeccionEnEditor.a(duelo),
        GuardarLeccionEnEditor.ahora()
      );
      expect(await editorB.pregunta(ErrorEnModal.valor())).toMatch(/Ya existe otra lección/);
    } finally {
      await ctxA.close();
      await ctxB.close();
      await apiCtx.dispose();
    }
  });

  test("sin secuencial: todo desbloqueado desde el inicio (visitante)", async ({ browser }) => {
    const stamp = Date.now();
    const curso = `E2E Libre ${stamp}`;
    const mod1 = `E2E LibreM1 ${stamp}`;
    const mod2 = `E2E LibreM2 ${stamp}`;

    const visitCtx = await browser.newContext();
    const apiCtx = await apiDeAdmin();
    try {
      const visitante = actorVisitante(await visitCtx.newPage());

      await actorPreparador(apiCtx).intenta(
        PrepararCurso.con({
          titulo: curso,
          publicado: true,
          secuencial: false,
          modulos: [
            { titulo: mod1, lecciones: [`E2E LibreL1 ${stamp}`] },
            { titulo: mod2, lecciones: [`E2E LibreL2 ${stamp}`] },
          ],
        })
      );

      await visitante.intenta(IrA.a("/cursos"));
      expect(await visitante.pregunta(CursoListado.titulado(curso))).toBe(true);
      await visitante.intenta(AbrirCursoPublico.titulado(curso));
      // Sin completar nada, ambos módulos abiertos
      expect(await visitante.pregunta(EstadoDeModulo.titulado(mod1))).toBe("desbloqueado");
      expect(await visitante.pregunta(EstadoDeModulo.titulado(mod2))).toBe("desbloqueado");
    } finally {
      await visitCtx.close();
      await apiCtx.dispose();
    }
  });
});
