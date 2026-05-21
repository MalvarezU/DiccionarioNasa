"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { NavBar } from "@/components/navbar"
import { AdminDashboard } from "@/components/admin-dashboard"
import { UserManagementSection } from "@/components/user-management-section"

export default function AdminPage() {
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
          </div>

          {/* Admin Dashboard */}
          <AdminDashboard />

          <Separator className="my-8" />

          {/* User Management */}
          <UserManagementSection />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Panel de administración — Nasa Yuwe
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
