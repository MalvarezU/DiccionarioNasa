"use client"

import { IllustrationsManager } from "@/components/admin/illustrations-manager"
import { AdminPageHeader } from "@/components/admin/admin-page-header"

export default function AdminIllustrationsPage() {
  return (
    <>
      <AdminPageHeader title="Gestión de ilustraciones" />
      <IllustrationsManager />
    </>
  )
}
