"use client"

import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs"

const SECTION_LABELS: Record<string, string> = {
  palabras: "Palabras",
  cursos: "Gestión de cursos",
  audios: "Audios",
  ilustraciones: "Ilustraciones",
  usuarios: "Usuarios",
}

/**
 * Miga de pan del panel: Inicio / Admin / Sección [/ Detalle].
 * Se deriva del pathname; los ids dinámicos nunca se muestran crudos:
 * una lección en edición aparece como "Lección" y cualquier otro
 * detalle como "Detalle".
 */
function buildCrumbs(pathname: string): Crumb[] {
  const inicio: Crumb = { label: "Inicio", href: "/" }
  if (!pathname.startsWith("/admin")) return [inicio]

  const admin: Crumb = { label: "Admin", href: "/admin" }
  const segs = pathname.split("/").filter(Boolean).slice(1)
  if (segs.length === 0) return [inicio, { label: "Admin" }]

  const [section, ...rest] = segs
  const sectionLabel = SECTION_LABELS[section] ?? "Sección"

  // /admin/cursos/:id/lecciones/:lessonId → tramo de lección
  if (section === "cursos" && rest.includes("lecciones")) {
    return [inicio, admin, { label: "Gestión de cursos", href: "/admin/cursos" }, { label: "Lección" }]
  }

  if (rest.length > 0) {
    return [inicio, admin, { label: sectionLabel, href: `/admin/${section}` }, { label: "Detalle" }]
  }
  return [inicio, admin, { label: sectionLabel }]
}

export function AdminBreadcrumbs() {
  const pathname = usePathname() ?? "/admin"
  const items = useMemo(() => buildCrumbs(pathname), [pathname])

  return (
    <Breadcrumbs
      items={items}
      className="min-w-0 flex-1 [&_ol]:flex-nowrap [&_ol]:overflow-x-auto [&_li]:shrink-0"
    />
  )
}
