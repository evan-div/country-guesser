import { Flame } from 'lucide-react'
import { multiplierFor } from '../../game/scoring'

/** Flame + streak count + multiplier; the multiplier pops whenever it changes. */
export function StreakBadge({ streak, showMultiplier = true }: { streak: number; showMultiplier?: boolean }) {
  const mult = multiplierFor(streak)
  const hot = showMultiplier && mult > 1
  return (
    <div
      className={`glass flex h-11 items-center gap-1.5 rounded-2xl pr-2 pl-2.5 ${hot ? 'border-gold/40' : ''}`}
      aria-label={showMultiplier ? `Streak ${streak}, multiplier ${mult}x` : `Streak ${streak}`}
    >
      <Flame
        size={19}
        className={
          streak > 0
            ? `${hot ? 'fill-ember/70 text-gold' : 'fill-ember/30 text-ember'} ${hot ? 'animate-flicker' : ''}`
            : 'text-white/25'
        }
      />
      <span className={`font-display text-[15px] font-bold tabular-nums ${streak > 0 ? 'text-white' : 'text-white/40'}`}>
        {streak}
      </span>
      {showMultiplier && (
      <span
        key={mult}
        className={`ml-0.5 rounded-lg px-1.5 py-0.5 font-display text-[13px] font-bold tabular-nums animate-pop ${
          hot ? 'bg-gradient-to-b from-gold to-ember text-ink-950 shadow-[0_0_14px_rgba(255,200,87,0.55)]' : 'bg-white/8 text-haze'
        }`}
      >
        ×{mult}
      </span>
      )}
    </div>
  )
}
