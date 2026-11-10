import { test, expect } from "@playwright/test";
import { actorUsuario } from "./screenplay/actores";
import { IrA } from "./screenplay/tasks/acciones";
import { PrimerCursoId } from "./screenplay/questions/cursos-publico";

/**
 * Flujo de finalización de curso: completar todas las lecciones (por API,
 * para no depender del acordeón del outline) y verificar que la página
 * muestra la pantalla de celebración con sugerencias.
 */
test.describe("celebración de curso (Screenplay)", () => {
  test.describe.configure({ timeout: 180000 });

  test("completar todas las lecciones muestra la celebración", async ({ page, request }) => {
    const usuario = actorUsuario(page, request);
    const courseId = await usuario.pregunta(PrimerCursoId.valor());
    const manifestRes = await request.get(`/api/courses/${courseId}/manifest`);
    const manifest = await manifestRes.json();
    const allLessonIds = manifest.modules.flatMap((m: { lessons: { id: string }[] }) =>
      m.lessons.map((l: { id: string }) => l.id)
    );
    for (const lid of allLessonIds) {
      await request.post("/api/progress", {
        data: { lessonId: lid, completed: true },
      });
    }
    const lastId = allLessonIds[allLessonIds.length - 1];
    await usuario.intenta(IrA.a(`/cursos/${courseId}?leccion=${lastId}`));
    await page.waitForTimeout(2000);
    const welcomeBtn = page.getByRole("button", { name: /Por ahora no/i });
    if (await welcomeBtn.isVisible().catch(() => false)) await welcomeBtn.click();
    await expect(page.getByRole("heading", { name: /¡Curso completado!/ })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(/Completaste \d+ de \d+ lecciones/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Repasar el curso/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ver más cursos/i })).toBeVisible();
  });

  test("sugiere otros cursos publicados", async ({ page, request }) => {
    // Crear un segundo curso publicado vía admin para tener sugerencias
    const { request: playwrightRequest } = await import("@playwright/test");
    const adminCtx = await playwrightRequest.newContext({
      storageState: "e2e/.auth/admin.json",
      baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    });
    const rc = await adminCtx.post("/api/courses", { data: { title: "E2E Sugerido", status: "PUBLISHED", sequential: true } });
    const { course } = await rc.json();
    const rm = await adminCtx.post("/api/modules", { data: { courseId: course.id, title: "M1" } });
    const { module } = await rm.json();
    await adminCtx.post(`/api/modules/${module.id}/lessons`, { data: { title: "L1" } });

    const usuario = actorUsuario(page, request);
    const courseId = await usuario.pregunta(PrimerCursoId.valor());
    const manifestRes = await request.get(`/api/courses/${courseId}/manifest`);
    const manifest = await manifestRes.json();
    const allLessonIds = manifest.modules.flatMap((m: { lessons: { id: string }[] }) =>
      m.lessons.map((l: { id: string }) => l.id)
    );
    for (const lid of allLessonIds) {
      await request.post("/api/progress", { data: { lessonId: lid, completed: true } });
    }
    const lastId = allLessonIds[allLessonIds.length - 1];
    await usuario.intenta(IrA.a(`/cursos/${courseId}?leccion=${lastId}`));
    await page.waitForTimeout(2000);
    const welcomeBtn = page.getByRole("button", { name: /Por ahora no/i });
    if (await welcomeBtn.isVisible().catch(() => false)) await welcomeBtn.click();
    await expect(page.getByText(/Sigue aprendiendo/)).toBeVisible({ timeout: 30000 });
    // La sección solo renderiza si hay sugerencias; verificar que hay al menos
    // un link al catálogo de cursos (la card del sugerido).
    const link = page.locator("a[href^='/cursos/']");
    expect(await link.count()).toBeGreaterThan(0);
    await adminCtx.dispose();
  });

  test("repasar vuelve a la primera lección", async ({ page, request }) => {
    const usuario = actorUsuario(page, request);
    const courseId = await usuario.pregunta(PrimerCursoId.valor());
    const manifestRes = await request.get(`/api/courses/${courseId}/manifest`);
    const manifest = await manifestRes.json();
    const allLessonIds = manifest.modules.flatMap((m: { lessons: { id: string }[] }) =>
      m.lessons.map((l: { id: string }) => l.id)
    );
    for (const lid of allLessonIds) {
      await request.post("/api/progress", { data: { lessonId: lid, completed: true } });
    }
    const lastId = allLessonIds[allLessonIds.length - 1];
    await usuario.intenta(IrA.a(`/cursos/${courseId}?leccion=${lastId}`));
    await page.waitForTimeout(2000);
    const welcomeBtn = page.getByRole("button", { name: /Por ahora no/i });
    if (await welcomeBtn.isVisible().catch(() => false)) await welcomeBtn.click();
    await expect(page.getByRole("heading", { name: /¡Curso completado!/ })).toBeVisible({
      timeout: 30000,
    });
    await page.getByRole("button", { name: /Repasar el curso/i }).click();
    await expect(page).toHaveURL(/leccion=/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /¡Curso completado!/ })).toBeHidden({
      timeout: 15000,
    });
  });
});
