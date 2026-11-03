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
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-serif font-bold text-primary">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
