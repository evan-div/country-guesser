import { ArrowLeft, Crown, Play, RotateCcw } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getCountry } from '../data/countries'
import { useProgress } from '../progress/ProgressContext'
import { MASTERY_CORRECT, MASTERY_UNASSISTED } from '../progress/records'
import { Button, IconButton } from '../ui/components/Button'
import { useElementHeight } from '../ui/hooks/useElementHeight'

interface Props {
  onBack: () => void
  onStart: (codes: string[]) => void
  onInsets: (top: number, bottom: number) => void
}

export function EchoScreen({ onBack, onStart, onInsets }: Props) {
  const { save } = useProgress()
  const [showGraduated, setShowGraduated] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const topH = useElementHeight(topRef)
  const panelH = useElementHeight(panelRef)
  useLayoutEffect(() => onInsets(topH, panelH), [topH, panelH, onInsets])

  const entries = useMemo(
    () =>
      Object.entries(save.echo)
        .map(([code, e]) => ({ code, e, r: save.records[code] }))
        .sort((a, b) => b.e.misses - a.e.misses || b.e.lastMissAt - a.e.lastMissAt),
    [save],
  )
  const codes = entries.map((x) => x.code)

  return (
    <>
      <div
        ref={topRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-ink-950/90 via-ink-950/60 to-transparent pt-safe px-safe pb-4"
      >
        <div className="mx-auto flex max-w-xl items-center gap-3 pt-1">
          <IconButton label="Back" className="pointer-events-auto" onClick={onBack}>
            <ArrowLeft size={20} />
          </IconButton>
          <div>
            <h1 className="font-display text-lg font-bold tracking-[0.16em] text-white uppercase">Echo Rounds</h1>
            <p className="text-xs text-haze">Turn mistakes into long-term knowledge</p>
          </div>
        </div>
      </div>

      <div ref={panelRef} className="absolute inset-x-0 bottom-0 z-10 h-[64%]">
        <div className="glass-strong mx-auto flex h-full max-w-xl animate-sheet-in flex-col rounded-t-[28px]">
          <div className="no-scrollbar flex-1 overflow-y-auto px-safe pt-5 pb-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-coral/[0.08] p-3 ring-1 ring-coral/20">
                <div className="font-display text-3xl font-bold text-coral tabular-nums">{entries.length}</div>
                <div className="text-xs text-haze">still need work</div>
              </div>
              <div className="rounded-2xl bg-gold/[0.08] p-3 ring-1 ring-gold/20">
                <div className="font-display text-3xl font-bold text-gold tabular-nums">{save.graduated.length}</div>
                <div className="text-xs text-haze">graduated to mastered</div>
              </div>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-haze">
              Every country you miss lands here. Echo Rounds replay only these countries — with unlimited tries and free hints.
              A country graduates once it's mastered: {MASTERY_CORRECT} correct rounds, {MASTERY_UNASSISTED} of them without hints.
            </p>

            {entries.length === 0 ? (
              <div className="mt-8 text-center">
                <RotateCcw className="mx-auto text-white/20" size={40} />
                <p className="mt-3 text-sm text-mist">Nothing to review yet.</p>
                <p className="text-xs text-haze">Play Arcade or Practice — your misses will appear here.</p>
              </div>
            ) : (
              <ul className="mt-4 space-y-1.5">
                {entries.map(({ code, e, r }) => {
                  const c = getCountry(code)
                  const correct = Math.min(r?.correct ?? 0, MASTERY_CORRECT)
                  const unassisted = Math.min(r?.unassistedCorrect ?? 0, MASTERY_UNASSISTED)
                  const progress = (correct + unassisted) / (MASTERY_CORRECT + MASTERY_UNASSISTED)
                  return (
                    <li key={code} className="flex items-center gap-3 rounded-xl bg-white/[0.035] px-3 py-2.5">
                      <span className="text-2xl leading-none">{c.flag}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[14px] text-white">{c.name}</span>
                          <span className="shrink-0 text-[11px] text-haze tabular-nums">
                            missed {e.misses}×{e.attempts ? ` · ${e.hits}/${e.attempts} in review` : ''}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-coral via-gold to-mint"
                            style={{ width: `${Math.max(4, progress * 100)}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {save.graduated.length > 0 && (
              <div className="mt-5">
                <button
                  onClick={() => setShowGraduated((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.18em] text-gold uppercase"
                >
                  <Crown size={13} /> Graduated · {save.graduated.length}
                </button>
                {showGraduated && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {save.graduated.map((code) => (
                      <span key={code} className="rounded-lg bg-gold/10 px-2 py-0.5 text-[12px] text-gold">
                        {getCountry(code).flag} {getCountry(code).name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="px-safe pt-2 pb-safe">
            <Button
              variant="primary"
              size="lg"
              block
              disabled={!codes.length}
              onClick={() => onStart(codes)}
              icon={<Play size={19} className="fill-ink-950" />}
            >
              {codes.length ? `Start Echo Round · ${codes.length}` : 'No countries to review'}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
