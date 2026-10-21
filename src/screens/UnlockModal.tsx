import { Sparkles } from 'lucide-react'
import { CHALLENGES } from '../game/challenges'
import type { Challenge } from '../game/types'
import { Button } from '../ui/components/Button'

/** Celebration shown once when a new geography mode unlocks. */
export function UnlockModal({
  challenge,
  canTry,
  onClose,
  onTry,
}: {
  challenge: Challenge
  canTry: boolean
  onClose: () => void
  onTry: () => void
}) {
  const info = CHALLENGES[challenge]
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-ink-950/70" onClick={onClose} />
      <div className="glass-strong relative w-full max-w-sm animate-pop rounded-[28px] border-gold/40 p-6 text-center shadow-[0_0_60px_-10px_rgba(255,200,87,0.5)]">
        <div className="mx-auto flex h-16 w-16 animate-glow-pulse items-center justify-center rounded-full bg-gold/15">
          <Sparkles className="text-gold" size={30} />
        </div>
        <p className="mt-4 text-xs font-semibold tracking-[0.3em] text-gold uppercase">New mode unlocked</p>
        <h2 className="text-gold-glow mt-1 font-display text-3xl font-bold text-white">{info.title}</h2>
        <p className="mt-2 text-sm text-haze">
          {info.tagline}. Unlocked by identifying {info.unlockAt} different countries.
        </p>
        <div className="mt-6 space-y-2">
          {canTry ? (
            <>
              <Button variant="gold" size="lg" block onClick={onTry}>
                Try {info.title} mode
              </Button>
              <Button variant="ghost" block onClick={onClose}>
                Later
              </Button>
            </>
          ) : (
            <Button variant="gold" size="lg" block onClick={onClose}>
              Awesome — keep playing
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
