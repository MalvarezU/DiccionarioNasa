"use client"

import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
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
 * Resumen del panel: pendientes operativos, métricas y actividad reciente.
 *
 * La gestión de fichas vive en /admin/palabras y la de usuarios en
 * /admin/usuarios; la navegación a esas vistas vive en el sidebar
 * persistente, no aquí.
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
      <div className="mb-6 flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
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
          <span className="text-2xs tabular-nums text-muted-foreground">
            Última actualización: {lastRefreshed.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {pendientes.length > 0 ? (
      <Card className="mb-6 rounded-2xl border border-outline-variant/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-tertiary" />
            Pendientes
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
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
        </CardContent>
      </Card>
      ) : (
        <p className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />
          Sin pendientes. Todo al día.
        </p>
      )}

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
