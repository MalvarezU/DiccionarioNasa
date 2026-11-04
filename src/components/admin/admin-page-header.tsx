import type { ReactNode } from "react"

interface AdminPageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

/**
 * Encabezado unificado de las secciones del panel:
 * título serif + descripción opcional + acciones a la derecha.
 */
export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-xl font-serif font-bold tracking-tight text-balance text-primary sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
