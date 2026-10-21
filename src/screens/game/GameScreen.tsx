import { Home, LogOut, Settings as SettingsIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { GameApi } from '../../game/useGame'
import { GameHud } from './GameHud'
import { GuessPanel } from './GuessPanel'
import { FeedbackCard } from './FeedbackCard'
import { Sheet } from '../../ui/components/Sheet'
import { Button } from '../../ui/components/Button'
import { useElementHeight } from '../../ui/hooks/useElementHeight'

interface Props {
  game: GameApi
  animations: boolean
  keyboardOpen: boolean
  onInsets: (top: number, bottom: number) => void
  onOpenSettings: () => void
}

const finePointer = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches

export function GameScreen({ game, animations, keyboardOpen, onInsets, onOpenSettings }: Props) {
  const { state, session, round, milestone } = game
  const hudRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hudH = useElementHeight(hudRef)
  const panelH = useElementHeight(panelRef)
  const [menuOpen, setMenuOpen] = useState(false)
  const [flash, setFlash] = useState<{ id: number; points: number } | null>(null)

  useLayoutEffect(() => {
    onInsets(hudH, panelH)
  }, [hudH, panelH, onInsets])

  const phase = state.phase
  const reveal = phase === 'ANSWER_REVEAL' && !!round?.result

  // Close the keyboard when the answer is graded so the feedback card and globe are visible.
  useEffect(() => {
    if (reveal) inputRef.current?.blur()
    if (reveal && round?.result && round.result.points > 0) setFlash({ id: round.id, points: round.result.points })
  }, [reveal, round?.id, round?.result])

  // Desktop: focus the answer box on arrival. Touch devices: let the player watch the
  // flight and tap the field when ready (the keyboard would cover half the globe).
  useEffect(() => {
    if (phase === 'GUESSING' && finePointer()) inputRef.current?.focus({ preventScroll: true })
  }, [phase, round?.id])

  // Enter/Space on the feedback card advances (desktop convenience).
  useEffect(() => {
    if (!reveal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.target instanceof HTMLInputElement || menuOpen) return
      if (e.target instanceof HTMLButtonElement) return // the focused button handles it
      e.preventDefault()
      if (session?.over) game.finish()
      else game.next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reveal, session?.over, game, menuOpen])

  if (!session || !round) return null

  const onNext = () => {
    game.next()
    // Keep the keyboard flow on desktop; on touch the player taps the field when ready.
    if (finePointer()) inputRef.current?.focus({ preventScroll: true })
  }

  const endLabel = session.style === 'arcade' ? 'End run' : 'End session'

  return (
    <>
      <GameHud ref={hudRef} session={session} animations={animations} onMenu={() => setMenuOpen(true)} pointsFlash={flash} />

      {milestone && animations && (
        <div
          key={milestone.id}
          className="pointer-events-none absolute inset-x-0 z-30 flex justify-center"
          style={{ top: hudH + 18 }}
        >
          <div
            className={`animate-banner rounded-full border px-5 py-2 font-display text-sm font-bold tracking-[0.22em] uppercase ${
              milestone.tone === 'gold'
                ? 'text-gold-glow border-gold/50 bg-gradient-to-r from-ember/25 via-gold/25 to-ember/25 text-gold'
                : 'text-glow border-glow/50 bg-glow/15 text-glow'
            }`}
          >
            {milestone.text}
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-20">
        <div
          ref={panelRef}
          className={`glass-strong mx-auto max-w-xl rounded-t-[26px] px-safe pt-4 sm:mb-4 sm:rounded-[26px] ${keyboardOpen ? 'pb-3' : 'pb-safe'}`}
        >
          {/* The guess panel stays mounted (and focusable) during the reveal, just collapsed. */}
          <div className={reveal ? 'h-0 overflow-hidden' : ''}>
            <GuessPanel
              phase={phase}
              round={round}
              session={session}
              notice={state.notice}
              hidden={reveal}
              inputRef={inputRef}
              onSubmit={game.submit}
              onHint={game.hint}
              onReveal={game.reveal}
              onDismissNotice={game.dismissNotice}
            />
          </div>
          {reveal && <FeedbackCard round={round} session={session} onNext={onNext} onFinish={game.finish} />}
        </div>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Paused" labelledBy="pause-title">
        <div className="space-y-2.5">
          <Button block size="lg" variant="primary" onClick={() => setMenuOpen(false)}>
            Resume
          </Button>
          <Button
            block
            icon={<SettingsIcon size={18} />}
            onClick={() => {
              setMenuOpen(false)
              onOpenSettings()
            }}
          >
            Settings
          </Button>
          <Button
            block
            icon={<LogOut size={18} />}
            onClick={() => {
              setMenuOpen(false)
              game.finish()
            }}
          >
            {endLabel} &amp; see results
          </Button>
          <Button
            block
            variant="ghost"
            icon={<Home size={18} />}
            onClick={() => {
              setMenuOpen(false)
              game.quit()
            }}
          >
            Quit to home
          </Button>
        </div>
      </Sheet>
    </>
  )
}
