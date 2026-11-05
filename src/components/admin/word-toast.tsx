import { Archive, CheckCircle2, Eye, RefreshCw } from "lucide-react"

const TOAST_ICON_CLASS = "h-4 w-4 shrink-0 text-secondary"

/**
 * Toast title with a leading success icon for the admin flows (palabras,
 * cursos, medios). The toast keeps its default variant (background
 * untouched); only the icon carries the secondary (olive) tone next to
 * the foreground title.
 */
export function successToastTitle(message: string) {
  return (
    <span className="flex items-center gap-2">
      <CheckCircle2 className={TOAST_ICON_CLASS} aria-hidden="true" />
      {message}
    </span>
  )
}

/** Alias kept for the word flows; new call sites use successToastTitle. */
export const wordSuccessToastTitle = successToastTitle

const STATUS_TOAST_ICONS = {
  PUBLISHED: Eye,
  ARCHIVED: Archive,
  DRAFT: RefreshCw,
} as const

/**
 * Toast title for word status transitions. Each known status maps to its
 * own icon (published → Eye, archived → Archive, draft → RefreshCw);
 * unknown statuses fall back to the success check.
 */
export function wordStatusToastTitle(status: string, message: string) {
  const Icon =
    (STATUS_TOAST_ICONS as Record<string, typeof Eye>)[status] ??
    CheckCircle2
  return (
    <span className="flex items-center gap-2">
      <Icon className={TOAST_ICON_CLASS} aria-hidden="true" />
      {message}
    </span>
  )
}
