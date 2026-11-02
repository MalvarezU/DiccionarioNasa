"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  AudioLines,
  BookOpen,
  GraduationCap,
  Images,
  LayoutDashboard,
  LogOut,
  Shield,
  Users,
} from "lucide-react"
import type { ComponentType } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

interface NavItem {
  title: string
  href: string
  icon: ComponentType<{ className?: string }>
  adminOnly?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Principal",
    items: [{ title: "Resumen", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Diccionario",
    items: [{ title: "Palabras", href: "/admin/palabras", icon: BookOpen }],
  },
  {
    label: "Cursos",
    items: [{ title: "Gestión de cursos", href: "/admin/cursos", icon: GraduationCap }],
  },
  {
    label: "Medios",
    items: [
      { title: "Ilustraciones", href: "/admin/ilustraciones", icon: Images },
      { title: "Audios", href: "/admin/audios", icon: AudioLines },
    ],
  },
  {
    label: "Sistema",
    items: [{ title: "Usuarios", href: "/admin/usuarios", icon: Users, adminOnly: true }],
  },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const isAdmin = role === "admin"
  const userName = session?.user?.name || session?.user?.email || "Usuario"

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href) ?? false

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.adminOnly || isAdmin),
  })).filter((g) => g.items.length > 0)

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-3 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Panel admin</span>
              <span className="text-xs text-muted-foreground">Piiyaak</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {visibleGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link href={item.href} aria-current={active ? "page" : undefined}>
                          <Icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="px-3 py-3">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
            <Link href="/">
              <LogOut className="h-4 w-4" />
              Salir al diccionario
            </Link>
          </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-muted-foreground">
              Panel de administración
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {status === "loading" ? (
                <span className="flex items-center gap-2" aria-busy="true" aria-label="Cargando sesión">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="hidden sm:block h-4 w-20" />
                </span>
              ) : (
                <>
                  <span className="hidden sm:inline truncate max-w-[180px]">{userName}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {isAdmin ? "Admin" : "Editor"}
                  </span>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 sm:px-6 py-6">{children}</main>
        <footer className="border-t bg-muted/20 px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground">Panel de administración — Piiyaak</p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}
