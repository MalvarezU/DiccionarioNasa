"use client"

import {
  BookOpen,
  Eye,
  Pencil,
  Archive,
  CheckCircle2,
  AlertTriangle,
  VolumeX,
  Volume2,
  TrendingUp,
  Heart,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatNumber, type AdminStats } from "@/lib/admin-utils"

interface DashboardStatsProps {
  stats: AdminStats
  statusSum: number
  sumMatchesTotal: boolean
  publishedWithAudio: number
}

/** Tarjetas de métricas: total, estados, consistencia, audio y actividad general. */
export function DashboardStats({ stats, statusSum, sumMatchesTotal, publishedWithAudio }: DashboardStatsProps) {
  return (
    <>
      <Card className="mb-6 border border-outline-variant/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total de palabras
              </p>
              <p className="text-5xl font-bold text-primary mt-1 tracking-tight">
                {formatNumber(stats.totalWords)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Todas las fichas en el sistema (borrador + publicadas + archivadas)
              </p>
            </div>
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 shrink-0">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border border-secondary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Publicadas</p>
                <p className="text-4xl font-bold text-secondary mt-1 tracking-tight">
                  {formatNumber(stats.publishedCount)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Visibles al público</p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-secondary/10 border border-secondary/20 shrink-0">
                <Eye className="h-6 w-6 text-secondary" />
              </div>
            </div>
            {stats.totalWords > 0 && (
              <div className="mt-3 pt-3 border-t border-secondary/20">
                <div className="w-full h-1.5 rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-secondary transition-all duration-500"
                    style={{ width: `${(stats.publishedCount / stats.totalWords) * 100}%` }}
                  />
                </div>
                <p className="text-2xs text-muted-foreground mt-1">
                  {((stats.publishedCount / stats.totalWords) * 100).toFixed(0)}% del total
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-tertiary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Borrador</p>
                <p className="text-4xl font-bold text-tertiary mt-1 tracking-tight">
                  {formatNumber(stats.draftCount)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Pendientes de publicación</p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-tertiary/10 border border-tertiary/20 shrink-0">
                <Pencil className="h-6 w-6 text-tertiary" />
              </div>
            </div>
            {stats.totalWords > 0 && (
              <div className="mt-3 pt-3 border-t border-tertiary/20">
                <div className="w-full h-1.5 rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-tertiary transition-all duration-500"
                    style={{ width: `${(stats.draftCount / stats.totalWords) * 100}%` }}
                  />
                </div>
                <p className="text-2xs text-muted-foreground mt-1">
                  {stats.draftCount > 0 ? `${((stats.draftCount / stats.totalWords) * 100).toFixed(0)}% del total` : "Sin borradores"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-outline-variant/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Archivadas</p>
                <p className="text-4xl font-bold text-muted-foreground mt-1 tracking-tight">
                  {formatNumber(stats.archivedCount)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Retiradas del público</p>
              </div>
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-muted border border-outline-variant/30 shrink-0">
                <Archive className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            {stats.totalWords > 0 && (
              <div className="mt-3 pt-3 border-t border-outline-variant/20">
                <div className="w-full h-1.5 rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-muted-foreground/50 transition-all duration-500"
                    style={{ width: `${(stats.archivedCount / stats.totalWords) * 100}%` }}
                  />
                </div>
                <p className="text-2xs text-muted-foreground mt-1">
                  {stats.archivedCount > 0 ? `${((stats.archivedCount / stats.totalWords) * 100).toFixed(0)}% del total` : "Sin archivadas"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6 border-dashed">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {sumMatchesTotal ? (
                <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-tertiary shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">Verificación de consistencia</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Publicadas ({formatNumber(stats.publishedCount)}) + Borrador ({formatNumber(stats.draftCount)}) + Archivadas ({formatNumber(stats.archivedCount)}) = <span className="font-semibold text-foreground">{formatNumber(statusSum)}</span>
                </p>
              </div>
            </div>
            <Badge
              variant={sumMatchesTotal ? "outline" : "destructive"}
              className={`text-xs gap-1 ${sumMatchesTotal ? "border-secondary/30 text-secondary" : ""}`}
            >
              {sumMatchesTotal ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Coincide con el total ({formatNumber(stats.totalWords)})
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  No coincide (total: {formatNumber(stats.totalWords)})
                </>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-tertiary/30 bg-tertiary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Sin audio cargado</CardDescription>
              <VolumeX className="h-4 w-4 text-tertiary" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-tertiary">{formatNumber(stats.publishedWithoutAudio)}</p>
            <p className="text-xs text-muted-foreground mt-1">Publicadas sin grabación</p>
            {stats.publishedCount > 0 && (
              <div className="mt-2">
                <div className="w-full h-1.5 rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-tertiary transition-all duration-500"
                    style={{ width: `${(stats.publishedWithoutAudio / stats.publishedCount) * 100}%` }}
                  />
                </div>
                <p className="text-2xs text-muted-foreground mt-1">
                  {stats.publishedWithoutAudio === 0 ? "Tienen audio" : `${((stats.publishedWithoutAudio / stats.publishedCount) * 100).toFixed(0)}% de publicadas`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-secondary/30 bg-secondary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Con audio</CardDescription>
              <Volume2 className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-secondary">{formatNumber(publishedWithAudio)}</p>
            <p className="text-xs text-muted-foreground mt-1">Publicadas con grabación</p>
            {stats.publishedCount > 0 && (
              <div className="mt-2">
                <div className="w-full h-1.5 rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-secondary transition-all duration-500"
                    style={{ width: `${(publishedWithAudio / stats.publishedCount) * 100}%` }}
                  />
                </div>
                <p className="text-2xs text-muted-foreground mt-1">
                  {stats.publishedCount > 0 ? `${((publishedWithAudio / stats.publishedCount) * 100).toFixed(0)}% de publicadas` : "Sin publicadas"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Nuevas (7 días)</CardDescription>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{formatNumber(stats.recentWords)}</p>
            <p className="text-xs text-muted-foreground mt-1">Creadas en la última semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Favoritos</CardDescription>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{formatNumber(stats.totalFavorites)}</p>
            <p className="text-xs text-muted-foreground mt-1">Palabras marcadas como favoritas</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" />
            Cobertura de audio — Publicadas
          </CardTitle>
          <CardDescription>Fichas publicadas con y sin grabación de audio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full h-4 rounded-full overflow-hidden flex bg-muted">
            {stats.publishedCount > 0 && (
              <>
                <div
                  className="h-full bg-secondary transition-all duration-500"
                  style={{ width: `${(publishedWithAudio / stats.publishedCount) * 100}%` }}
                  title={`Con audio: ${publishedWithAudio}`}
                />
                <div
                  className="h-full bg-tertiary transition-all duration-500"
                  style={{ width: `${(stats.publishedWithoutAudio / stats.publishedCount) * 100}%` }}
                  title={`Sin audio: ${stats.publishedWithoutAudio}`}
                />
              </>
            )}
          </div>
          <div className="mt-3 flex items-center justify-center gap-6 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block" />
              <span className="text-muted-foreground">Con audio:</span>
              <span className="font-semibold text-foreground">{formatNumber(publishedWithAudio)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-tertiary inline-block" />
              <span className="text-muted-foreground">Sin audio:</span>
              <span className="font-semibold text-tertiary">{formatNumber(stats.publishedWithoutAudio)}</span>
            </span>
            <span className="text-muted-foreground">
              ({stats.publishedCount > 0 ? `${((publishedWithAudio / stats.publishedCount) * 100).toFixed(0)}% completado` : "Sin publicadas"})
            </span>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
