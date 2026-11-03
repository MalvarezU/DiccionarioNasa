"use client"

import { BookOpen } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type WordForEdit } from "./word-form"
import { WordListContent } from "./word-list-content"

interface WordListModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEditWord: (word: WordForEdit) => void
  onBulkActionDone: () => void
  /** Editor: sin archivado en lote (CA-30). Default true (admin). */
  canBulkArchive?: boolean
}

/**
 * Modal de gestión de fichas. El contenido vive en WordListContent
 * (compartido con la página inline /admin/palabras); este wrapper
 * solo aporta el Dialog y cierra al elegir Editar.
 */
export function WordListModal({
  open,
  onOpenChange,
  onEditWord,
  onBulkActionDone,
  canBulkArchive = true,
}: WordListModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Gestión de fichas
          </DialogTitle>
          <DialogDescription>
            Buscá, filtrá y editá las fichas del diccionario.
          </DialogDescription>
        </DialogHeader>

        <WordListContent
          open={open}
          onEditWord={(w) => {
            onEditWord(w)
            onOpenChange(false)
          }}
          onBulkActionDone={onBulkActionDone}
          canBulkArchive={canBulkArchive}
        />
      </DialogContent>
    </Dialog>
  )
}
