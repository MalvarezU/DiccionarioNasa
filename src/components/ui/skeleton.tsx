import { cn } from "@/lib/utils"

/**
 * Bloque de carga estático.
 *
 * Decisión: skeletons estáticos en gris de la paleta; el barrido de luz se
 * descartó porque no se leía. El relleno es --muted (--surface-container-high,
 * oklch(0.92 0.02 40)), un escalón por debajo de --card: contra --card da
 * 1.10:1, así que el filete de 1px en --outline-variant/40 es lo que dibuja
 * la silueta; sube el contraste a 1.24:1 contra --card.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted rounded-md border border-outline-variant/40", className)}
      {...props}
    />
  )
}

export { Skeleton }
