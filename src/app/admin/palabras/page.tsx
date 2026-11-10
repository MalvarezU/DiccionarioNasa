"use client"

import { Suspense, useState } from "react"
import { useSession } from "next-auth/react"
import { PackagePlus, Plus, Smartphone, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { CreateWordModal } from "@/components/admin/CreateWordModal"
import { ImportCorpusModal } from "@/components/admin/ImportCorpusModal"
import { SeedDispatchModal } from "@/components/admin/SeedDispatchModal"
import { ApkDispatchModal } from "@/components/admin/ApkDispatchModal"
import { EditWordModal } from "@/components/admin/EditWordModal"
import { WordListContent } from "@/components/admin/word-list-content"
import { WordTableSkeleton } from "@/components/skeletons"
import { type WordForEdit } from "@/components/admin/word-form"

/**
 * Sección Palabras: acciones + gestión inline de fichas.
 * Los modales (crear, importar, editar) se reutilizan sin cambios;
 * tras cada mutación se remonta la lista para recargar (equivale a
 * reabrir el modal anterior).
 */
export default function AdminPalabrasPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string } | undefined)?.role
  const isAdmin = userRole === "admin"

  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [seedOpen, setSeedOpen] = useState(false)
  const [apkOpen, setApkOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<WordForEdit | null>(null)
  const [listKey, setListKey] = useState(0)
  const refreshList = () => setListKey((k) => k + 1)

  return (
    <>
      <AdminPageHeader
        title="Gestión de palabras"
        description="Fichas del diccionario: crear, gestionar e importar."
        actions={
          <>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva ficha
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Importar corpus
            </Button>
            <Button variant="outline" onClick={() => setSeedOpen(true)} className="gap-2">
              <PackagePlus className="h-4 w-4" />
              Generar contenido offline
            </Button>
            <Button variant="outline" onClick={() => setApkOpen(true)} className="gap-2">
              <Smartphone className="h-4 w-4" />
              Publicar APK
            </Button>
          </>
        }
      />

      {/* Suspense: useWordList lee ?q/?filtro/?page con useSearchParams */}
      <Suspense fallback={<WordTableSkeleton rows={5} />}>
        <WordListContent
          key={listKey}
          onEditWord={(w) => {
            setEditingWord(w)
            setEditOpen(true)
          }}
          onBulkActionDone={refreshList}
          canBulkArchive={isAdmin}
          emptyAction={
            <Button onClick={() => setCreateOpen(true)} className="mt-2 gap-2" size="sm">
              <Plus className="h-4 w-4" />
              Nueva ficha
            </Button>
          }
        />
      </Suspense>

      <CreateWordModal open={createOpen} onOpenChange={setCreateOpen} onCreated={refreshList} />
      <ImportCorpusModal open={importOpen} onOpenChange={setImportOpen} onImported={refreshList} />
      <SeedDispatchModal open={seedOpen} onOpenChange={setSeedOpen} />
      <ApkDispatchModal open={apkOpen} onOpenChange={setApkOpen} />
      <EditWordModal
        key={editingWord?.id ?? "new"}
        open={editOpen}
        onOpenChange={setEditOpen}
        word={editingWord}
        onSaved={refreshList}
      />
    </>
  )
}
