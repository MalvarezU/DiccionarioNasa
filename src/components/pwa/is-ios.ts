/** iOS Safari never fires `beforeinstallprompt`: manual steps are the only path. */
export function isIOSDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false
  const ua = navigator.userAgent ?? ""
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13+ reports itself as Macintosh when touch is available
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
}
