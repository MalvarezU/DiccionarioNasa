"use client"

import { useState, useCallback, useRef } from "react"
import {
  VALID_AUDIO_TYPES,
  VALID_AUDIO_EXTENSIONS,
  MAX_AUDIO_SIZE,
} from "@/lib/admin-utils"

/**
 * Dominio de audio de la ficha: selección, validación, subida, drag&drop y
 * restauración al original. Lo usa use-edit-word (y a futuro CreateWordModal).
 */
export function useWordAudio() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioPreview, setAudioPreview] = useState<string | null>(null)
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [audioChanged, setAudioChanged] = useState(false)
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetAudio = useCallback((url: string | null) => {
    setAudioUrl(url)
    setOriginalAudioUrl(url)
    setAudioFile(null)
    setAudioPreview(null)
    setAudioChanged(false)
    setAudioError(null)
  }, [])

  const validateAudioFile = useCallback((file: File): string | null => {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
    const isValidMime = VALID_AUDIO_TYPES.includes(file.type)
    const isValidExt = VALID_AUDIO_EXTENSIONS.includes(ext)
    if (!isValidMime && !isValidExt) return "Formato no soportado. Usa MP3, WAV u OGG"
    if (file.size > MAX_AUDIO_SIZE) return "El audio no puede superar los 10 MB"
    return null
  }, [])

  const handleAudioSelect = useCallback(
    async (file: File) => {
      const error = validateAudioFile(file)
      if (error) { setAudioError(error); return }
      setAudioError(null)
      setAudioFile(file)
      if (audioPreview) URL.revokeObjectURL(audioPreview)
      const previewUrl = URL.createObjectURL(file)
      setAudioPreview(previewUrl)

      setIsUploadingAudio(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch("/api/admin/upload-audio", { method: "POST", body: formData })
        const data = await res.json()
        if (res.ok) {
          setAudioUrl(data.audioUrl)
          setAudioChanged(true)
          setAudioError(null)
        } else {
          setAudioError(data.message || "Error al subir el audio")
          setAudioUrl(originalAudioUrl)
        }
      } catch {
        setAudioError("Error de conexión al subir el audio")
        setAudioUrl(originalAudioUrl)
      } finally {
        setIsUploadingAudio(false)
      }
    },
    [validateAudioFile, audioPreview, originalAudioUrl]
  )

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleAudioSelect(file)
  }, [handleAudioSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false) }, [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleAudioSelect(file)
    },
    [handleAudioSelect]
  )

  const removeAudio = useCallback(() => {
    if (audioPreview) URL.revokeObjectURL(audioPreview)
    setAudioFile(null)
    setAudioUrl(originalAudioUrl)
    setAudioPreview(null)
    setAudioError(null)
    setAudioChanged(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [audioPreview, originalAudioUrl])

  return {
    audioUrl,
    audioFile,
    audioPreview,
    isUploadingAudio,
    audioError,
    isDragOver,
    audioChanged,
    originalAudioUrl,
    fileInputRef,
    resetAudio,
    handleAudioSelect,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileInputChange,
    removeAudio,
  }
}
