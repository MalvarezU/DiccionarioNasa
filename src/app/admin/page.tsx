"use client"

import { ArrowLeft, GraduationCap } from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { NavBar } from "@/components/navbar"
import { AdminDashboard } from "@/components/admin-dashboard"
import { UserManagementSection } from "@/components/user-management-section"

export default function AdminPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role
  const isAdmin = userRole === "admin"

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
          {/* Header with back link */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Volver al diccionario
              </Button>
            </Link>
            <Link href="/admin/courses" className="ml-auto">
              <Button variant="outline" size="sm" className="gap-2">
                <GraduationCap className="h-4 w-4" />
                Gestionar cursos
              </Button>
            </Link>
          </div>

          {/* Admin Dashboard (editor: sin archivado en lote) */}
          <AdminDashboard canBulkArchive={isAdmin} />

          {/* User Management (solo admin; la API también lo exige) */}
          {isAdmin && (
            <>
              <Separator className="my-8" />
              <UserManagementSection />
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Panel de administración — Piiyaak
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
