/**
 * SkipLink: atajo de teclado al contenido principal.
 * Invisible hasta recibir foco (marfil sobre pizarra); apunta al <main>
 * con id="contenido" de las páginas públicas.
 */
export function SkipLink({ targetId = "contenido" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-montana-deep focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-crema"
    >
      Saltar al contenido
    </a>
  )
}
