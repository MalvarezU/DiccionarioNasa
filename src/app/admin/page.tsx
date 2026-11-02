"use client"

import { useSession } from "next-auth/react"
import { Separator } from "@/components/ui/separator"
import { AdminDashboard } from "@/components/admin-dashboard"
import { UserManagementSection } from "@/components/user-management-section"

export default function AdminPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role
  const isAdmin = userRole === "admin"

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-bold text-primary">Resumen del panel</h1>
        <p className="text-sm text-muted-foreground">Estadísticas y estado del diccionario</p>
      </div>

      <AdminDashboard canBulkArchive={isAdmin} />

      {isAdmin && (
        <>
          <Separator className="my-8" />
          <UserManagementSection />
        </>
      )}
    </>
  )
}
