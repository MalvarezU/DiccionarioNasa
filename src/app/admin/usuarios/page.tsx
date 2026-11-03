"use client"

import { useSession } from "next-auth/react"
import { ShieldAlert } from "lucide-react"
import { UserManagementSection } from "@/components/user-management-section"
import { AdminPageHeader } from "@/components/admin/admin-page-header"

export default function AdminUsuariosPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role
  const isAdmin = userRole === "admin"

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Sin permiso</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          La gestión de usuarios está reservada a administradores. Si necesitás
          acceso, pedile a un admin que te lo otorgue.
        </p>
      </div>
    )
  }

  return (
    <>
      <AdminPageHeader
        title="Gestión de usuarios"
        description="Roles y accesos"
      />
      <UserManagementSection />
    </>
  )
}
