import { describe, expect, it } from 'vitest'
import { gameReducer, initialGameState, type GameAction } from './reducer'
import type { GameState } from './types'

const run = (actions: GameAction[], from: GameState = initialGameState) => actions.reduce(gameReducer, from)

const start = (style: 'arcade' | 'practice' = 'arcade', code = 'FRA') =>
  run([{ type: 'START', style, challenge: 'country', code, seed: 1 }])

const arrive = (s: GameState) => gameReducer(s, { type: 'ARRIVED', roundId: s.round!.id })
const submit = (s: GameState, input: string) => gameReducer(s, { type: 'SUBMIT', roundId: s.round!.id, input })
const next = (s: GameState, code: string) => gameReducer(s, { type: 'NEXT', code, seed: 2 })

describe('game reducer', () => {
  it('starts in CAMERA_TRANSITION and ignores submissions until arrival', () => {
    const s = start()
    expect(s.phase).toBe('CAMERA_TRANSITION')
    expect(submit(s, 'France')).toBe(s)
    expect(arrive(s).phase).toBe('GUESSING')
  })

  it('scores a correct answer and moves to ANSWER_REVEAL', () => {
    const s = submit(arrive(start()), 'france')
    expect(s.phase).toBe('ANSWER_REVEAL')
    expect(s.round!.result).toMatchObject({ outcome: 'correct', points: 100, streakAfter: 1 })
    expect(s.session!.score).toBe(100)
    expect(s.session!.identified).toEqual(['FRA'])
  })

  it('prevents double submission', () => {
    const s1 = submit(arrive(start()), 'France')
    const s2 = submit(s1, 'France')
    expect(s2).toBe(s1)
    expect(s2.session!.score).toBe(100)
  })

  it('ignores stale arrivals from an earlier round', () => {
    const s = arrive(start())
    const staleId = s.round!.id
    const s2 = next(submit(s, 'France'), 'DEU')
    expect(gameReducer(s2, { type: 'ARRIVED', roundId: staleId })).toBe(s2)
  })

  it('unknown or ambiguous answers do not cost a life', () => {
    const s = arrive(start('arcade', 'COG'))
    const s1 = submit(s, 'Congo')
    expect(s1.phase).toBe('GUESSING')
    expect(s1.notice?.kind).toBe('ambiguous')
    const s2 = submit(s1, 'Qwertyland')
    expect(s2.phase).toBe('GUESSING')
    expect(s2.notice?.kind).toBe('unknown')
    expect(s2.session!.lives).toBe(5)
  })

  it('hints reduce points but not streaks', () => {
    let s = arrive(start())
    s = gameReducer(s, { type: 'HINT', roundId: s.round!.id })
    s = gameReducer(s, { type: 'HINT', roundId: s.round!.id })
    s = submit(s, 'France')
    expect(s.round!.result!.points).toBe(45)
    expect(s.session!.streak).toBe(1)
  })

  it('caps hints at four', () => {
    let s = arrive(start())
    for (let i = 0; i < 7; i++) s = gameReducer(s, { type: 'HINT', roundId: s.round!.id })
    expect(s.round!.hintsUsed).toBe(4)
  })

  it('applies the streak multiplier and resets it on a miss', () => {
    const codes = ['DEU', 'ITA', 'ESP', 'PRT']
    let s = submit(arrive(start()), 'France')
    for (const c of codes) {
      s = next(s, c)
      s = arrive(s)
      s = submit(s, { DEU: 'Germany', ITA: 'Italy', ESP: 'Spain', PRT: 'Portugal' }[c]!)
    }
    // streaks 1,2 → 100 each; 3,4,5 → 200 each
    expect(s.session!.score).toBe(800)
    expect(s.session!.bestMultiplier).toBe(2)
    s = submit(arrive(next(s, 'POL')), 'Germany')
    expect(s.session!.streak).toBe(0)
    expect(s.session!.lives).toBe(4)
    expect(s.round!.result!.outcome).toBe('wrong')
  })

  it('arcade ends after five misses and blocks NEXT', () => {
    let s = arrive(start('arcade', 'FRA'))
    for (let i = 0; i < 5; i++) {
      s = submit(s, 'Brazil')
      if (i < 4) s = arrive(next(s, 'FRA'))
    }
    expect(s.session!.lives).toBe(0)
    expect(s.session!.over).toBe(true)
    expect(next(s, 'DEU')).toBe(s)
    expect(s.session!.missed).toEqual(['FRA'])
    s = gameReducer(s, { type: 'FINISH' })
    expect(s.phase).toBe('GAME_OVER')
  })

  it('practice has unlimited lives and allows revealing the answer', () => {
    let s = arrive(start('practice'))
    for (let i = 0; i < 8; i++) {
      s = submit(s, 'Brazil')
      s = arrive(next(s, 'FRA'))
    }
    expect(s.session!.lives).toBeNull()
    expect(s.phase).toBe('GUESSING')
    s = gameReducer(s, { type: 'REVEAL', roundId: s.round!.id })
    expect(s.round!.result!.outcome).toBe('revealed')
    expect(s.session!.incorrect).toBe(9)
  })

  it('arcade cannot reveal', () => {
    const s = arrive(start())
    expect(gameReducer(s, { type: 'REVEAL', roundId: s.round!.id })).toBe(s)
  })

  it('neighbors challenge accepts any bordering country', () => {
    let s = run([{ type: 'START', style: 'arcade', challenge: 'neighbors', code: 'FRA', seed: 1 }])
    s = submit(arrive(s), 'Andorra')
    expect(s.round!.result!.outcome).toBe('correct')
    let t = run([{ type: 'START', style: 'arcade', challenge: 'neighbors', code: 'FRA', seed: 1 }])
    t = submit(arrive(t), 'France')
    expect(t.notice?.kind).toBe('self')
    t = submit(t, 'Poland')
    expect(t.round!.result!.outcome).toBe('wrong')
  })

  it('capital challenge', () => {
    let s = run([{ type: 'START', style: 'arcade', challenge: 'capital', code: 'AUS', seed: 1 }])
    s = submit(arrive(s), 'Sydney')
    expect(s.round!.result!.outcome).toBe('wrong')
    let t = run([{ type: 'START', style: 'arcade', challenge: 'capital', code: 'AUS', seed: 1 }])
    t = submit(arrive(t), 'canberra')
    expect(t.round!.result!.outcome).toBe('correct')
  })
})
