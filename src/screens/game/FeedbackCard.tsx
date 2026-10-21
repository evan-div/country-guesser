import { ArrowRight, Check, Eye, Flame, Flag, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { getCountry } from '../../data/countries'
import { displayCapitals } from '../../game/validation/capitals'
import type { Round, Session } from '../../game/types'
import { Button } from '../../ui/components/Button'

interface Props {
  round: Round
  session: Session
  onNext: () => void
  onFinish: () => void
}

function Chips({ codes, highlight, max = 8 }: { codes: string[]; highlight?: string; max?: number }) {
  const shown = codes.slice(0, max)
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((c) => (
        <span
          key={c}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[12px] ${
            c === highlight ? 'bg-mint/15 text-mint ring-1 ring-mint/40' : 'bg-white/[0.06] text-mist'
          }`}
        >
          <span className="text-[13px] leading-none">{getCountry(c).flag}</span>
          {getCountry(c).name}
        </span>
      ))}
      {codes.length > max && <span className="px-1 text-[12px] text-haze">+{codes.length - max} more</span>}
    </div>
  )
}

/** Educational result card shown in ANSWER_REVEAL. */
export function FeedbackCard({ round, session, onNext, onFinish }: Props) {
  const res = round.result!
  const c = getCountry(round.code)
  const correct = res.outcome === 'correct'
  const arcade = session.style === 'arcade'
  const nextRef = useRef<HTMLButtonElement>(null)
  const caps = displayCapitals(c.code)

  // Desktop: keyboard focus on the main action so Enter advances.
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) nextRef.current?.focus({ preventScroll: true })
  }, [round.id])

  const headline = correct ? 'Correct!' : res.outcome === 'revealed' ? 'Answer revealed' : 'Not quite'
  const Icon = correct ? Check : res.outcome === 'revealed' ? Eye : X

  return (
    <div className="animate-rise-in" role="status" aria-live="polite">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1 font-display text-sm font-bold tracking-wide ${
            correct ? 'bg-mint/15 text-mint' : res.outcome === 'revealed' ? 'bg-white/10 text-mist' : 'bg-coral/15 text-coral'
          }`}
        >
          <Icon size={16} strokeWidth={3} />
          {headline}
        </div>
        {arcade && correct && (
          <div className="text-right font-display">
            <div className="text-gold-glow text-2xl leading-none font-bold text-gold tabular-nums animate-pop">+{res.points}</div>
            <div className="mt-0.5 text-[11px] text-haze tabular-nums">
              {res.base} pts{res.multiplier > 1 ? ` × ${res.multiplier}` : ''}
            </div>
          </div>
        )}
        {arcade && !correct && <div className="text-xs font-semibold text-coral">−1 life</div>}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[40px] leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" aria-hidden>
          {c.flag}
        </span>
        <div className="min-w-0">
          <div className="truncate font-display text-[26px] leading-tight font-bold text-white">{c.name}</div>
          {c.official !== c.name && <div className="truncate text-xs text-haze">{c.official}</div>}
        </div>
      </div>

      {(res.guessLabel || res.note || res.typoOf) && (
        <div className="mt-2.5 space-y-0.5 text-[13px]">
          {res.guessLabel && !correct && (
            <p className="text-haze">
              You answered <span className="font-semibold text-coral">{res.guessLabel}</span>
            </p>
          )}
          {res.guessLabel && correct && round.challenge === 'neighbors' && (
            <p className="text-haze">
              You named <span className="font-semibold text-mint">{res.guessLabel}</span>
            </p>
          )}
          {res.typoOf && correct && <p className="text-haze">Accepted — spelled “{res.typoOf}”.</p>}
          {res.note && <p className="text-haze">{res.note}</p>}
        </div>
      )}

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-2xl bg-white/[0.035] p-3 text-[13px]">
        <dt className="text-haze">Continent</dt>
        <dd className="text-mist">
          {c.continent} <span className="text-haze">· {c.subregion}</span>
        </dd>
        <dt className="text-haze">Capital</dt>
        <dd className={round.challenge === 'capital' ? 'font-semibold text-glow' : 'text-mist'}>{caps.join(' · ')}</dd>
        <dt className="text-haze">{c.neighbors.length ? 'Neighbors' : 'Borders'}</dt>
        <dd>
          {c.neighbors.length ? (
            <Chips codes={c.neighbors} highlight={correct ? res.guessCode : undefined} max={round.challenge === 'neighbors' ? 20 : 6} />
          ) : (
            <span className="text-mist">
              None — island nation
              {c.nearby.length > 0 && <span className="text-haze"> · near {getCountry(c.nearby[0].code).name}</span>}
            </span>
          )}
        </dd>
      </dl>

      <div className="mt-3 flex items-center justify-between text-[13px]">
        <div className="flex items-center gap-1.5 text-haze">
          <Flame size={15} className={session.streak > 0 ? 'text-ember' : 'text-white/30'} />
          {session.streak > 0 ? (
            <span>
              Streak <span className="font-semibold text-white tabular-nums">{session.streak}</span>
            </span>
          ) : (
            <span>Streak reset</span>
          )}
        </div>
        {arcade && session.lives !== null && (
          <span className="text-haze tabular-nums">
            {session.lives} {session.lives === 1 ? 'life' : 'lives'} left
          </span>
        )}
      </div>

      <div className="mt-3">
        {session.over ? (
          <Button ref={nextRef} variant="gold" size="lg" block onClick={onFinish} icon={<Flag size={19} />}>
            See results
          </Button>
        ) : (
          <Button ref={nextRef} variant="primary" size="lg" block onClick={onNext}>
            {round.challenge === 'country' ? 'Next country' : 'Next'}
            <ArrowRight size={20} strokeWidth={2.5} />
          </Button>
        )}
      </div>
    </div>
  )
}
