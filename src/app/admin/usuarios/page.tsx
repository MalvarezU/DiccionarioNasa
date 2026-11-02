"use client"

import { useSession } from "next-auth/react"
import { ShieldAlert } from "lucide-react"
import { UserManagementSection } from "@/components/user-management-section"

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
      <h1 className="mb-6 text-2xl font-serif font-bold text-primary">
        Gestión de usuarios
      </h1>
      <UserManagementSection />
    </>
  )
}
