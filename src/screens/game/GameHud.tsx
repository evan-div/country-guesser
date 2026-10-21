import { Check, Menu, RotateCcw, X } from 'lucide-react'
import { forwardRef } from 'react'
import type { Session } from '../../game/types'
import { Hearts } from '../../ui/components/Hearts'
import { StreakBadge } from '../../ui/components/StreakBadge'
import { IconButton } from '../../ui/components/Button'
import { useCountUp } from '../../ui/hooks/useCountUp'
import { CHALLENGES } from '../../game/challenges'

interface Props {
  session: Session
  animations: boolean
  onMenu: () => void
  pointsFlash: { id: number; points: number } | null
}

export const GameHud = forwardRef<HTMLDivElement, Props>(function GameHud({ session, animations, onMenu, pointsFlash }, ref) {
  const score = useCountUp(session.score, animations)
  const arcade = session.style === 'arcade'
  return (
    <div ref={ref} className="pointer-events-none absolute inset-x-0 top-0 z-20 pt-safe px-safe">
      <div className="mx-auto flex max-w-xl items-start gap-2 pt-1">
        <div className="glass pointer-events-auto relative flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3.5 py-2">
          {arcade ? (
            <>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-[0.18em] text-haze uppercase">Score</div>
                <div className="font-display text-xl leading-tight font-bold text-white tabular-nums">
                  {score.toLocaleString()}
                </div>
                {pointsFlash && pointsFlash.points > 0 && (
                  <div
                    key={pointsFlash.id}
                    className="text-gold-glow absolute top-1 left-[5.5rem] animate-float-up font-display text-lg font-bold text-gold"
                  >
                    +{pointsFlash.points}
                  </div>
                )}
              </div>
              <div className="ml-auto">
                <Hearts lives={session.lives ?? 0} max={session.maxLives ?? 5} />
              </div>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] text-haze uppercase">
                  {session.style === 'echo' && <RotateCcw size={11} />}
                  {session.style === 'echo' ? 'Echo Rounds' : 'Practice'} · {CHALLENGES[session.challenge].title}
                </div>
                <div className="flex items-center gap-3 font-display text-lg leading-tight font-bold tabular-nums">
                  <span className="flex items-center gap-1 text-mint">
                    <Check size={16} strokeWidth={3} />
                    {session.correct}
                  </span>
                  <span className="flex items-center gap-1 text-coral">
                    <X size={16} strokeWidth={3} />
                    {session.incorrect}
                  </span>
                </div>
              </div>
              {session.rounds > 0 && (
                <div className="ml-auto text-right">
                  <div className="text-[10px] font-semibold tracking-[0.18em] text-haze uppercase">Accuracy</div>
                  <div className="font-display text-lg leading-tight font-bold text-white tabular-nums">
                    {Math.round((session.correct / session.rounds) * 100)}%
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="pointer-events-auto">
          <StreakBadge streak={session.streak} showMultiplier={arcade} />
        </div>
        <IconButton label="Game menu" className="pointer-events-auto" onClick={onMenu}>
          <Menu size={20} />
        </IconButton>
      </div>
    </div>
  )
})
