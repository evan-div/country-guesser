import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Challenge, Session } from '../game/types'
import { freshSave, type SaveData, type Settings } from '../persistence/schema'
import { loadSave, writeSave } from '../persistence/storage'
import { recordGame, recordRound, type ProgressEvent } from './progress'
import type { RoundOutcome } from './records'

interface ProgressApi {
  save: SaveData
  recordRound: (o: RoundOutcome) => ProgressEvent[]
  recordGame: (session: Session) => { newHighScore: boolean; previousHigh: number }
  updateSettings: (patch: Partial<Settings>) => void
  markUnlockAnnounced: (c: Challenge) => void
  resetProgress: () => void
}

const Ctx = createContext<ProgressApi | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [save, setSave] = useState<SaveData>(() => loadSave())
  const ref = useRef(save)
  const timer = useRef<number | undefined>(undefined)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    writeSave(ref.current)
  }, [])

  const commit = useCallback((next: SaveData) => {
    ref.current = next
    setSave(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => writeSave(ref.current), 250)
  }, [])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  const api = useMemo<ProgressApi>(
    () => ({
      save,
      recordRound: (o) => {
        const r = recordRound(ref.current, o)
        commit(r.save)
        return r.events
      },
      recordGame: (session) => {
        const previousHigh = ref.current.stats.highScores[session.challenge]
        const r = recordGame(ref.current, session, Date.now())
        commit(r.save)
        return { newHighScore: r.newHighScore, previousHigh }
      },
      updateSettings: (patch) => commit({ ...ref.current, settings: { ...ref.current.settings, ...patch } }),
      markUnlockAnnounced: (c) =>
        ref.current.announcedUnlocks.includes(c)
          ? undefined
          : commit({ ...ref.current, announcedUnlocks: [...ref.current.announcedUnlocks, c] }),
      resetProgress: () => {
        commit(freshSave(ref.current.settings))
        flush()
      },
    }),
    [save, commit, flush],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useProgress(): ProgressApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useProgress must be used inside ProgressProvider')
  return v
}
