import Link from "next/link"
import { ArrowRight, Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export type GameMotif = "flash" | "memory" | "gaps"

/** Decorative mini illustration for a game tile. Pure CSS/divs, no assets. */
export function GameMotifArt({ motivo }: { motivo: GameMotif }) {
  if (motivo === "flash") {
    return (
      <div
        aria-hidden="true"
        className="relative flex items-center justify-center"
      >
        {/* Back card, tilted behind */}
        <div className="absolute h-14 w-20 -rotate-6 rounded-md border border-primary/30 bg-secondary-container" />
        {/* Front card: mini ivory flashcard with ghost option lines */}
        <div className="relative flex h-14 w-20 rotate-2 flex-col items-center justify-center gap-1 rounded-md border border-primary bg-background px-2 shadow-sm transition-transform duration-200 group-hover:rotate-0">
          <span className="font-serif text-sm font-bold leading-none text-primary">
            yuwe
          </span>
          <span className="h-1 w-12 rounded-full bg-primary/15" />
          <span className="h-1 w-9 rounded-full bg-primary/15" />
          <span className="h-1 w-11 rounded-full bg-primary/15" />
        </div>
      </div>
    )
  }

  if (motivo === "memory") {
    // 3x2 mini grid: 2 flipped (olive mist) + 4 face-down (slate mist)
    const cells: Array<{ flipped: boolean }> = [
      { flipped: false },
      { flipped: true },
      { flipped: false },
      { flipped: false },
      { flipped: true },
      { flipped: false },
    ]
    return (
      <div aria-hidden="true" className="grid grid-cols-3 gap-1.5">
        {cells.map((cell, i) =>
          cell.flipped ? (
            <span
              key={i}
              className="flex h-4 w-3 items-center justify-center rounded-[3px] bg-secondary-container text-[8px] leading-none text-secondary"
            >
              ·
            </span>
          ) : (
            <span
              key={i}
              className="flex h-4 w-3 items-center justify-center rounded-[3px] bg-primary/15 text-[8px] leading-none text-primary/60"
            >
              ?
            </span>
          )
        )}
      </div>
    )
  }

  // gaps: `c _ s _` with blanks as olive-underlined cells
  return (
    <div
      aria-hidden="true"
      className="flex items-end gap-1.5 font-serif text-[20px] font-bold leading-none text-primary"
    >
      <span>c</span>
      <span className="inline-block h-[22px] w-4 border-b-2 border-secondary" />
      <span>s</span>
      <span className="inline-block h-[22px] w-4 border-b-2 border-secondary" />
    </div>
  )
}

interface GameTileProps {
  motivo: GameMotif
  href: string
  title: string
  description: string
  locked?: boolean
}

/** Hub tile: 96px motif preview + title + description + play link. */
export function GameTile({
  motivo,
  href,
  title,
  description,
  locked = false,
}: GameTileProps) {
  const card = (
    <Card
      className={`h-full transition-all ${
        locked
          ? "opacity-60"
          : "group cursor-pointer hover:shadow-md hover:border-primary/40"
      }`}
    >
      <CardHeader className="pb-3">
        {locked && (
          <div className="flex justify-end">
            <Badge variant="outline" className="shrink-0 text-2xs">
              <Lock className="h-3 w-3 mr-1" />
              Próximamente
            </Badge>
          </div>
        )}
        <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-surface-container-highest/50">
          <GameMotifArt motivo={motivo} />
        </div>
        <CardTitle className="text-xl font-serif">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
        {locked ? (
          <Button
            disabled
            variant="outline"
            className="mt-4 gap-1.5 cursor-not-allowed"
          >
            <Lock className="h-4 w-4" />
            Próximamente
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="mt-4 gap-1.5 px-0 text-primary hover:text-primary/80 hover:bg-transparent"
          >
            Jugar ahora
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
  if (locked) return card
  return <Link href={href}>{card}</Link>
}
