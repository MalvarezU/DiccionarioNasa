"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  ArrowLeft,
  AudioLines,
  BookOpen,
  GraduationCap,
  Images,
  LayoutDashboard,
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
import { AdminBreadcrumbs } from "./admin-breadcrumbs"

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
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-container">
              <Image
                src="/logoPiiyaakblanco.png"
                alt="Logo Piiyaak"
                width={24}
                height={24}
                className="size-6 rounded-md object-contain"
              />
            </div>
            <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
              <span className="font-serif text-[15px] font-semibold tracking-tight text-primary leading-none truncate">Piiyaak</span>
              <span className="text-2xs uppercase tracking-[0.1em] text-muted-foreground leading-none truncate">Panel admin</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {visibleGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="uppercase tracking-[0.08em] text-muted-foreground">{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title} className="px-2.5 gap-2.5 text-sm rounded-md [&>svg]:size-4.5 data-[active=true]:bg-primary-container data-[active=true]:text-primary-foreground data-[active=true]:font-medium data-[active=true]:hover:bg-primary-container data-[active=true]:hover:text-primary-foreground hover:bg-surface-container-highest/60">
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
        <SidebarFooter className="px-2 py-2">
          <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2 border-outline-variant/60 bg-transparent text-muted-foreground hover:border-outline-variant hover:bg-surface-container-highest hover:text-tertiary">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 transition-colors" />
              Volver al home
            </Link>
          </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-outline-variant/40 bg-surface-container-low/80 px-4 backdrop-blur-sm sm:px-6">
          <SidebarTrigger aria-label="Abrir o cerrar el menú lateral" />
          <Separator orientation="vertical" className="h-5 bg-outline-variant/60" />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <AdminBreadcrumbs />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {status === "loading" ? (
                <span className="flex items-center gap-2" aria-busy="true" aria-label="Cargando sesión">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="hidden sm:block h-4 w-20" />
                </span>
              ) : (
                <>
                  <span className="hidden sm:inline truncate max-w-[180px]">{userName}</span>
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {isAdmin ? "Admin" : "Editor"}
                  </span>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 sm:px-6 py-6 lg:py-8"><div className={`mx-auto w-full ${pathname === "/admin/cursos" ? "max-w-7xl" : "max-w-6xl"}`}>{children}</div></main>
        <footer className="bg-surface-container-high/60 px-4 sm:px-6 py-4">
          <p className="text-xs text-muted-foreground">Panel de administración — Piiyaak</p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}
