export interface WordForEdit {
  id: string
  spanish: string
  nasaYuwe: string
  pronunciation: string | null
  audioUrl: string | null
  culturalContext: string | null
  category: string | null
  status: string
}

export interface WordForm {
  spanish: string
  nasaYuwe: string
  pronunciation: string
  culturalContext: string
  category: string
  status: string
}

export function toWordForm(word: WordForEdit): WordForm {
  return {
    spanish: word.spanish || "",
    nasaYuwe: word.nasaYuwe || "",
    pronunciation: word.pronunciation || "",
    culturalContext: word.culturalContext || "",
    category: word.category || "",
    status: word.status || "DRAFT",
  }
}

export function validateWordForm(form: WordForm): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!form.spanish.trim()) errors.spanish = "El campo «Español» es obligatorio"
  if (!form.nasaYuwe.trim()) errors.nasaYuwe = "El campo «Nasa Yuwe» es obligatorio"
  return errors
}

export function hasWordChanges(form: WordForm, original: WordForm, audioChanged: boolean): boolean {
  if (audioChanged) return true
  return (
    form.spanish !== original.spanish ||
    form.nasaYuwe !== original.nasaYuwe ||
    form.pronunciation !== original.pronunciation ||
    form.culturalContext !== original.culturalContext ||
    form.category !== original.category ||
    form.status !== original.status
  )
}

export function buildWordPayload(form: WordForm, audioUrl: string | null): Record<string, unknown> {
  return {
    spanish: form.spanish.trim(),
    nasaYuwe: form.nasaYuwe.trim(),
    pronunciation: form.pronunciation.trim() || null,
    culturalContext: form.culturalContext.trim() || null,
    category: form.category.trim() || null,
    status: form.status,
    audioUrl: audioUrl || null,
  }
}
