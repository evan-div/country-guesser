import { BookOpen, Flag, Globe2, GraduationCap, Lock, RotateCcw, Settings, Trophy, Zap } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { CHALLENGES } from '../game/challenges'
import type { Challenge, PlayStyle } from '../game/types'
import { useProgress } from '../progress/ProgressContext'
import { uniqueIdentified } from '../progress/progress'
import { IconButton } from '../ui/components/Button'
import { useElementHeight } from '../ui/hooks/useElementHeight'

interface Props {
  challenge: Challenge
  onChallenge: (c: Challenge) => void
  onPlay: (style: PlayStyle) => void
  onAtlas: () => void
  onEcho: () => void
  onSettings: () => void
  onLocked: (c: Challenge, have: number) => void
  onInsets: (top: number, bottom: number) => void
}

export function HomeScreen({ challenge, onChallenge, onPlay, onAtlas, onEcho, onSettings, onLocked, onInsets }: Props) {
  const { save } = useProgress()
  const topRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const topH = useElementHeight(topRef)
  const bottomH = useElementHeight(bottomRef)
  useLayoutEffect(() => onInsets(topH, bottomH), [topH, bottomH, onInsets])

  const unique = uniqueIdentified(save)
  const echoCount = Object.keys(save.echo).length
  const high = save.stats.highScores[challenge]
  const pct = Math.round((unique / 195) * 100)

  return (
    <>
      <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-0 z-10 pt-safe px-safe">
        <div className="mx-auto flex max-w-xl items-center justify-between pt-1">
          <button
            onClick={onAtlas}
            className="glass pointer-events-auto flex h-11 items-center gap-2 rounded-2xl px-3.5 text-sm text-mist active:scale-95"
          >
            <Globe2 size={17} className="text-glow" />
            <span className="font-display font-semibold tabular-nums text-white">{unique}</span>
            <span className="text-haze">/ 195</span>
          </button>
          <IconButton label="Settings" className="pointer-events-auto" onClick={onSettings}>
            <Settings size={20} />
          </IconButton>
        </div>
        <div className="mx-auto mt-3 max-w-xl animate-fade-in text-center">
          <h1 className="font-display text-[44px] leading-[0.95] font-bold tracking-[0.12em] text-white sm:text-6xl">
            ATLAS
            <span className="text-glow block bg-gradient-to-r from-[#9ff4ff] via-glow to-glow-soft bg-clip-text text-transparent">
              RUSH
            </span>
          </h1>
          <p className="mt-2 text-[11px] tracking-[0.28em] text-haze uppercase">Fly the world · Name every nation</p>
        </div>
      </div>

      <div ref={bottomRef} className="absolute inset-x-0 bottom-0 z-10">
        <div className="glass-strong mx-auto max-w-xl animate-sheet-in rounded-t-[28px] px-safe pt-4 pb-safe sm:mb-4 sm:rounded-[28px]">
          <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1" role="tablist" aria-label="Game mode">
            {(Object.keys(CHALLENGES) as Challenge[]).map((id) => {
              const info = CHALLENGES[id]
              const locked = unique < info.unlockAt
              const active = id === challenge
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => (locked ? onLocked(id, unique) : onChallenge(id))}
                  className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 font-display text-[13px] font-semibold transition ${
                    active
                      ? 'bg-glow/15 text-glow ring-1 ring-glow/50'
                      : locked
                        ? 'bg-white/[0.03] text-white/35'
                        : 'bg-white/[0.05] text-mist hover:bg-white/[0.09]'
                  }`}
                >
                  {locked && <Lock size={13} />}
                  {info.title}
                  {locked && (
                    <span className="text-[11px] font-medium tabular-nums">
                      {unique}/{info.unlockAt}
                    </span>
                  )}
                </button>
              )
            })}
            <span className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.03] px-3.5 font-display text-[13px] font-semibold text-white/35">
              <Flag size={13} />
              Flags
              <span className="rounded bg-white/10 px-1 text-[9px] tracking-wider uppercase">Soon</span>
            </span>
          </div>

          <p className="mb-3 text-[13px] text-haze">{CHALLENGES[challenge].tagline}.</p>

          <button
            onClick={() => onPlay('arcade')}
            className="group relative mb-2.5 flex h-[72px] w-full items-center gap-4 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#86efff] via-[#3cc8f5] to-[#1f8fd6] px-5 text-left text-ink-950 shadow-[0_14px_40px_-12px_rgba(95,227,255,0.75),inset_0_1px_0_rgba(255,255,255,0.6)] transition active:scale-[0.98]"
          >
            <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.35)_50%,transparent_70%)] bg-[length:200%_100%] opacity-60" />
            <Zap size={28} className="relative fill-ink-950/20" strokeWidth={2.2} />
            <span className="relative flex-1">
              <span className="block font-display text-xl leading-tight font-bold tracking-[0.12em]">ARCADE</span>
              <span className="block text-[12px] font-medium opacity-75">5 lives · streak multipliers</span>
            </span>
            {high > 0 && (
              <span className="relative flex items-center gap-1 rounded-xl bg-ink-950/15 px-2.5 py-1 font-display text-sm font-bold tabular-nums">
                <Trophy size={14} />
                {high.toLocaleString()}
              </span>
            )}
          </button>

          <button
            onClick={() => onPlay('practice')}
            className="mb-3 flex h-14 w-full items-center gap-4 rounded-[18px] border border-white/10 bg-white/[0.05] px-5 text-left transition hover:bg-white/[0.08] active:scale-[0.98]"
          >
            <GraduationCap size={22} className="text-glow" />
            <span className="flex-1">
              <span className="block font-display text-[15px] font-bold tracking-[0.12em] text-white">PRACTICE</span>
              <span className="block text-[12px] text-haze">No lives · unlimited hints · reveal answers</span>
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={onEcho}
              className="relative flex flex-col items-start gap-1 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5 text-left transition hover:bg-white/[0.07] active:scale-[0.98]"
            >
              <RotateCcw size={19} className="text-coral" />
              <span className="font-display text-sm font-semibold text-white">Echo Rounds</span>
              <span className="text-[12px] text-haze">
                {echoCount ? `${echoCount} to review` : 'Mistakes appear here'}
              </span>
              {echoCount > 0 && (
                <span className="absolute top-3 right-3 rounded-full bg-coral px-2 py-0.5 text-[11px] font-bold text-ink-950 tabular-nums">
                  {echoCount}
                </span>
              )}
            </button>
            <button
              onClick={onAtlas}
              className="flex flex-col items-start gap-1 rounded-[18px] border border-white/10 bg-white/[0.04] p-3.5 text-left transition hover:bg-white/[0.07] active:scale-[0.98]"
            >
              <BookOpen size={19} className="text-gold" />
              <span className="font-display text-sm font-semibold text-white">World Atlas</span>
              <span className="w-full">
                <span className="block text-[12px] text-haze tabular-nums">{pct}% discovered</span>
                <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-gradient-to-r from-glow to-gold" style={{ width: `${pct}%` }} />
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
