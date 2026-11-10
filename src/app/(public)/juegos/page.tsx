import { Breadcrumbs } from "@/components/breadcrumbs"
import { GameTile, type GameMotif } from "@/components/juegos/game-tile"
import { Reveal } from "@/components/reveal"
import { db } from "@/lib/db"
import type { GameId } from "@/lib/game-words"

/** Audios publicados mínimos para abrir el juego Escucha. */
export const ESCUCHA_MIN_AUDIO = 8

/** Gate de contenido: sin suficientes audios el tile queda bloqueado. */
export function isEscuchaUnlocked(audioCount: number): boolean {
  return audioCount >= ESCUCHA_MIN_AUDIO
}

async function getAudioWordCount(): Promise<number> {
  try {
    return await db.dictionaryWord.count({
      where: { status: "PUBLISHED", audioUrl: { not: null } },
    })
  } catch {
    return 0
  }
}

export default async function JuegosPage() {
  const audioCount = await getAudioWordCount()
  const escuchaLocked = !isEscuchaUnlocked(audioCount)

  const JUEGOS: Array<{
    href: string
    motivo: GameMotif
    gameId: GameId
    title: string
    description: string
    locked: boolean
    lockedBadge?: string
    lockedNote?: string
  }> = [
    {
      href: "/juegos/flashcards",
      motivo: "flash",
      gameId: "flashcards",
      title: "Flashcards",
      description:
        "Se muestra una palabra y eliges la traducción correcta entre 4 opciones. ¡Racha de aciertos!",
      locked: false,
    },
    {
      href: "/juegos/relacionar",
      motivo: "relacionar",
      gameId: "relacionar",
      title: "Relaciona",
      description:
        "Une cada palabra en español con su pareja en Nasa Yuwe.",
      locked: false,
    },
    {
      href: "/juegos/completar",
      motivo: "gaps",
      gameId: "complete",
      title: "Completar palabra",
      description:
        "Escribe las letras que faltan para completar la palabra. ¡Tienes 3 intentos!",
      locked: false,
    },
    {
      href: "/juegos/ordena",
      motivo: "ordena",
      gameId: "ordena",
      title: "Ordena",
      description: "Arma la palabra en Nasa Yuwe ficha por ficha",
      locked: false,
    },
    {
      href: "/juegos/escucha",
      motivo: "escucha",
      gameId: "escucha",
      title: "Escucha",
      description:
        "Escucha el audio en Nasa Yuwe y elige su significado en español.",
      locked: escuchaLocked,
      lockedBadge: "Requiere audios",
      lockedNote: "Necesita al menos 8 palabras con audio publicado.",
    },
  ]

  return (
      <main id="contenido" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Juegos" }]} />
        {/* Hero */}
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary">
                Juegos Didácticos
              </h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Aprende vocabulario Nasa Yuwe jugando. Elige un juego y empieza a practicar.
            </p>
          </div>
        </div>

        {/* Cards de juegos */}
        <Reveal>
          <div className="anim-stagger-children grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {JUEGOS.map((juego) => (
              <GameTile
                key={juego.href}
                motivo={juego.motivo}
                gameId={juego.gameId}
                href={juego.href}
                title={juego.title}
                description={juego.description}
                locked={juego.locked}
                lockedBadge={juego.lockedBadge}
                lockedNote={juego.lockedNote}
              />
            ))}
          </div>
        </Reveal>
      </main>
  )
}
