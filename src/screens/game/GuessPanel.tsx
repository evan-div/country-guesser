import { ArrowUp, Eye, Lightbulb, Radar } from 'lucide-react'
import { forwardRef, useEffect, useState, type FormEvent } from 'react'
import { getCountry, isMicrostate } from '../../data/countries'
import { CHALLENGES, promptFor } from '../../game/challenges'
import { baseCapFor, MAX_HINTS } from '../../game/scoring'
import type { Notice, Phase, Round, Session } from '../../game/types'
import { LetterPattern } from '../../ui/components/LetterPattern'

interface Props {
  phase: Phase
  round: Round
  session: Session
  notice: Notice | null
  hidden: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onSubmit: (value: string) => void
  onHint: () => void
  onReveal: () => void
  onDismissNotice: () => void
}

/** Prompt, progressive hints, answer input and actions. Stays mounted between rounds. */
export const GuessPanel = forwardRef<HTMLDivElement, Props>(function GuessPanel(
  { phase, round, session, notice, hidden, inputRef, onSubmit, onHint, onReveal, onDismissNotice },
  ref,
) {
  const [value, setValue] = useState('')
  const [shake, setShake] = useState(0)

  // Fresh, empty input every round.
  useEffect(() => setValue(''), [round.id])
  useEffect(() => {
    if (notice) setShake((n) => n + 1)
  }, [notice])

  const guessing = phase === 'GUESSING'
  const flying = phase === 'CAMERA_TRANSITION'
  const arcade = session.style === 'arcade'
  const prompt = promptFor(round.challenge, round.code)
  const revealed = round.ladder.slice(0, round.hintsUsed)
  const hintsLeft = MAX_HINTS - round.hintsUsed
  const micro = round.challenge === 'country' && isMicrostate(getCountry(round.code))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!guessing) return
    if (!value.trim()) {
      setShake((n) => n + 1)
      return
    }
    onSubmit(value)
  }

  return (
    <div
      ref={ref}
      aria-hidden={hidden}
      className={`transition-opacity duration-200 ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {flying && round.challenge === 'country' ? (
            <div className="flex items-center gap-2 font-display text-[13px] font-semibold tracking-[0.2em] text-glow uppercase">
              <Radar size={15} className="animate-spin-slow" />
              <span className="animate-scan">Locating target</span>
            </div>
          ) : (
            <h2 className="font-display text-[19px] leading-snug font-semibold text-white">
              {prompt.title}
              {prompt.subject && (
                <>
                  {' '}
                  <span className="text-glow">{prompt.subject}</span>?
                </>
              )}
            </h2>
          )}
          {micro && !flying && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-haze">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-glow" />
              Tiny country — follow the beacon
            </div>
          )}
        </div>
        {arcade && guessing && (
          <div className="shrink-0 text-right">
            <div className="text-[10px] font-semibold tracking-[0.16em] text-haze uppercase">Worth</div>
            <div className="font-display text-sm font-bold text-gold tabular-nums">{baseCapFor(round.hintsUsed)} pts</div>
          </div>
        )}
      </div>

      {revealed.length > 0 && (
        <ol className="no-scrollbar mb-3 max-h-[min(26vh,190px)] space-y-1.5 overflow-y-auto" aria-label="Hints">
          {revealed.map((h, i) => (
            <li
              key={h.level}
              className={`rounded-xl border border-gold/20 bg-gold/[0.06] px-3 py-2 ${i === revealed.length - 1 ? 'animate-rise-in' : ''}`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-px shrink-0 rounded-md bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-gold uppercase">
                  {h.label}
                </span>
                <p className="text-[13px] leading-snug text-mist">{h.text}</p>
              </div>
              {h.pattern && (
                <div className="mt-1.5 pl-1">
                  <LetterPattern pattern={h.pattern} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {notice && (
        <p key={notice.id} role="status" className="mb-2 animate-shake text-[13px] text-gold">
          {notice.text}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2" autoComplete="off">
        <div key={shake} className={`relative flex-1 ${shake ? 'animate-shake' : ''}`}>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (notice) onDismissNotice()
            }}
            name={`atlas-answer-${round.id}`}
            type="text"
            inputMode="text"
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            aria-label={CHALLENGES[round.challenge].placeholder}
            placeholder={CHALLENGES[round.challenge].placeholder}
            className="h-14 w-full rounded-2xl border border-white/12 bg-ink-950/70 px-4 text-[18px] text-white placeholder:text-white/30 shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)] transition focus:border-glow/60 focus:bg-ink-950/90 focus:shadow-[0_0_0_3px_rgba(95,227,255,0.15)] focus:outline-none"
            maxLength={60}
            tabIndex={hidden ? -1 : 0}
          />
        </div>
        <button
          type="submit"
          aria-label="Submit answer"
          disabled={!guessing}
          tabIndex={hidden ? -1 : 0}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-[#7cecff] to-[#2fb8f0] text-ink-950 shadow-[0_8px_26px_-8px_rgba(95,227,255,0.8)] transition active:scale-95 disabled:opacity-35"
        >
          <ArrowUp size={24} strokeWidth={2.6} />
        </button>
      </form>

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={onHint}
          disabled={!guessing || hintsLeft === 0}
          tabIndex={hidden ? -1 : 0}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-gold/25 bg-gold/[0.07] font-display text-sm font-semibold text-gold transition active:scale-[0.98] disabled:opacity-35"
        >
          <Lightbulb size={17} />
          {hintsLeft === 0
            ? 'No hints left'
            : arcade
              ? `Hint ${round.hintsUsed + 1}/${MAX_HINTS} · max ${baseCapFor(round.hintsUsed + 1)}`
              : `Hint ${round.hintsUsed + 1}/${MAX_HINTS}`}
        </button>
        {!arcade && (
          <button
            type="button"
            onClick={onReveal}
            disabled={!guessing}
            tabIndex={hidden ? -1 : 0}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 font-display text-sm font-semibold text-haze transition active:scale-[0.98] disabled:opacity-35"
          >
            <Eye size={17} />
            Reveal
          </button>
        )}
      </div>
    </div>
  )
})
