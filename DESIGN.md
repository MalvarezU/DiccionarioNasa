# DESIGN.md — Piiyaak (Diccionario nasa)

Dirección visual del proyecto, capturada del código vigente (`src/app/globals.css`,
`tailwind.config.ts`, kit de juegos `src/components/juegos/`) y extendida con los
tokens de motion de la Fase 2.5 (`src/lib/game-motion.ts`). No es una directiva
nueva: documenta el mundo que ya opera y fija el contrato de composición de la
capa de animación.

## Modo de superficie

Juegos didácticos + hub: mezcla **Operate** (el usuario completa la ronda) con
un momento lúdico (juice kit). La expresividad vive en el feedback de acierto;
la navegación y los estudiantes de vocabulario exigen scanability: neutro por
defecto, color = señal de incidencia (correcto/incorrecto/racha).

## Paleta (territorio Piiyaak, nombres fijos en `@theme`)

| Token | Hex | Uso |
|---|---|---|
| `--color-montana` | `#173f35` | primario (bg `primary`), texto de contraste sobre verde |
| `--color-montana-deep` | `#0e2a22` | hover/anclas profundas |
| `--color-territorio` | `#496b55` | secundario (`secondary`), verde territorio, ring de foco y parejas |
| `--color-amarillo-tierra` | `#d7ae55` | acento amarillo, confetti |
| `--color-terracota` | `#b96f4a` | subrayado de links, acento cálido |
| `--color-crema` | `#f5f0e6` | superficie base cálida |

Regla: el color es señal (verde territorio = acierto, destructive = error,
racha vía `streakClass`); nunca decoración ambiente.

## Tipografía

- `sans` = Inter (`--font-inter`), `serif` = Source Serif (`--font-source-serif`).
- Serif para palabras de contenido y headings de juego (h2 4xl bold);
  sans para UI, labels y micro-textos (piso: `--text-2xs: 0.75rem`, nada por debajo).

## Layout

- Syntax cards con radius `rounded-xl`/`rounded-lg`, bordes 2px de señal.
- Grids de juego: memoria `grid-cols-3 sm:grid-cols-4` con cartas `aspect-[3/4]`;
  hub `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` con stagger CSS (`.anim-stagger-children`).
- Hit targets ≥ 44px (`min-h-11`) en todo control de juego.
- Foco visible universal: `outline` 2px verde territorio con offset.
- **Reserve-then-fill (anti-brinco)**: nada condicional que no tenga su espacio
  ya reservado. Toda inserción condicional que empuje el documento (botón
  Siguiente/Ver resultados, badges de racha, pistas, bloques de feedback)
  vive en un contenedor **siempre montado** con altura reservada (`min-h` =
  altura del contenido más alto) y alterna `visible`/`invisible` en vez de
  montar/desmontar; con `aria-hidden`, `inert`/`tabIndex` cuando esconde
  contenido interactivo. Excepción documentada: contenido principal terminal
  (p. ej. banco de fichas en `failed` de ordena) se deja condicional y se
  anota como revisado, porque reservar su hueco dejaría un vacío muerto.

## Motion (contrato de la Fase 2.5 — juice kit CSS + GSAP)

- **Easing**: una sola curva de proa, `cubic-bezier(0.22, 1, 0.36, 1)`;
  en GSAP su afín es `power3.out` (`GAME_EASE`).
- **Duraciones**: micro-interacción ≤ 350ms; las utilidades CSS lo respetan
  (confetti 750–1000ms es la excepción aceptada y documentada del kit).
- **Confianza de derivación**: el estado de reposo lo pinta React/CSS
  (clases y `data-`); GSAP (`src/lib/game-motion.ts`) solo anima la
  transición y al completar libera el inline (`clearProps`) para que el
  CSS de reposo tome el mando sin flash (`context.revert()` se desarma
  limpio, StrictMode-safe). El flip 3D de Memoria declara su reposo en
  CSS (`.memory-flip-card[data-flip="1"]`) en modo normal y bajo reduce:
  si el contexto GSAP se pierde, las caras siguen visibles.
- **Gate central**: `prefers-reduced-motion: reduce` ⇒ helper no-op total;
  el bloque global de `globals.css` neutraliza CSS por su cuenta. Fallback
  del flip 3D bajo reduce: el CSS pinta el estado final volteado
  (`.memory-flip-card[data-flip="1"]`).
- **Momento por juego (1 hero + micros, nada saturado)**:
  - *Flashcards*: hero = slide+fade de pregunta (`slideReveal` 300ms);
    micros = pulso del badge al subir de tier de racha (`streakTierPulse`),
    countUp del resultado (`countUp` 350ms).
  - *Memoria*: hero = flip 3D real con `rotateY` (`flipCard3D` 280ms);
    micros = matchBurst (asentamiento de pareja en otra capa que el
    `anim-match-pop` CSS), shake/flash de error = keyframes CSS existentes.
  - *Completar*: hero = stamp del check (`stampIn` 260ms); micros = entrada
    deslizante de la palabra nueva, countUp del resultado.
  - *Ordena*: hero = drop-in de ficha al slot (`tileDropIn` 250ms, bounce);
    micro = settle corto al deshacer (`tileSettleBack`, 180ms).
  - *Hub*: CSS cubre todo (stagger de tiles, hover/press) — sin GSAP, por
    composición.
- **No-duplicación**: donde un keyframe del juice kit ya cubre el momento
  (`game-press`, `anim-flash-*`, `anim-match-pop`, `anim-complete-wrong`,
  `game-progress`, `confetti-fall`, stagger del hub) no entra GSAP.
- **A11y de motion**: aria-live/roles/foco intactos; animar solo
  `transform`/`opacity` (compositor, sin layout thrashing); `will-change`
  solo donde impacta (`.memory-flip-inner`).

## Principios

1. **Juice en el acierto, quietud en el andamio**: animar la recompensa,
   no la estructura.
2. **Composición > competencia**: una capa de motion está solo donde CSS
   no llega; si ambas existen, se parte el trabajo (escala CSS / rotateY GSAP).
3. **Menos de un boleto**: cada tween ≤ 350ms; estados, foco y aria (los
   datos y el andamiaje) no participan de la animación.
4. **El idioma manda**: copy y comentarios del repo en español neutro
   (terminología del proyecto: *ficha, racha, hueco, mazo*).
