import { ArrowLeft, Crown, Flame, Home, ListChecks, RotateCcw, Target, Trophy, Zap } from 'lucide-react'
import { useState } from 'react'
import { getCountry } from '../data/countries'
import { CHALLENGES } from '../game/challenges'
import type { GameOverInfo } from '../game/useGame'
import type { Session } from '../game/types'
import { displayCapitals } from '../game/validation/capitals'
import { Button } from '../ui/components/Button'
import { useCountUp } from '../ui/hooks/useCountUp'

interface Props {
  session: Session
  info: GameOverInfo | null
  animations: boolean
  onPlayAgain: () => void
  onHome: () => void
  onEchoMissed: (codes: string[]) => void
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.045] p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-haze uppercase">
        {icon}
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl font-bold tabular-nums ${accent ?? 'text-white'}`}>{value}</div>
    </div>
  )
}

export function GameOverScreen({ session, info, animations, onPlayAgain, onHome, onEchoMissed }: Props) {
  const [reviewing, setReviewing] = useState(false)
  const score = useCountUp(session.score, animations, 1100)
  const arcade = session.style === 'arcade'
  const accuracy = session.rounds ? Math.round((session.correct / session.rounds) * 100) : 0
  const best = Math.max(info?.previousHigh ?? 0, session.score)

  return (
    <div className="absolute inset-0 z-30 flex animate-fade-in flex-col bg-ink-950/75 backdrop-blur-[2px]">
      <div className="no-scrollbar flex-1 overflow-y-auto pt-safe px-safe pb-safe">
        <div className="mx-auto max-w-lg py-6">
          {!reviewing ? (
            <div className="animate-rise-in">
              <p className="text-center text-xs font-semibold tracking-[0.3em] text-haze uppercase">
                {arcade ? 'Game over' : session.style === 'echo' ? 'Echo Rounds complete' : 'Practice complete'} ·{' '}
                {CHALLENGES[session.challenge].title}
              </p>

              {arcade ? (
                <div className="mt-3 text-center">
                  <div className="text-glow font-display text-6xl font-bold text-white tabular-nums">{score.toLocaleString()}</div>
                  {info?.newHighScore ? (
                    <div className="text-gold-glow mt-3 inline-flex animate-pop items-center gap-2 rounded-full border border-gold/50 bg-gold/15 px-4 py-1.5 font-display text-sm font-bold tracking-[0.18em] text-gold uppercase">
                      <Crown size={16} /> New personal best
                    </div>
                  ) : (
                    <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-haze">
                      <Trophy size={15} className="text-gold" /> Personal best{' '}
                      <span className="font-semibold text-white tabular-nums">{best.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 text-center">
                  <div className="font-display text-5xl font-bold text-white tabular-nums">
                    {session.correct}
                    <span className="text-2xl text-haze"> / {session.rounds}</span>
                  </div>
                  <div className="mt-1 text-sm text-haze">answered correctly</div>
                </div>
              )}

              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <Stat icon={<Flame size={13} className="text-ember" />} label="Best streak" value={String(session.bestStreak)} />
                {arcade ? (
                  <Stat
                    icon={<Zap size={13} className="text-gold" />}
                    label="Best multiplier"
                    value={`×${session.bestMultiplier}`}
                    accent={session.bestMultiplier > 1 ? 'text-gold' : undefined}
                  />
                ) : (
                  <Stat icon={<ListChecks size={13} className="text-glow" />} label="Hints used" value={String(session.hintsUsed)} />
                )}
                <Stat icon={<Target size={13} className="text-mint" />} label="Identified" value={String(session.correct)} accent="text-mint" />
                <Stat icon={<Target size={13} className="text-glow" />} label="Accuracy" value={`${accuracy}%`} />
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-[0.2em] text-haze uppercase">
                    Missed · {session.missed.length}
                  </span>
                </div>
                {session.missed.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {session.missed.map((code) => (
                      <span key={code} className="inline-flex items-center gap-1.5 rounded-xl bg-coral/10 px-2.5 py-1 text-[13px] text-mist ring-1 ring-coral/25">
                        <span>{getCountry(code).flag}</span>
                        {getCountry(code).name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-haze">No mistakes — flawless.</p>
                )}
              </div>

              <div className="mt-7 space-y-2.5">
                <Button variant="primary" size="lg" block onClick={onPlayAgain} icon={<RotateCcw size={19} />}>
                  Play again
                </Button>
                <Button block disabled={!session.missed.length} onClick={() => setReviewing(true)} icon={<ListChecks size={18} />}>
                  Review mistakes
                </Button>
                <Button block variant="ghost" onClick={onHome} icon={<Home size={18} />}>
                  Home
                </Button>
              </div>
            </div>
          ) : (
            <div className="animate-rise-in">
              <button onClick={() => setReviewing(false)} className="mb-4 flex items-center gap-1.5 text-sm text-haze hover:text-white">
                <ArrowLeft size={16} /> Results
              </button>
              <h2 className="font-display text-2xl font-bold text-white">Review mistakes</h2>
              <p className="mt-1 text-sm text-haze">
                These countries were added to Echo Rounds. Study them, then turn them into knowledge.
              </p>
              <ul className="mt-4 space-y-2">
                {session.missed.map((code) => {
                  const c = getCountry(code)
                  return (
                    <li key={code} className="glass rounded-2xl p-3.5">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl leading-none">{c.flag}</span>
                        <div className="min-w-0">
                          <div className="font-display text-lg font-semibold text-white">{c.name}</div>
                          <div className="text-xs text-haze">
                            {c.continent} · {c.subregion}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                        <span className="text-haze">Capital</span>
                        <span className="text-mist">{displayCapitals(code).join(' · ')}</span>
                        <span className="text-haze">Neighbors</span>
                        <span className="text-mist">
                          {c.neighbors.length ? c.neighbors.map((n) => getCountry(n).name).join(', ') : 'None (island nation)'}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-5 space-y-2.5">
                <Button variant="primary" size="lg" block onClick={() => onEchoMissed(session.missed)} icon={<RotateCcw size={19} />}>
                  Echo these now
                </Button>
                <Button block variant="ghost" onClick={() => setReviewing(false)}>
                  Back to results
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
