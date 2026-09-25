"use client"

import { useState, useCallback, useEffect } from "react"
import { WORD_STATUSES } from "@/lib/admin-utils"
import { type PreviewWordData } from "./WordPreviewModal"
import { useWordAudio } from "./use-word-audio"
import {
  buildWordPayload,
  hasWordChanges,
  toWordForm,
  validateWordForm,
  type WordForEdit,
  type WordForm,
} from "./word-form"

interface UseEditWordArgs {
  open: boolean
  word: WordForEdit | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

/**
 * Lógica del editor de ficha: formulario, validación, guardado, transiciones
 * de estado y vista previa. El audio vive en use-word-audio; la UI en
 * EditWordModal.tsx y EditWordAudio.tsx.
 */
export function useEditWord({ open, word, onOpenChange, onSaved }: UseEditWordArgs) {
  const [form, setForm] = useState<WordForm>(() =>
    toWordForm({ spanish: "", nasaYuwe: "", pronunciation: null, culturalContext: null, category: null, status: "DRAFT", audioUrl: null, id: "" })
  )
  const [originalForm, setOriginalForm] = useState<WordForm>(() =>
    toWordForm({ spanish: "", nasaYuwe: "", pronunciation: null, culturalContext: null, category: null, status: "DRAFT", audioUrl: null, id: "" })
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const audio = useWordAudio()
  const { audioUrl, audioChanged, resetAudio } = audio

  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showPublishNoAudioWarning, setShowPublishNoAudioWarning] = useState(false)
  const [pendingStatusTransition, setPendingStatusTransition] = useState<string | null>(null)

  useEffect(() => {
    if (word && open) {
      setForm(toWordForm(word))
      setOriginalForm(toWordForm(word))
      resetAudio(word.audioUrl)
    }
  }, [word, open, resetAudio])

  const handleChange = useCallback(
    (field: string, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
      setSubmitError(null)
    },
    []
  )

  const hasChanges = hasWordChanges(form, originalForm, audioChanged)

  const handleSubmit = useCallback(async () => {
    const errors = validateWordForm(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0 || !word) return

    if (!hasWordChanges(form, originalForm, audioChanged)) {
      setSubmitError("No se detectaron cambios")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(`/api/admin/words/${word.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildWordPayload(form, audioUrl)),
      })

      const data = await res.json()
      if (res.ok) {
        if (audioChanged && word.audioUrl && data.previousAudioUrl) {
          try {
            await fetch("/api/admin/delete-audio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audioUrl: data.previousAudioUrl }),
            })
          } catch {
            // Silently fail
          }
        }

        setSuccessMessage("Ficha actualizada correctamente")
        setTimeout(() => {
          setSuccessMessage(null)
          onOpenChange(false)
          onSaved()
        }, 1500)
      } else {
        setSubmitError(data.error || data.message || "Error al actualizar la ficha")
      }
    } catch {
      setSubmitError("Error de conexión al servidor")
    } finally {
      setIsSubmitting(false)
    }
  }, [form, word, originalForm, audioUrl, audioChanged, onOpenChange, onSaved])

  const handleClose = useCallback(() => {
    if (!isSubmitting && !isTransitioning) {
      setFieldErrors({})
      setSubmitError(null)
      setSuccessMessage(null)
      onOpenChange(false)
    }
  }, [isSubmitting, isTransitioning, onOpenChange])

  const executeStatusTransition = useCallback(async (newStatus: string) => {
    if (!word) return

    setIsTransitioning(true)
    setSubmitError(null)

    try {
      const res = await fetch(`/api/admin/words/${word.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await res.json()
      if (res.ok) {
        setForm((prev) => ({ ...prev, status: newStatus }))
        setOriginalForm((prev) => ({ ...prev, status: newStatus }))

        const statusLabel = WORD_STATUSES.find((s) => s.value === newStatus)?.label || newStatus
        setSuccessMessage(`Estado cambiado a "${statusLabel}"`)
        setTimeout(() => {
          setSuccessMessage(null)
          onSaved()
        }, 1500)
      } else {
        setSubmitError(data.error || 'Error al cambiar el estado')
      }
    } catch {
      setSubmitError('Error de conexión al servidor')
    } finally {
      setIsTransitioning(false)
      setShowPublishNoAudioWarning(false)
      setPendingStatusTransition(null)
    }
  }, [word, onSaved])

  const handleStatusTransition = useCallback(async (newStatus: string) => {
    if (!word) return

    if (newStatus === 'PUBLISHED' && !audioUrl) {
      setPendingStatusTransition(newStatus)
      setShowPublishNoAudioWarning(true)
      return
    }

    await executeStatusTransition(newStatus)
  }, [word, audioUrl, executeStatusTransition])

  const previewWord: PreviewWordData = {
    spanish: form.spanish,
    nasaYuwe: form.nasaYuwe,
    pronunciation: form.pronunciation || null,
    culturalContext: form.culturalContext || null,
    category: form.category || null,
    audioUrl: audio.audioUrl || audio.audioPreview || null,
    status: form.status,
  }

  return {
    form,
    fieldErrors,
    submitError,
    successMessage,
    previewOpen,
    setPreviewOpen,
    isSubmitting,
    isTransitioning,
    showPublishNoAudioWarning,
    setShowPublishNoAudioWarning,
    pendingStatusTransition,
    hasChanges,
    audio,
    previewWord,
    handleChange,
    handleSubmit,
    handleClose,
    handleStatusTransition,
    executeStatusTransition,
  }
}
