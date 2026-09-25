"use client"

import { useState, useCallback } from "react"
import { type PreviewWordData } from "./WordPreviewModal"
import { useWordAudio } from "./use-word-audio"
import {
  EMPTY_WORD_FORM,
  validateWordForm,
  type WordForm,
} from "./word-form"

interface UseCreateWordArgs {
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

/**
 * Lógica de creación de ficha: formulario, validación, guardado como
 * borrador o publicada, y vista previa. Reusa use-word-audio y word-form
 * (mismo dominio que el editor; la UI difiere y vive en cada modal).
 */
export function useCreateWord({ onOpenChange, onCreated }: UseCreateWordArgs) {
  const [form, setForm] = useState<WordForm>({ ...EMPTY_WORD_FORM })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const audio = useWordAudio()
  const { audioUrl, audioPreview, isUploadingAudio, removeAudio } = audio

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

  const resetForm = useCallback(() => {
    setForm({ ...EMPTY_WORD_FORM })
    removeAudio()
  }, [removeAudio])

  const handleSubmit = useCallback(
    async (targetStatus: "DRAFT" | "PUBLISHED") => {
      const errors = validateWordForm(form)
      setFieldErrors(errors)
      if (Object.keys(errors).length > 0) return

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const payload = {
          ...form,
          status: targetStatus,
          audioUrl: audioUrl || undefined,
        }

        const res = await fetch("/api/admin/words", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          resetForm()
          setSuccessMessage(
            targetStatus === "DRAFT"
              ? "Ficha guardada como borrador"
              : "Ficha guardada y publicada"
          )
          setTimeout(() => {
            setSuccessMessage(null)
            onOpenChange(false)
            onCreated()
          }, 1500)
        } else {
          const data = await res.json()
          setSubmitError(data.message || "Error al crear la ficha")
        }
      } catch {
        setSubmitError("Error de conexión al servidor")
      } finally {
        setIsSubmitting(false)
      }
    },
    [form, audioUrl, resetForm, onOpenChange, onCreated]
  )

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setFieldErrors({})
      setSubmitError(null)
      setSuccessMessage(null)
      resetForm()
      onOpenChange(false)
    }
  }, [isSubmitting, onOpenChange, resetForm])

  const previewWord: PreviewWordData = {
    spanish: form.spanish,
    nasaYuwe: form.nasaYuwe,
    pronunciation: form.pronunciation || null,
    culturalContext: form.culturalContext || null,
    category: form.category || null,
    audioUrl: audioUrl || audioPreview || null,
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
    audio,
    previewWord,
    handleChange,
    handleSubmit,
    handleClose,
  }
}
