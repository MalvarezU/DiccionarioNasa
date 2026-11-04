import Link from "next/link"

export interface Crumb {
  label: string
  href?: string
}

/**
 * Migas de pan de las páginas públicas (Inicio / Cursos / …).
 * Enlace en oliva, página actual en pizarra.
 * `className` permite ajustar el nav al contenedor (el admin lo usa
 * sin margen y con scroll horizontal seguro en pantallas angostas).
 */
export function Breadcrumbs({ items, className = "mb-4" }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden="true" className="text-muted-foreground">
                  /
                </span>
              )}
              {isLast || !item.href ? (
                <span aria-current={isLast ? "page" : undefined} className="font-medium text-primary">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-secondary underline-offset-4 hover:underline"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
