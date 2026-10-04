"use client"

/**
 * Embebido de YouTube (compartido por los bloques audio y video).
 *
 * youtube-nocookie: sin cookies de tracking. El `title` es obligatorio — es lo
 * que leen los lectores de pantalla (un iframe sin título es un a11y fail).
 */
export function YoutubeEmbed({ youtubeId, title }: { youtubeId: string; title: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-outline-variant/20">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  )
}
