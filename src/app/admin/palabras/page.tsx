"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Plus, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CreateWordModal } from "@/components/admin/CreateWordModal"
import { ImportCorpusModal } from "@/components/admin/ImportCorpusModal"
import { EditWordModal } from "@/components/admin/EditWordModal"
import { WordListContent } from "@/components/admin/word-list-content"
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
  const [editOpen, setEditOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<WordForEdit | null>(null)
  const [listKey, setListKey] = useState(0)
  const refreshList = () => setListKey((k) => k + 1)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-primary">
            Gestión de palabras
          </h1>
          <p className="text-sm text-muted-foreground">
            Fichas del diccionario: crear, gestionar e importar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva ficha
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar corpus
          </Button>
        </div>
      </div>

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

      <CreateWordModal open={createOpen} onOpenChange={setCreateOpen} onCreated={refreshList} />
      <ImportCorpusModal open={importOpen} onOpenChange={setImportOpen} onImported={refreshList} />
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
