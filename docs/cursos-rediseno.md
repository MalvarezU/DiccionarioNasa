# Rediseño Cursos — web Piiyaak (`feature/mejora-seccion-cursos`)

Listado editorial + player master-detail. `LessonContentView` y `blocks.ts` intactos: el rediseño reenvasa, no reescribe.

## 1. Dirección visual (C1–C5)

| Token | Decisión |
|---|---|
| C1 Dark anchor | Outline del player en `bg-primary` (#2f3e4e), texto marfil. Único gesto audaz por pantalla. |
| C2 Numeración serif | `2.3` jerárquica como señalización (outline, canvas, listado). |
| C3 Vellum bands | Listado en marfil: hero + banda resume (low) + featured (high). |
| C4 Relleno, no sombra | Jerarquía por `surface-container-low/high/highest` + hairline `outline-variant`. Cero sombras nuevas, cero gradientes. |
| C5 `tabular-nums` | `3/5`, `72%`, numeración de índice. |

Motion CSS-only en `globals.css` (0 kb JS): reveal 200 ms + stagger `nth-child` máx 5 + check pop transform-only. `prefers-reduced-motion` = crossfade 120 ms o nada.

## 2. Patrón master-detail + `?leccion=`

`/cursos/[id]?leccion={lessonId}`. Sin subruta por lección: el outline remonta sin recarga, `history.replaceState` no ensucia el historial, y el deep-link a lección bloqueada muestra banner con CTA en vez de 404. Precedente interno: `/diccionario?panel=`. Id por **lessonId** (estable ante reorden; `lessonNumber` es 1..N por módulo y cambia).

Resolución inicial: `?leccion=` explícito ‖ `lastVisitedLessonId` (GET progress / localStorage anónimo) ‖ primera desbloqueada. Id inválido → cae en silencio a lastVisited ‖ primera, sin error visible.

## 3. APIs nuevas (detalle y progress intactos)

- `GET /api/courses/[id]/manifest` → `{ courseId, title, description, sequential, modules: [{ id, title, order, lessons: [{ id, lessonNumber, title, interactiveCount }] }] }`. Sin `content` (payload ligero para el outline). `interactiveCount` lo computa el servidor con `isInteractive`; documento corrupto = 0, nunca rompe.
- `GET /api/courses/[id]/lessons/[lessonId]` → `{ lesson: { id, title, lessonNumber, content, moduleId }, words: [...], nav: { prevId, nextId, …, moduleTitle, moduleIndex } }`. Words resueltas **directo de Prisma** (evita el cap de 60 ids del endpoint público).
- Auth: PUBLISHED público; DRAFT/ARCHIVED solo editor+. Locks **en cliente** (manifest + progress), jamás gatean el GET.

## 4. Estados × breakpoint (resumen)

Listado: loading (band-skeleton) · vacío 0 publicados · error con reintentar · anónimo (aviso "vive en este navegador") · sesión (resume + hero CTA) · editor+ (apartado gestión DRAFT/ARCHIVED). Player: loading · error (reintenta manifest y lección por separado) · empty (0 lecciones) · bloqueado-por-deep-link (banner + "Ir a la lección requerida").

| Situación | ≥1280 | 1024–1279 | <1024 |
|---|---|---|---|
| Outline | sticky 320px | sticky 288px | Sheet left 320px + botón "Índice" |
| Canvas | prosa 68ch + full-bleed media | ídem | full-bleed, footer Prev/Next sticky |

A11y: un solo tab stop (roving tabindex, arrows/Home/End), `aria-disabled` en bloqueadas (nunca `disabled`: no recibe foco ni tooltip), `aria-current`, foco al h2 del canvas al cambiar de lección.

## 5. Contratos CSS estables (no romper sin actualizar el otro lado)

- `[data-testid="lesson-content"] > *`: cada bloque es hijo directo (o `null`). El stagger y el full-bleed dependen de esto.
- `[data-testid="lesson-content"] > figure` y `> .aspect-video` → ancho de pane (scope `.lesson-canvas`); `> div > audio` queda a 68ch.
- Outline: `data-lesson-state` (done/current/locked/todo), `data-lesson-button` (cierra el Sheet).

## 6. Decisiones

1. **Featured = más reciente publicado** (último por `createdAt` asc), no el curso en marcha: la resume band ya lo muestra; evita duplicar y da novedad editorial.
2. **Reduce = nada visible**: con `prefers-reduced-motion` el cambio de lección es instantáneo (scroll sin animación siempre).
3. **Locks en cliente**: el servidor nunca bloquea; el secuencial se computa de manifest + progress. Deep-link bloqueado = banner, no 403.
4. **Anónimo sin migración**: progreso en `piiyaak:course:anon:v1:{courseId}` (misma clave v1). Al iniciar sesión se parte de cero remoto; no se pierde lo local, no se fusiona.

## 7. Deudas (fuera de scope, a propósito)

- **SEO**: player montado en cliente; si /cursos debe rankear, hero SSR-able pendiente.
- **Stats gobierno** (alumnos, promedio, editor+): se sirven del GET detalle actual, sin render dedicado.
- **Migración anónimo→login**: sin fusión de progreso; el layout nuevo no lo empeora.
- Outline virtualizado (`@tanstack/react-virtual` ya en deps) solo si >40 lecciones reales.
