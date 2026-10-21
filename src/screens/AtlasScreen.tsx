import { ArrowLeft, Crown, Search, Sparkles } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { COUNTRIES, getCountry } from '../data/countries'
import type { GlobeController } from '../globe/controller'
import type { GlobeLabel } from '../globe/GlobeStage'
import { useProgress } from '../progress/ProgressContext'
import { atlasSummary } from '../progress/progress'
import { MASTERY_CORRECT, MASTERY_UNASSISTED, type Mastery } from '../progress/records'
import { displayCapitals } from '../game/validation/capitals'
import { IconButton } from '../ui/components/Button'
import { ProgressRing } from '../ui/components/ProgressRing'
import { useElementHeight } from '../ui/hooks/useElementHeight'

type Filter = 'all' | 'mastered' | 'learning' | 'review' | 'unknown'

const MASTERY_STYLE: Record<Mastery, { label: string; cls: string }> = {
  mastered: { label: 'Mastered', cls: 'bg-gold/15 text-gold ring-1 ring-gold/35' },
  learning: { label: 'Learning', cls: 'bg-glow/12 text-glow ring-1 ring-glow/30' },
  unknown: { label: 'Unknown', cls: 'bg-white/[0.06] text-haze' },
}

interface Props {
  engine: GlobeController | null
  animations: boolean
  onBack: () => void
  onInsets: (top: number, bottom: number) => void
  onLabels: (labels: GlobeLabel[]) => void
}

function timeAgo(ts: number): string {
  if (!ts) return 'Never'
  const s = (Date.now() - ts) / 1000
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'Yesterday' : d < 30 ? `${d} days ago` : new Date(ts).toLocaleDateString()
}

export function AtlasScreen({ engine, animations, onBack, onInsets, onLabels }: Props) {
  const { save } = useProgress()
  const summary = useMemo(() => atlasSummary(save), [save])
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const topH = useElementHeight(topRef)
  const panelH = useElementHeight(panelRef)
  useLayoutEffect(() => onInsets(topH, panelH), [topH, panelH, onInsets])

  // Paint discoveries onto the globe while the Atlas is open.
  useEffect(() => {
    if (!engine) return
    const learning: string[] = []
    const mastered: string[] = []
    for (const [code, m] of summary.mastery) {
      if (m === 'mastered') mastered.push(code)
      else if (m === 'learning') learning.push(code)
    }
    engine.setAtlasPaint({ learning, mastered })
    return () => engine.setAtlasPaint(null)
  }, [engine, summary])

  useEffect(() => {
    if (!engine) return
    engine.setAutoRotate(false)
    engine.setInteractive(true)
    if (selected) {
      engine.showTarget(selected)
      engine.setTargetStyle('reveal')
      void engine.flyToCountry(selected, { instant: !animations })
      const c = getCountry(selected)
      onLabels([{ id: `atlas-${selected}`, ...c.label, text: c.name, tone: 'info' }])
    } else {
      engine.showTarget(null)
      onLabels([])
      void engine.flyToOverview({ instant: !animations })
    }
  }, [engine, selected, animations, onLabels])

  useEffect(
    () => () => {
      engine?.showTarget(null)
      engine?.setFocus(null)
      onLabels([])
    },
    [engine, onLabels],
  )

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return COUNTRIES.filter((c) => {
      const m = summary.mastery.get(c.code)!
      if (filter === 'review' && !save.echo[c.code]) return false
      if (filter !== 'all' && filter !== 'review' && m !== filter) return false
      if (q && !c.name.toLowerCase().includes(q) && !c.official.toLowerCase().includes(q)) return false
      return true
    })
  }, [filter, query, summary, save.echo])

  const filters: { id: Filter; label: string; n: number }[] = [
    { id: 'all', label: 'All', n: 195 },
    { id: 'mastered', label: 'Mastered', n: summary.mastered },
    { id: 'learning', label: 'Learning', n: summary.learning },
    { id: 'review', label: 'Review', n: summary.needsReview },
    { id: 'unknown', label: 'Unknown', n: summary.unknown },
  ]

  return (
    <>
      <div
        ref={topRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-ink-950/90 via-ink-950/60 to-transparent pt-safe px-safe pb-4"
      >
        <div className="mx-auto flex max-w-xl items-center gap-3 pt-1">
          <IconButton label="Back" className="pointer-events-auto" onClick={selected ? () => setSelected(null) : onBack}>
            <ArrowLeft size={20} />
          </IconButton>
          <div>
            <h1 className="font-display text-lg font-bold tracking-[0.16em] text-white uppercase">World Atlas</h1>
            <p className="text-xs text-haze">Your personal map of the world</p>
          </div>
        </div>
      </div>

      <div ref={panelRef} className="absolute inset-x-0 bottom-0 z-10 h-[64%]">
        <div className="glass-strong mx-auto flex h-full max-w-xl animate-sheet-in flex-col rounded-t-[28px] sm:rounded-b-none">
          {selected ? (
            <CountryDetail code={selected} onBack={() => setSelected(null)} />
          ) : (
            <div className="no-scrollbar flex-1 overflow-y-auto px-safe pt-5 pb-safe">
              <div className="flex items-center gap-4">
                <ProgressRing
                  size={128}
                  stroke={11}
                  total={195}
                  segments={[
                    { value: summary.mastered, color: '#ffc857' },
                    { value: summary.learning, color: '#5fe3ff' },
                  ]}
                >
                  <div className="font-display text-3xl leading-none font-bold text-white tabular-nums">{summary.discovered}</div>
                  <div className="text-[11px] text-haze">of 195</div>
                </ProgressRing>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-3xl font-bold text-white tabular-nums">
                    {summary.percent}
                    <span className="text-lg text-haze">%</span>
                  </div>
                  <div className="text-xs text-haze">of the world discovered</div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-[12px]">
                    <Tile label="Mastered" n={summary.mastered} cls="text-gold" />
                    <Tile label="Learning" n={summary.learning} cls="text-glow" />
                    <Tile label="Unknown" n={summary.unknown} cls="text-haze" />
                    <Tile label="Review" n={summary.needsReview} cls="text-coral" />
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {summary.byContinent.map((c) => (
                  <div key={c.continent}>
                    <div className="mb-1 flex justify-between text-[12px]">
                      <span className="text-mist">{c.continent}</span>
                      <span className="text-haze tabular-nums">
                        {c.discovered}/{c.total}
                      </span>
                    </div>
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-glow/80 transition-[width] duration-700"
                        style={{ width: `${(c.discovered / c.total) * 100}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gold transition-[width] duration-700"
                        style={{ width: `${(c.mastered / c.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="sticky top-0 z-10 -mx-1 mt-5 bg-gradient-to-b from-[#0a1427] via-[#0a1427]/95 to-transparent px-1 pt-1 pb-3">
                <div className="relative">
                  <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-haze" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search countries"
                    aria-label="Search countries"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-11 w-full rounded-xl border border-white/10 bg-ink-950/60 pr-3 pl-9 text-[16px] text-white placeholder:text-white/30 focus:border-glow/50 focus:outline-none"
                  />
                </div>
                <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
                  {filters.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`h-8 shrink-0 rounded-lg px-3 text-[12px] font-semibold transition ${
                        filter === f.id ? 'bg-glow/90 text-ink-950' : 'bg-white/[0.06] text-haze hover:text-white'
                      }`}
                    >
                      {f.label} <span className="opacity-70 tabular-nums">{f.n}</span>
                    </button>
                  ))}
                </div>
              </div>

              <ul className="space-y-1">
                {list.map((c) => {
                  const m = summary.mastery.get(c.code)!
                  const r = save.records[c.code]
                  return (
                    <li key={c.code}>
                      <button
                        onClick={() => setSelected(c.code)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.05] active:bg-white/[0.08]"
                      >
                        <span className={`text-2xl leading-none ${m === 'unknown' ? 'opacity-40 grayscale' : ''}`}>{c.flag}</span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[14px] ${m === 'unknown' ? 'text-haze' : 'text-white'}`}>{c.name}</span>
                          <span className="block text-[11px] text-haze">
                            {c.continent}
                            {r?.encounters ? ` · ✓${r.correct} ✗${r.incorrect}` : ''}
                          </span>
                        </span>
                        {save.echo[c.code] && <span className="h-2 w-2 rounded-full bg-coral" title="Needs review" />}
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${MASTERY_STYLE[m].cls}`}>
                          {m === 'mastered' && <Crown size={10} className="-mt-px mr-0.5 inline" />}
                          {MASTERY_STYLE[m].label}
                        </span>
                      </button>
                    </li>
                  )
                })}
                {!list.length && <li className="py-8 text-center text-sm text-haze">No countries match.</li>}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Tile({ label, n, cls }: { label: string; n: number; cls: string }) {
  return (
    <div className="rounded-lg bg-white/[0.045] px-2 py-1.5">
      <span className={`font-display text-base font-bold tabular-nums ${cls}`}>{n}</span>{' '}
      <span className="text-haze">{label}</span>
    </div>
  )
}

function CountryDetail({ code, onBack }: { code: string; onBack: () => void }) {
  const { save } = useProgress()
  const c = getCountry(code)
  const r = save.records[code]
  const summary = atlasSummary(save)
  const m = summary.mastery.get(code)!
  const echo = save.echo[code]
  return (
    <div className="no-scrollbar flex-1 animate-rise-in overflow-y-auto px-safe pt-4 pb-safe">
      <button onClick={onBack} className="mb-3 flex items-center gap-1.5 text-sm text-haze hover:text-white">
        <ArrowLeft size={16} /> All countries
      </button>
      <div className="flex items-center gap-3">
        <span className="text-5xl leading-none">{c.flag}</span>
        <div className="min-w-0">
          <div className="font-display text-2xl leading-tight font-bold text-white">{c.name}</div>
          <div className="truncate text-xs text-haze">{c.official}</div>
        </div>
        <span className={`ml-auto shrink-0 rounded-md px-2 py-1 text-[11px] font-bold tracking-wide uppercase ${MASTERY_STYLE[m].cls}`}>
          {MASTERY_STYLE[m].label}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-white/[0.035] p-3.5 text-[13px]">
        <dt className="text-haze">Continent</dt>
        <dd className="text-mist">
          {c.continent} · {c.subregion}
        </dd>
        <dt className="text-haze">Capital</dt>
        <dd className="text-mist">{displayCapitals(code).join(' · ')}</dd>
        <dt className="text-haze">Neighbors</dt>
        <dd className="text-mist">
          {c.neighbors.length ? c.neighbors.map((n) => getCountry(n).name).join(', ') : 'None — island nation'}
        </dd>
        {c.languages.length > 0 && (
          <>
            <dt className="text-haze">Languages</dt>
            <dd className="text-mist">{c.languages.join(', ')}</dd>
          </>
        )}
        {c.currencies.length > 0 && (
          <>
            <dt className="text-haze">Currency</dt>
            <dd className="text-mist">{c.currencies.join(', ')}</dd>
          </>
        )}
        <dt className="text-haze">Area</dt>
        <dd className="text-mist tabular-nums">{Math.round(c.area).toLocaleString()} km²</dd>
        <dt className="text-haze">ISO code</dt>
        <dd className="text-mist">
          {c.code} · {c.iso2}
        </dd>
      </dl>

      <h3 className="mt-5 mb-2 text-xs font-semibold tracking-[0.2em] text-haze uppercase">Learning record</h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Rec label="Encountered" v={r?.encounters ?? 0} />
        <Rec label="Correct" v={r?.correct ?? 0} cls="text-mint" />
        <Rec label="Incorrect" v={r?.incorrect ?? 0} cls="text-coral" />
        <Rec label="Unassisted" v={r?.unassistedCorrect ?? 0} cls="text-glow" />
        <Rec label="Hints used" v={r?.hintsUsed ?? 0} cls="text-gold" />
        <div className="rounded-xl bg-white/[0.045] p-2">
          <div className="text-[12px] font-semibold text-white">{timeAgo(r?.lastSeen ?? 0)}</div>
          <div className="text-[10px] text-haze">Last seen</div>
        </div>
      </div>

      {m !== 'mastered' && (
        <div className="mt-3 rounded-xl border border-gold/20 bg-gold/[0.05] p-3 text-[12px] text-mist">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-gold">
            <Sparkles size={13} /> Road to mastery
          </div>
          {Math.min(r?.correct ?? 0, MASTERY_CORRECT)}/{MASTERY_CORRECT} correct rounds ·{' '}
          {Math.min(r?.unassistedCorrect ?? 0, MASTERY_UNASSISTED)}/{MASTERY_UNASSISTED} without hints
        </div>
      )}
      {echo && (
        <p className="mt-2 text-[12px] text-coral">
          In Echo Rounds · missed {echo.misses}× · {echo.hits}/{echo.attempts} in review
        </p>
      )}
      {(r?.capital || r?.neighbors) && (
        <p className="mt-2 text-[12px] text-haze">
          {r.capital && `Capital rounds: ${r.capital.correct}/${r.capital.attempts}. `}
          {r.neighbors && `Neighbor rounds: ${r.neighbors.correct}/${r.neighbors.attempts}.`}
        </p>
      )}
    </div>
  )
}

function Rec({ label, v, cls = 'text-white' }: { label: string; v: number; cls?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.045] p-2">
      <div className={`font-display text-xl font-bold tabular-nums ${cls}`}>{v}</div>
      <div className="text-[10px] text-haze">{label}</div>
    </div>
  )
}
