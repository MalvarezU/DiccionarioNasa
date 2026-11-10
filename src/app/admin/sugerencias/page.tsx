"use client"

import { SuggestionsManager } from "@/components/admin/suggestions-manager"
import { AdminPageHeader } from "@/components/admin/admin-page-header"

export default function AdminSuggestionsPage() {
  return (
    <>
      <AdminPageHeader
        title="Sugerencias de la comunidad"
        description="Palabras que la comunidad sugirió desde el buscador. Creá la ficha o verificá si ya existe."
      />
      <SuggestionsManager />
    </>
  )
}
