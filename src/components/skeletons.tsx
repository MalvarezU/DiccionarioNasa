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
 * Réplica de `CourseCard`: miniatura 48px, título serif, línea de módulos,
 * descripción de dos renglones, barra de avance y acción.
 */
function CourseCardSkeleton() {
  return (
    <div
      data-slot="skeleton-course-card"
      data-testid="skeleton-course-card"
      className="rounded-xl border border-outline-variant/20 bg-card"
    >
      <div className="flex flex-col gap-3 p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="mb-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="mb-4 space-y-2">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center justify-end">
          <Skeleton className="h-4 w-20" />
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

/** Módulo del acordeón: encabezado y filas de lecciones. */
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

/** Pantalla completa del reproductor de curso. */
function CoursePlayerSkeleton({ modules = 3 }: { modules?: number }) {
  return (
    <div data-slot="skeleton-course-player" className="space-y-6">
      <SectionHeadingSkeleton />
      <Skeleton className="h-32 w-full rounded-xl" />
      {Array.from({ length: modules }, (_, i) => (
        <ModuleSkeleton key={i} lessons={i === 0 ? 3 : 2} />
      ))}
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
  FavoriteCardSkeleton,
  FavoritesGridSkeleton,
  HistorySkeleton,
  UsersTableSkeleton,
  ButtonSkeleton,
  CourseCardSkeleton,
  CourseGridSkeleton,
  CourseListSkeleton,
  CoursePlayerSkeleton,
  ExploreListSkeleton,
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
  WordTableSkeleton,
  WordTableRowSkeleton,
}