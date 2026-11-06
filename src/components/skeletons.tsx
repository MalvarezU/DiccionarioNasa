import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Skeletons compuestos: replican la silueta del contenido real para que la
 * carga no provoque salto de layout.
 *
 * Regla del módulo: cada skeleton copia la estructura del componente que
 * sustituye, no una aproximación bonita. Si el layout real cambia, este
 * archivo tiene que cambiar con él; un skeleton que ya no coincide vuelve a
 * ser decorativo.
 *
 * Los `Loader2` de los botones NO se tocan: un spinner dentro de un botón que
 * está deshabilitado comunica "está submitsando" con precisión, y el botón ya
 * conserva su ancho. El skeleton es para áreas de contenido, donde un spinner
 * central hace colapsar el layout al llegar el dato.
 */

/** Encabezado de sección: título + subtítulo, como en el panel y cursos. */
function SectionHeadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)} data-slot="skeleton-heading">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-72" />
    </div>
  )
}

/** Pista de acción a la derecha de un encabezado ("Actualizar"). */
function ButtonSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-8 w-28 rounded-md", className)} />
}

/* ---------------------------------------------------------------- cursos -- */

/**
 * Réplica de `CourseCard` horizontal: portada a la izquierda (16/9 arriba en
 * móvil) + aside con título, descripción, meta, avance y acción.
 */
function CourseCardSkeleton() {
  return (
    <div
      data-slot="skeleton-course-card"
      data-testid="skeleton-course-card"
      className="overflow-hidden rounded-xl border border-outline-variant/20 bg-card"
    >
      <div className="grid sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        <Skeleton className="aspect-[16/9] rounded-none sm:aspect-auto sm:h-full sm:min-h-[11rem]" />
        <div className="flex flex-col gap-2 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-3 w-28" />
          <div className="flex-1" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex items-center justify-end">
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Rejilla del catálogo: como el número real de columnas del grid. */
function CourseGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      data-slot="skeleton-course-grid"
      data-testid="skeleton-course-grid"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }, (_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Encabezado + rejilla: la pantalla completa de /cursos. */
function CourseListSkeleton() {
  return (
    <div data-slot="skeleton-course-list" className="space-y-6">
      <SectionHeadingSkeleton />
      <CourseGridSkeleton />
    </div>
  )
}

/* ------------------------------------------ listado editorial (F2 bandas) -- */

/**
 * Réplica de las bandas del listado editorial: hero (título serif clamp +
 * summary + CTA), tira de continuación, featured (portada 2/3 + aside) y 3
 * placeholders de card en el mismo grid del catálogo. Alturas fijas a propósito: el swap al dato real no mueve
 * layout (CLS ≈ 0, ver §F del plan de rediseño).
 */
function CourseListBandsSkeleton() {
  return (
    <div
      data-slot="skeleton-course-list-bands"
      data-testid="skeleton-course-list-bands"
      className="space-y-8"
      aria-hidden="true"
    >
      {/* Hero: 2 cols en xl */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[3.5rem] w-56" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-2/3 max-w-xl" />
          <Skeleton className="h-10 w-48 rounded-md" />
        </div>
      </div>
      {/* Resume band */}
      <div className="rounded-xl border border-outline-variant/30 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-1.5 w-56 max-w-full rounded-full" />
          </div>
          <Skeleton className="h-10 w-32 shrink-0 rounded-md" />
        </div>
      </div>
      {/* Featured: portada 2/3 + aside */}
      <div className="grid gap-0 overflow-hidden rounded-xl border border-outline-variant/30 md:grid-cols-3">
        <Skeleton className="min-h-52 rounded-none md:col-span-2 md:min-h-64" />
        <div className="space-y-3 p-5 sm:p-6">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      {/* Catálogo: 3 placeholders de card con el mismo grid que el listado
        real (1 col en móvil, 2 desde md), para que el swap no mueva layout. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {Array.from({ length: 3 }, (_, i) => (
          <CourseCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- diccionario */

/**
 * Réplica de la fila de resultado: la palabra en español y su equivalente en
 * Nasa Yuwe son las dos señales que el usuario escanea.
 */
function WordResultSkeleton() {
  return (
    <div
      data-slot="skeleton-word-result"
      className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/20 p-3"
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-4 shrink-0 rounded-md" />
    </div>
  )
}

/** Lista de resultados de búsqueda. */
function SearchResultsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div data-slot="skeleton-search-results" className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <WordResultSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Réplica de la ficha de palabra: título grande, pronunciación, botones de
 * audio y una grilla de atributos.
 */
function WordDetailSkeleton() {
  return (
    <div
      data-slot="skeleton-word-detail"
      data-testid="skeleton-word-detail"
      className="space-y-6 rounded-xl border border-outline-variant/20 p-6"
    >
      {/* La ficha real abre con la ilustración cuadrada; el skeleton copia esa silueta. */}
      <Skeleton className="mx-auto aspect-square w-full max-w-[16rem] rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

/** Listado alfabético: filas compactas con cantidad a la derecha. */
function ExploreListSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div data-slot="skeleton-explore-list" className="space-y-1">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  )
}

/** Favoritas e historial: tarjetas de contenido guardado. */
function SavedItemsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div data-slot="skeleton-saved-items" className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <WordResultSkeleton key={i} />
      ))}
    </div>
  )
}

/** Réplica de la tarjeta de favorita: título serif, badge y botón de audio. */
function FavoriteCardSkeleton() {
  return (
    <div
      data-slot="skeleton-favorite-card"
      className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-14 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded-md" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

/** Rejilla de favoritas: dos columnas, como en el panel. */
function FavoritesGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      data-slot="skeleton-favorites-grid"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {Array.from({ length: count }, (_, i) => (
        <FavoriteCardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Réplica de la tarjeta de Destacadas: título serif en Nasa Yuwe, badge de
 * categoría, palabra en español, pronunciación y contexto cultural.
 */
function FeaturedWordCardSkeleton() {
  return (
    <div
      data-slot="skeleton-featured-word-card"
      className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  )
}

/** Rejilla de Destacadas: mismas columnas y gaps que la grilla real. */
function FeaturedWordsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      data-slot="skeleton-featured-words-grid"
      data-testid="skeleton-featured-words-grid"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
    >
      {Array.from({ length: count }, (_, i) => (
        <FeaturedWordCardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * Réplica de `WordCard` (variante grid): badge de categoría + botón de
 * audio de 40px en la fila superior, título serif de 28px en Nasa Yuwe,
 * palabra en español y línea de pronunciación.
 */
function WordCardSkeleton() {
  return (
    <div
      data-slot="skeleton-word-card"
      data-testid="skeleton-word-card"
      className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

/** Lista de historial: grupos de fecha con filas. */
function HistorySkeleton({ count = 5 }: { count?: number }) {
  return (
    <div data-slot="skeleton-history" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <div className="space-y-2">
          {Array.from({ length: Math.min(count, 3) }, (_, i) => (
            <WordResultSkeleton key={i} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <div className="space-y-2">
          {Array.from({ length: Math.max(count - 3, 2) }, (_, i) => (
            <WordResultSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Tabla de usuarios del panel: encabezado fijo más filas. */
function UsersTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div data-slot="skeleton-users-table">
      <WordTableSkeleton rows={rows} />
    </div>
  )
}

/* ------------------------------------------------------------------ juegos */

/** Réplica de la tarjeta de juego: ícono, título y descripción. */
function GameCardSkeleton() {
  return (
    <div
      data-slot="skeleton-game-card"
      className="rounded-xl border border-outline-variant/20 p-5"
    >
      <div className="space-y-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
    </div>
  )
}

/** Portada de /juegos con sus tres juegos. */
function GamesHomeSkeleton() {
  return (
    <div data-slot="skeleton-games-home" className="space-y-6">
      <SectionHeadingSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GameCardSkeleton />
        <GameCardSkeleton />
        <GameCardSkeleton />
      </div>
    </div>
  )
}

/** Tablero de juego: encabezado, barra de progreso y rejilla de opciones. */
function GameBoardSkeleton() {
  return (
    <div data-slot="skeleton-game-board" className="space-y-6">
      <SectionHeadingSkeleton />
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ jugador curso */

/** Módulo del acordeón del admin: encabezado y filas de lecciones. */
function ModuleSkeleton({ lessons = 3 }: { lessons?: number }) {
  return (
    <div
      data-slot="skeleton-module"
      className="rounded-lg border border-outline-variant/20 p-4"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: lessons }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-outline-variant/15 p-3"
          >
            <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Réplica del player master-detail: sidebar dark de alto viewport + canvas
 * con min-h fijo. Mismo grid que el shell real
 * (`lg:288px / xl:320px + gap-10`): el swap al dato real no mueve layout
 * (CLS ≈ 0, ver §F del plan de rediseño).
 */
function CoursePlayerSkeleton() {
  return (
    <div
      data-slot="skeleton-course-player"
      data-testid="skeleton-course-player"
      className="mx-auto w-full max-w-[1400px] px-6 py-8 lg:px-10"
    >
      {/* Header: espejo del header real del curso (breadcrumbs + back-link +
          tile + h1 + meta + descripción, mismo spacing mb-8/space-y-3/mb-4):
          el header también entra con fade, sin pop. */}
      <div aria-hidden="true" className="mb-8 space-y-3">
        <div className="mb-4 flex items-center gap-1.5">
          <Skeleton className="h-4 w-12 border-transparent" />
          <Skeleton className="h-4 w-4 border-transparent" />
          <Skeleton className="h-4 w-14 border-transparent" />
          <Skeleton className="h-4 w-4 border-transparent" />
          <Skeleton className="h-4 w-32 border-transparent" />
        </div>
        <Skeleton className="h-4 w-28 border-transparent" />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-12 w-12 rounded-xl border-transparent" />
            <div className="space-y-1.5">
              <Skeleton className="h-8 w-56 border-transparent sm:w-72" />
              <Skeleton className="h-3 w-40 border-transparent" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full max-w-2xl border-transparent" />
            <Skeleton className="h-4 w-2/3 max-w-xl border-transparent" />
          </div>
        </div>
      </div>
      <div className="grid w-full gap-10 lg:grid-cols-[288px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
      {/* Sidebar: bloque dark de alto viewport como el outline real */}
      <div
        aria-hidden="true"
        className="hidden h-[calc(100dvh-3.5rem)] w-full space-y-3 rounded-xl bg-primary/90 p-5 lg:block"
      >
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="h-6 w-40 rounded bg-white/10" />
          <div className="h-1 w-full rounded-full bg-white/10" />
        </div>
        <div className="space-y-2 rounded-xl border border-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="h-5 w-32 rounded bg-white/10" />
            <div className="h-4 w-10 rounded-full bg-white/10" />
          </div>
          <div className="h-1 w-full rounded-full bg-white/10" />
          <div className="space-y-1.5 pt-1">
            <div className="h-9 w-full rounded-lg bg-white/10" />
            <div className="h-9 w-full rounded-lg bg-white/10" />
            <div className="h-9 w-4/5 rounded-lg bg-white/10" />
          </div>
        </div>
        <div className="space-y-2 rounded-xl border border-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="h-5 w-28 rounded bg-white/10" />
            <div className="h-4 w-10 rounded-full bg-white/10" />
          </div>
          <div className="h-1 w-full rounded-full bg-white/10" />
          <div className="space-y-1.5 pt-1">
            <div className="h-9 w-full rounded-lg bg-white/10" />
            <div className="h-9 w-3/5 rounded-lg bg-white/10" />
          </div>
        </div>
      </div>
      {/* Canvas: espejo del árbol real de LessonCanvas (label de módulo +
          título h2 a 2 líneas con número + badges + bloques en flex gap-5 +
          footer nav, mismo spacing mt-1/mt-2/mt-6/mt-8): el swap al dato
          real no mueve la altura (CLS ≈ 0, §F-D1). */}
      <div aria-hidden="true" className="min-h-[max(420px,60dvh)] min-w-0">
        <Skeleton className="h-4 w-40 border-transparent" />
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Skeleton className="h-6 w-14 border-transparent" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-8 w-3/4 border-transparent" />
            <Skeleton className="h-8 w-1/2 border-transparent" />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-24 rounded-full border-transparent" />
          <Skeleton className="h-5 w-36 rounded-full border-transparent" />
        </div>
        <div className="mt-6 flex flex-col gap-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full border-transparent" />
            <Skeleton className="h-4 w-full border-transparent" />
            <Skeleton className="h-4 w-11/12 border-transparent" />
            <Skeleton className="h-4 w-2/3 border-transparent" />
          </div>
          <Skeleton className="h-48 w-full rounded-xl border-transparent" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full border-transparent" />
            <Skeleton className="h-4 w-2/3 border-transparent" />
          </div>
        </div>
        <div className="mt-8 flex items-stretch gap-3">
          <Skeleton className="h-11 flex-1 border-transparent" />
          <Skeleton className="h-11 flex-1 border-transparent" />
        </div>
      </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------- admin cursos -- */

/**
 * Réplica de una fila de la lista del gestor (botón con título + badge +
 * conteo). Copia el padding y el borde del botón real para no mover layout.
 */
function CourseManagerRowSkeleton() {
  return (
    <div
      data-slot="skeleton-course-manager-row"
      className="w-full rounded-lg border border-outline-variant/20 p-3"
    >
      <Skeleton className="h-4 w-3/4 border-transparent" />
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full border-transparent" />
        <Skeleton className="h-3 w-28 border-transparent" />
      </div>
    </div>
  )
}

/** Lista de cursos del panel: formulario + filas. */
function CourseManagerListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div data-slot="skeleton-course-manager-list" className="space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 border-transparent" />
        <Skeleton className="h-9 w-9 shrink-0 rounded-md border-transparent" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: count }, (_, i) => (
          <CourseManagerRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

/** Detalle del curso: campos, portada, acciones y módulos. */
function CourseManagerDetailSkeleton() {
  return (
    <div data-slot="skeleton-course-manager-detail" className="space-y-4">
      <div className="grid gap-3">
        <div className="grid gap-2">
          <Skeleton className="h-3 w-16 border-transparent" />
          <Skeleton className="h-9 w-full border-transparent" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-3 w-24 border-transparent" />
          <Skeleton className="h-9 w-full border-transparent" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-3 w-16 border-transparent" />
          <Skeleton className="h-9 w-[200px] border-transparent" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-3 w-16 border-transparent" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-24 rounded-md border-transparent" />
            <Skeleton className="h-8 w-28 rounded-md border-transparent" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-md border-transparent" />
          <Skeleton className="h-8 w-36 rounded-md border-transparent" />
        </div>
      </div>
      <div className="bg-border h-px w-full" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-20 border-transparent" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 border-transparent" />
          <Skeleton className="h-9 w-20 rounded-md border-transparent" />
        </div>
        <ModuleSkeleton lessons={2} />
        <ModuleSkeleton lessons={2} />
      </div>
    </div>
  )
}

/**
 * Gestor completo (/admin/cursos): replica el grid lista + detalle del
 * CourseManager real para que el route loading no salte al llegar el dato.
 */
function CourseManagerSkeleton() {
  return (
    <div
      data-slot="skeleton-course-manager"
      data-testid="skeleton-course-manager"
      className="grid grid-cols-1 gap-6 lg:grid-cols-3"
    >
      <div className="bg-card flex h-fit flex-col gap-6 rounded-xl border py-6 shadow-sm lg:col-span-1">
        <div className="px-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded border-transparent" />
            <Skeleton className="h-5 w-28 border-transparent" />
          </div>
        </div>
        <div className="px-6">
          <CourseManagerListSkeleton />
        </div>
      </div>
      <div className="bg-card flex h-fit flex-col gap-6 rounded-xl border py-6 shadow-sm lg:col-span-2">
        <div className="px-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded border-transparent" />
            <Skeleton className="h-5 w-40 border-transparent" />
          </div>
        </div>
        <div className="px-6">
          <CourseManagerDetailSkeleton />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ admin */

/** Réplica de la tarjeta de estadística del panel: número grande + etiqueta. */
function StatCardSkeleton() {
  return (
    <div
      data-slot="skeleton-stat-card"
      className="rounded-xl border border-outline-variant/20 p-5"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  )
}

/** Las cuatro tarjetas de métricas del panel. */
function StatsGridSkeleton() {
  return (
    <div
      data-slot="skeleton-stats-grid"
      data-testid="skeleton-stats-grid"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  )
}

/** Fila de la tabla de fichas del panel. */
function WordTableRowSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <div
      data-slot="skeleton-table-row"
      className="flex items-center gap-3 border-b border-outline-variant/15 px-4 py-3"
    >
      {Array.from({ length: columns }, (_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  )
}

/** Tabla de fichas: encabezado + filas. */
function WordTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      data-slot="skeleton-word-table"
      className="overflow-hidden rounded-xl border border-outline-variant/20"
    >
      <div className="flex items-center gap-3 border-b border-outline-variant/20 bg-muted/40 px-4 py-3">
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 flex-1" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <WordTableRowSkeleton key={i} />
      ))}
    </div>
  )
}

/** Panel de administración completo: encabezado, métricas y tabla. */
function AdminDashboardSkeleton() {
  return (
    <div
      data-slot="skeleton-admin-dashboard"
      data-testid="skeleton-admin-dashboard"
      className="space-y-6"
    >
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-72" />
        <ButtonSkeleton />
      </div>
      <StatsGridSkeleton />
      <WordTableSkeleton rows={6} />
    </div>
  )
}

/* ------------------------------------------------------------------- home */

/** Portada de plataforma: héroe y rejilla de secciones. */
function HomeSkeleton() {
  return (
    <div data-slot="skeleton-home" className="space-y-12">
      <div className="space-y-4 py-12 text-center">
        <Skeleton className="mx-auto h-12 w-3/4 max-w-xl" />
        <Skeleton className="mx-auto h-4 w-1/2 max-w-md" />
        <div className="flex justify-center gap-3 pt-2">
          <Skeleton className="h-11 w-32 rounded-md" />
          <Skeleton className="h-11 w-32 rounded-md" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GameCardSkeleton />
        <GameCardSkeleton />
        <GameCardSkeleton />
      </div>
    </div>
  )
}

export {
  AdminDashboardSkeleton,
  CourseManagerSkeleton,
  CourseManagerListSkeleton,
  CourseManagerDetailSkeleton,
  FavoriteCardSkeleton,
  FavoritesGridSkeleton,
  HistorySkeleton,
  UsersTableSkeleton,
  ButtonSkeleton,
  CourseCardSkeleton,
  CourseGridSkeleton,
  CourseListBandsSkeleton,
  CourseListSkeleton,
  CoursePlayerSkeleton,
  ExploreListSkeleton,
  FeaturedWordCardSkeleton,
  FeaturedWordsGridSkeleton,
  GameBoardSkeleton,
  GameCardSkeleton,
  GamesHomeSkeleton,
  HomeSkeleton,
  ModuleSkeleton,
  SavedItemsSkeleton,
  SearchResultsSkeleton,
  SectionHeadingSkeleton,
  StatCardSkeleton,
  StatsGridSkeleton,
  WordDetailSkeleton,
  WordResultSkeleton,
  WordCardSkeleton,
  WordTableSkeleton,
  WordTableRowSkeleton,
}