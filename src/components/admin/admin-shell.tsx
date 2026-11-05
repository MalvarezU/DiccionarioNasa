"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  AudioLines,
  BookOpen,
  ChevronRight,
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

interface Miga {
  etiqueta: string
  href?: string
}

/** Id de ruta recortado para la miga (el título real lo tiene la página; no se hace fetch). */
function segmentoCorto(segmento: string): string {
  return segmento.length > 8 ? `${segmento.slice(0, 8)}…` : segmento
}

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

  // P2.5: migas según la ruta actual. En cursos: Panel > Cursos >
  // id corto del curso > id corto de la lección (sin fetch: el título real
  // vive en la página, el segmento crudo es el fallback). Fuera de cursos:
  // Panel > sección activa del sidebar. La última miga nunca lleva href.
  const migas: Miga[] = (() => {
    if (!pathname) return [{ etiqueta: "Panel" }]
    const segmentos = pathname.split("/").filter(Boolean)
    if (segmentos[1] === "cursos") {
      const lista: Miga[] = [
        { etiqueta: "Panel", href: "/admin" },
        { etiqueta: "Cursos", href: "/admin/cursos" },
      ]
      const courseId = segmentos[2]
      const lessonId = segmentos[3] === "lecciones" ? segmentos[4] : undefined
      if (courseId) {
        // Al curso se vuelve vía /admin/cursos (la selección persiste por P2.4).
        lista.push({ etiqueta: segmentoCorto(courseId), href: lessonId ? "/admin/cursos" : undefined })
        if (lessonId) lista.push({ etiqueta: segmentoCorto(lessonId) })
      }
      return lista
    }
    const lista: Miga[] = [{ etiqueta: "Panel", href: "/admin" }]
    const activa = visibleGroups.flatMap((g) => g.items).find((item) => isActive(item.href))
    if (activa) {
      lista.push({ etiqueta: activa.title })
    } else {
      const ultimo = segmentos[segmentos.length - 1]
      lista.push({ etiqueta: ultimo ? segmentoCorto(ultimo) : "Panel" })
    }
    return lista
  })()

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

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <nav aria-label="Migas de pan" className="min-w-0 flex-1 overflow-hidden">
              <ol className="flex min-w-0 items-center gap-1 text-sm">
                {migas.map((miga, idx) => {
                  const ultima = idx === migas.length - 1
                  return (
                    <li key={`${miga.etiqueta}-${idx}`} className="flex min-w-0 items-center gap-1">
                      {idx > 0 ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      ) : null}
                      {ultima || !miga.href ? (
                        <span aria-current="page" className="truncate font-medium text-foreground">
                          {miga.etiqueta}
                        </span>
                      ) : (
                        <Link
                          href={miga.href}
                          className="shrink-0 text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {miga.etiqueta}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>
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
