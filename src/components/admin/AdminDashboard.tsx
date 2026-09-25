"use client"

import { useState } from "react"
import { Shield, Loader2, RefreshCw, Plus, BookOpen, Upload, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type WordForEdit } from "./EditWordModal"
import { CreateWordModal } from "./CreateWordModal"
import { EditWordModal } from "./EditWordModal"
import { FullAuditLogModal } from "./FullAuditLogModal"
import { ImportCorpusModal } from "./ImportCorpusModal"
import { WordListModal } from "./WordListModal"
import { useAdminStats } from "./use-admin-stats"
import { DashboardStats } from "./dashboard-stats"
import { DashboardActivity } from "./dashboard-activity"

export function AdminDashboard({ canBulkArchive = true }: { canBulkArchive?: boolean }) {
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
    refreshAfterMutation,
  } = useAdminStats()

  const [createWordOpen, setCreateWordOpen] = useState(false)
  const [importCorpusOpen, setImportCorpusOpen] = useState(false)
  const [fullAuditLogOpen, setFullAuditLogOpen] = useState(false)
  const [wordListOpen, setWordListOpen] = useState(false)
  const [editWordOpen, setEditWordOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<WordForEdit | null>(null)

  if (!mounted) return null

  if (isLoading) {
    return (
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Panel de Administración
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Estadísticas y estado del diccionario
          </p>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="ml-3 text-muted-foreground">Cargando estadísticas...</span>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div>
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Panel de Administración
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <p className="text-sm text-destructive">{error || "No se pudieron cargar las estadísticas"}</p>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          Panel de Administración
        </h2>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground">
          Estadísticas y estado del diccionario
        </p>
        <div className="mt-3 flex items-center justify-center gap-3">
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
            <span className="text-[10px] text-muted-foreground">
              Última actualización: {lastRefreshed.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      <Card className="mb-6 border border-outline-variant/30 bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Acciones rápidas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setCreateWordOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva ficha
            </Button>
            <Button variant="outline" onClick={() => setWordListOpen(true)} className="gap-2">
              <BookOpen className="h-4 w-4" />
              Gestionar fichas
            </Button>
            <Button variant="outline" onClick={() => setImportCorpusOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Importar corpus
            </Button>
            <Button variant="outline" onClick={() => setFullAuditLogOpen(true)} className="gap-2">
              <ScrollText className="h-4 w-4" />
              Ver log completo
            </Button>
          </div>
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
        statusSum={statusSum}
        onViewAll={() => setFullAuditLogOpen(true)}
      />

      <CreateWordModal open={createWordOpen} onOpenChange={setCreateWordOpen} onCreated={refreshAfterMutation} />
      <ImportCorpusModal open={importCorpusOpen} onOpenChange={setImportCorpusOpen} onImported={refreshAfterMutation} />
      <FullAuditLogModal open={fullAuditLogOpen} onOpenChange={setFullAuditLogOpen} />
      <WordListModal
        open={wordListOpen}
        onOpenChange={setWordListOpen}
        onEditWord={(word) => {
          setEditingWord(word)
          setEditWordOpen(true)
        }}
        onBulkActionDone={refreshAfterMutation}
        canBulkArchive={canBulkArchive}
      />
      <EditWordModal
        key={editingWord?.id ?? "new"}
        open={editWordOpen}
        onOpenChange={setEditWordOpen}
        word={editingWord}
        onSaved={refreshAfterMutation}
      />
    </div>
  )
}
