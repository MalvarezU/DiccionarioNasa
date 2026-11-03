"use client"

import { useSession } from "next-auth/react"
import { AdminDashboard } from "@/components/admin-dashboard"
import { AdminPageHeader } from "@/components/admin/admin-page-header"

export default function AdminPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role
  const isAdmin = userRole === "admin"

  return (
    <>
      <AdminPageHeader
        title="Resumen del panel"
        description="Estadísticas y estado del diccionario"
      />
      <AdminDashboard isAdmin={isAdmin} />
    </>
  )
}
