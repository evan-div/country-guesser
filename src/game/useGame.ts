import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { GlobeController } from '../globe/controller'
import type { GlobeLabel } from '../globe/GlobeStage'
import { GLOBE_THEME } from '../globe/theme'
import { getCountry } from '../data/countries'
import { gameReducer, initialGameState } from './reducer'
import { poolFor } from './challenges'
import { ShuffleBag } from './selection'
import { mulberry32, randomSeed } from './rng'
import { isStreakMilestone } from './scoring'
import type { Challenge, GameState, PlayStyle } from './types'
import type { ProgressEvent } from '../progress/progress'
import { useProgress } from '../progress/ProgressContext'
import { sound } from '../feedback/sound'
import { haptics } from '../feedback/haptics'

export interface GameOverInfo {
  newHighScore: boolean
  previousHigh: number
}

export interface Milestone {
  id: number
  text: string
  tone: 'gold' | 'cyan'
}

interface Options {
  engine: GlobeController | null
  animations: boolean
  onProgressEvents: (events: ProgressEvent[]) => void
}

/**
 * Connects the pure game reducer to everything with side effects: country selection,
 * camera flights, globe highlights, progress recording, sound and haptics.
 */
export function useGame({ engine, animations, onProgressEvents }: Options) {
  const progress = useProgress()
  const [state, dispatch] = useReducer(gameReducer, initialGameState)
  const stateRef = useRef<GameState>(state)
  stateRef.current = state
  const bag = useRef<ShuffleBag<string> | null>(null)
  const rng = useRef(mulberry32(randomSeed()))
  const recordedRounds = useRef(new Set<number>())
  const recordedGame = useRef(false)
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null)
  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const eventsRef = useRef(onProgressEvents)
  eventsRef.current = onProgressEvents
  const animRef = useRef(animations)
  animRef.current = animations

  const seed = () => Math.floor(rng.current() * 2 ** 31)
  const { phase, round, session } = state

  const start = useCallback((style: PlayStyle, challenge: Challenge, pool?: string[]) => {
    const items = pool?.length ? pool : poolFor(challenge)
    bag.current = new ShuffleBag(items, rng.current, Math.min(12, Math.floor(items.length / 2)))
    recordedGame.current = false
    setGameOverInfo(null)
    setMilestone(null)
    sound.tap()
    dispatch({ type: 'START', style, challenge, code: bag.current.next(), seed: seed() })
  }, [])

  const next = useCallback(() => {
    const s = stateRef.current
    if (s.phase !== 'ANSWER_REVEAL' || !bag.current || s.session?.over) return
    sound.tap()
    dispatch({ type: 'NEXT', code: bag.current.next(), seed: seed() })
  }, [])

  const submit = useCallback((input: string) => {
    const s = stateRef.current
    if (s.phase !== 'GUESSING' || !s.round) return
    dispatch({ type: 'SUBMIT', roundId: s.round.id, input })
  }, [])

  const hint = useCallback(() => {
    const s = stateRef.current
    if (s.phase !== 'GUESSING' || !s.round || s.round.hintsUsed >= s.round.ladder.length) return
    sound.hint()
    haptics.tap()
    dispatch({ type: 'HINT', roundId: s.round.id })
  }, [])

  const reveal = useCallback(() => {
    const s = stateRef.current
    if (s.phase !== 'GUESSING' || !s.round) return
    dispatch({ type: 'REVEAL', roundId: s.round.id })
  }, [])

  const finish = useCallback(() => dispatch({ type: 'FINISH' }), [])
  const dismissNotice = useCallback(() => dispatch({ type: 'DISMISS_NOTICE' }), [])

  const quit = useCallback(() => {
    dispatch({ type: 'QUIT' })
    setGameOverInfo(null)
    engine?.clearHighlights()
    engine?.setFocus(null)
    void engine?.flyToOverview({ instant: !animRef.current })
  }, [engine])

  // --- Camera flight for each new round -----------------------------------------------
  const flightRoundId = phase === 'CAMERA_TRANSITION' ? round?.id : undefined
  useEffect(() => {
    if (!engine || flightRoundId === undefined) return
    const r = stateRef.current.round!
    let alive = true
    engine.setHints([])
    // Capital/Neighbors name the country up front, so it can stay highlighted in flight.
    engine.showTarget(r.challenge === 'country' ? null : r.code)
    engine.setTargetStyle('guess')
    engine.setInteractive(false)
    engine.setAutoRotate(false)
    void engine
      .flyToCountry(r.code, {
        instant: !animRef.current,
        onStart: (plan) => sound.whoosh(plan.durationMs),
      })
      .then((done) => {
        if (!alive || !done) return
        engine.showTarget(r.code)
        engine.lockOn(r.code)
        engine.setInteractive(true)
        dispatch({ type: 'ARRIVED', roundId: r.id })
      })
    return () => {
      alive = false
    }
  }, [engine, flightRoundId])

  // --- Globe swapped mid-round (WebGL context lost → 2D fallback): restore the view ------
  const syncedEngine = useRef(engine)
  useEffect(() => {
    if (!engine || syncedEngine.current === engine) return
    const hadEngine = syncedEngine.current !== null
    syncedEngine.current = engine
    const s = stateRef.current
    if (!hadEngine || !s.round || (s.phase !== 'GUESSING' && s.phase !== 'ANSWER_REVEAL')) return
    void engine.flyToCountry(s.round.code, { instant: true })
    engine.showTarget(s.round.code)
    if (s.round.result) engine.setTargetStyle(s.round.result.outcome === 'correct' ? 'correct' : 'wrong')
  }, [engine])

  // --- Hint / reveal highlights -------------------------------------------------------
  const highlightKey = useMemo(() => {
    if (!round) return ''
    if (phase === 'ANSWER_REVEAL' && round.result) {
      if (round.challenge === 'neighbors') return getCountry(round.code).neighbors.join(',')
      if (round.result.outcome === 'wrong' && round.result.guessCode && round.result.guessCode !== round.code)
        return round.result.guessCode
      return ''
    }
    if (phase !== 'GUESSING') return ''
    return round.ladder
      .slice(0, round.hintsUsed)
      .flatMap((h) => h.highlight ?? [])
      .join(',')
  }, [round, phase])

  useEffect(() => {
    engine?.setHints(highlightKey ? highlightKey.split(',') : [])
  }, [engine, highlightKey])

  // --- Round results: progress, effects -------------------------------------------------
  const resultRoundId = round?.result ? round.id : undefined
  useEffect(() => {
    if (resultRoundId === undefined || recordedRounds.current.has(resultRoundId)) return
    recordedRounds.current.add(resultRoundId)
    const s = stateRef.current
    const r = s.round!
    const res = r.result!
    const events = progress.recordRound({
      code: r.code,
      challenge: r.challenge,
      style: s.session!.style,
      outcome: res.outcome,
      hintsUsed: r.hintsUsed,
      at: Date.now(),
    })
    eventsRef.current(events)

    if (engine) {
      engine.showTarget(r.code)
      engine.setTargetStyle(res.outcome === 'correct' ? 'correct' : 'wrong')
      if (res.outcome === 'correct')
        engine.celebrate(r.code, res.multiplier >= 2 ? GLOBE_THEME.mastered : GLOBE_THEME.correct)
      const upcoming = bag.current?.peek()
      if (upcoming && !s.session!.over) engine.prepare(upcoming)
    }

    if (res.outcome === 'correct') {
      sound.correct(res.multiplier)
      haptics.correct()
      if (s.session!.style === 'arcade' && isStreakMilestone(res.streakAfter)) {
        const text =
          res.streakAfter === 3 ? '2× Multiplier' : res.streakAfter === 7 ? '3× Multiplier' : `${res.streakAfter} Streak`
        setMilestone({ id: r.id, text, tone: res.streakAfter === 3 ? 'cyan' : 'gold' })
        window.setTimeout(() => sound.milestone(), 260)
        haptics.milestone()
      }
    } else {
      sound.wrong()
      haptics.wrong()
    }
  }, [resultRoundId, engine, progress])

  // --- Game over ------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'GAME_OVER' || recordedGame.current) return
    recordedGame.current = true
    const s = stateRef.current.session!
    setGameOverInfo(progress.recordGame(s))
    if (s.style === 'arcade') sound.gameOver()
    engine?.clearHighlights()
    engine?.setFocus(null)
    void engine?.flyToOverview({ instant: !animRef.current })
  }, [phase, engine, progress])

  // --- Globe labels (never shown for the target while guessing a country) ---------------
  const labels = useMemo<GlobeLabel[]>(() => {
    if (!round) return []
    const c = getCountry(round.code)
    const at = (code: string) => getCountry(code).label
    const out: GlobeLabel[] = []
    if (phase === 'ANSWER_REVEAL' && round.result) {
      const tone = round.result.outcome === 'correct' ? 'correct' : 'wrong'
      out.push({ id: `t-${round.id}`, ...at(round.code), text: c.name, tone })
      if (round.challenge === 'neighbors')
        for (const n of c.neighbors) out.push({ id: `n-${round.id}-${n}`, ...at(n), text: getCountry(n).name, tone: 'hint' })
      else if (round.result.guessCode && round.result.guessCode !== round.code)
        out.push({
          id: `g-${round.id}`,
          ...at(round.result.guessCode),
          text: getCountry(round.result.guessCode).name,
          tone: 'hint',
        })
    } else if (round.challenge !== 'country' && (phase === 'GUESSING' || phase === 'CAMERA_TRANSITION')) {
      out.push({ id: `t-${round.id}`, ...at(round.code), text: c.name, tone: 'info' })
    }
    return out
  }, [round, phase])

  return {
    state,
    session,
    round,
    labels,
    gameOverInfo,
    milestone,
    start,
    next,
    submit,
    hint,
    reveal,
    finish,
    quit,
    dismissNotice,
  }
}

export type GameApi = ReturnType<typeof useGame>
