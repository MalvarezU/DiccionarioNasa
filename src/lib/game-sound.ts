/**
 * Microsynth WebAudio for games (Fase 1.5 juice kit, zero deps).
 *
 * - Tiny oscillator envelopes: pop (correct), thud (wrong), fanfare (win).
 * - Lazy AudioContext (created on first play, resumed on user gesture).
 * - No-op on SSR (no `window`) and when WebAudio is unavailable.
 * - Simple opt-out mute flag in localStorage.
 */

export type GameSoundKind = "correct" | "wrong" | "win"

const MUTE_KEY = "piiyaak:game:sound-muted"

let sharedCtx: AudioContext | null = null

/** True when the player muted game sounds (SSR-safe, defaults to false). */
export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1"
  } catch {
    return false
  }
}

/** Persist the opt-out mute flag (SSR-safe). */
export function setSoundMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, "1")
    else localStorage.removeItem(MUTE_KEY)
  } catch {
    // storage blocked: game still works, just not remembered
  }
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (isSoundMuted()) return null
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  try {
    sharedCtx ??= new Ctor()
    if (sharedCtx.state === "suspended") void sharedCtx.resume()
    return sharedCtx
  } catch {
    return null
  }
}

interface ToneOpts {
  freq: number
  endFreq?: number
  at: number
  dur: number
  type: OscillatorType
  volume: number
}

function tone(ctx: AudioContext, opts: ToneOpts): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const t0 = ctx.currentTime + opts.at
  osc.type = opts.type
  osc.frequency.setValueAtTime(opts.freq, t0)
  if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(opts.endFreq, t0 + opts.dur)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(opts.volume, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + opts.dur + 0.02)
}

/** Short rising pop for a correct answer (~180ms). */
export function playCorrect(): void {
  const ctx = getContext()
  if (!ctx) return
  try {
    tone(ctx, { freq: 660, endFreq: 990, at: 0, dur: 0.16, type: "sine", volume: 0.18 })
  } catch {
    // audio failed: game still works
  }
}

/** Low thud for a wrong answer (~220ms). */
export function playWrong(): void {
  const ctx = getContext()
  if (!ctx) return
  try {
    tone(ctx, { freq: 220, endFreq: 130, at: 0, dur: 0.2, type: "triangle", volume: 0.2 })
  } catch {
    // audio failed: game still works
  }
}

/** Three-note arpeggio for a win (~450ms total). */
export function playWin(): void {
  const ctx = getContext()
  if (!ctx) return
  try {
    const notes = [523.25, 659.25, 783.99]
    notes.forEach((freq, i) => {
      tone(ctx, { freq, at: i * 0.11, dur: 0.22, type: "sine", volume: 0.18 })
    })
  } catch {
    // audio failed: game still works
  }
}

/**
 * Streak-tier shimmer: 1 soft note (tier 1) or 2-note sparkle (tier 2).
 * Total ≤350ms (tier 2 ends at ~0.25s). Call it only when the tier RISES
 * (`streakTier(next) > streakTier(prev)`), not on every correct answer.
 */
export function playStreakTier(tier: 1 | 2): void {
  const ctx = getContext()
  if (!ctx) return
  try {
    if (tier === 1) {
      tone(ctx, { freq: 880, at: 0, dur: 0.14, type: "sine", volume: 0.14 })
    } else {
      tone(ctx, { freq: 784, at: 0, dur: 0.13, type: "sine", volume: 0.14 })
      tone(ctx, { freq: 1174.66, at: 0.09, dur: 0.16, type: "sine", volume: 0.14 })
    }
  } catch {
    // audio failed: game still works
  }
}

/** Convenience dispatcher for the feedback hook. */
export function playGameSound(kind: GameSoundKind): void {
  if (kind === "correct") playCorrect()
  else if (kind === "wrong") playWrong()
  else playWin()
}
