"use client"

import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  AudioLines,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Images,
  RefreshCw,
  Users,
} from "lucide-react"
import { AdminDashboardSkeleton } from "@/components/skeletons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FullAuditLogModal } from "./FullAuditLogModal"
import { useAdminStats } from "./use-admin-stats"
import { DashboardStats } from "./dashboard-stats"
import { DashboardActivity } from "./dashboard-activity"
import { formatNumber } from "@/lib/admin-utils"

/**
 * Resumen del panel: secciones con accesos, pendientes operativos,
 * métricas y actividad reciente.
 *
 * La gestión de fichas vive en /admin/palabras y la de usuarios en
 * /admin/usuarios; este componente solo enlaza hacia esas secciones.
 */
export function AdminDashboard({ isAdmin = true }: { isAdmin?: boolean }) {
  const {
    mounted,
    stats,
    isLoading,
    isRefreshing,
    error,
    lastRefreshed,
    statusSum,
    sumMatchesTotal,
    publishedWithAudio,
    handleRefresh,
  } = useAdminStats()

  const [fullAuditLogOpen, setFullAuditLogOpen] = useState(false)

  if (!mounted) return null

  if (isLoading) {
    return <AdminDashboardSkeleton />
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-destructive">{error || "No se pudieron cargar las estadísticas"}</p>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    )
  }

  const secciones = [
    {
      titulo: "Palabras",
      desc: "Fichas del diccionario",
      href: "/admin/palabras",
      Icon: BookOpen,
      conteo: `${formatNumber(stats.totalWords)} fichas`,
    },
    {
      titulo: "Gestión de cursos",
      desc: "Módulos y lecciones",
      href: "/admin/cursos",
      Icon: GraduationCap,
    },
    {
      titulo: "Ilustraciones",
      desc: "Banco de imágenes",
      href: "/admin/ilustraciones",
      Icon: Images,
    },
    {
      titulo: "Audios",
      desc: "Grabaciones por palabra",
      href: "/admin/audios",
      Icon: AudioLines,
    },
    ...(isAdmin
      ? [
          {
            titulo: "Usuarios",
            desc: "Roles y accesos",
            href: "/admin/usuarios",
            Icon: Users,
            conteo: `${formatNumber(stats.totalUsers)} usuarios`,
          },
        ]
      : []),
  ]

  const pendientes: Array<{ texto: string; href: string }> = []
  if (stats.draftCount > 0) {
    pendientes.push({
      texto: `${formatNumber(stats.draftCount)} borrador${stats.draftCount !== 1 ? "es" : ""} por publicar`,
      href: "/admin/palabras",
    })
  }
  if (stats.publishedWithoutAudio > 0) {
    pendientes.push({
      texto: `${formatNumber(stats.publishedWithoutAudio)} publicada${stats.publishedWithoutAudio !== 1 ? "s" : ""} sin audio`,
      href: "/admin/audios",
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-end gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Actualizando..." : "Actualizar"}
        </Button>
        {lastRefreshed && (
          <span className="text-2xs text-muted-foreground">
            Última actualización: {lastRefreshed.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <nav aria-label="Secciones del panel" className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {secciones.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-lg border border-outline-variant/20 bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                <s.Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold group-hover:text-primary">{s.titulo}</p>
                <p className="text-xs text-muted-foreground truncate">{s.desc}</p>
                {s.conteo && <p className="text-2xs text-muted-foreground mt-0.5">{s.conteo}</p>}
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </Link>
        ))}
      </nav>

      <Card className="mb-6 border border-outline-variant/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            {pendientes.length > 0 ? (
              <AlertTriangle className="h-4 w-4 text-tertiary" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-secondary" />
            )}
            Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {pendientes.length > 0 ? (
            <ul className="divide-y divide-outline-variant/20">
              {pendientes.map((p) => (
                <li key={p.texto}>
                  <Link
                    href={p.href}
                    className="group flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="group-hover:text-primary">{p.texto}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:translate-x-0.5 group-hover:text-primary transition-transform" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pendientes. Todo al día.</p>
          )}
        </CardContent>
      </Card>

      <DashboardStats
        stats={stats}
        statusSum={statusSum}
        sumMatchesTotal={sumMatchesTotal}
        publishedWithAudio={publishedWithAudio}
      />

      <DashboardActivity
        stats={stats}
        onViewAll={() => setFullAuditLogOpen(true)}
        isAdmin={isAdmin}
      />

      <FullAuditLogModal open={fullAuditLogOpen} onOpenChange={setFullAuditLogOpen} isAdmin={isAdmin} />
    </div>
  )
}
