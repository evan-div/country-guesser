import { describe, expect, it } from 'vitest'
import { freshSave } from '../persistence/schema'
import { applyRound, masteryOf } from './records'
import { atlasSummary, isUnlocked, recordGame, recordRound, uniqueIdentified } from './progress'
import { ALL_CODES } from '../data/countries'
import type { Session } from '../game/types'

const round = (code: string, outcome: 'correct' | 'wrong' | 'revealed', hintsUsed = 0, style: 'arcade' | 'echo' = 'arcade') => ({
  code,
  challenge: 'country' as const,
  style,
  outcome,
  hintsUsed,
  at: 1000,
})

describe('mastery', () => {
  it('unknown → learning → mastered (3 correct incl. 2 unassisted)', () => {
    let r = applyRound(undefined, round('FRA', 'wrong'))
    expect(masteryOf(r)).toBe('unknown')
    r = applyRound(r, round('FRA', 'correct', 2))
    expect(masteryOf(r)).toBe('learning')
    r = applyRound(r, round('FRA', 'correct', 1))
    expect(masteryOf(r)).toBe('learning') // 2 correct, 0 unassisted
    r = applyRound(r, round('FRA', 'correct', 0))
    expect(masteryOf(r)).toBe('learning') // 3 correct, 1 unassisted
    r = applyRound(r, round('FRA', 'correct', 0))
    expect(masteryOf(r)).toBe('mastered')
    expect(r).toMatchObject({ encounters: 5, correct: 4, incorrect: 1, unassistedCorrect: 2, hintsUsed: 3 })
  })

  it('capital/neighbor rounds keep separate stats', () => {
    const r = applyRound(undefined, { ...round('FRA', 'correct'), challenge: 'capital' })
    expect(r.encounters).toBe(0)
    expect(r.capital).toEqual({ attempts: 1, correct: 1 })
  })
})

describe('recordRound', () => {
  it('adds misses to Echo Rounds and graduates them on mastery', () => {
    let save = freshSave()
    save = recordRound(save, round('JPN', 'wrong')).save
    expect(save.echo.JPN.misses).toBe(1)
    save = recordRound(save, round('JPN', 'correct', 0, 'echo')).save
    save = recordRound(save, round('JPN', 'correct', 0, 'echo')).save
    expect(save.echo.JPN).toMatchObject({ attempts: 2, hits: 2 })
    const { save: s3, events } = recordRound(save, round('JPN', 'correct', 1, 'echo'))
    expect(events.map((e) => e.type)).toEqual(['mastered', 'graduated'])
    expect(s3.echo.JPN).toBeUndefined()
    expect(s3.graduated).toEqual(['JPN'])
  })

  it('reports first discovery once', () => {
    const a = recordRound(freshSave(), round('PER', 'correct'))
    expect(a.events).toEqual([{ type: 'discovered', code: 'PER' }])
    expect(recordRound(a.save, round('PER', 'correct')).events).toEqual([])
  })

  it('unlocks are based on unique countries, not repeated answers', () => {
    let save = freshSave()
    for (let i = 0; i < 30; i++) save = recordRound(save, round('FRA', 'correct')).save
    expect(uniqueIdentified(save)).toBe(1)
    expect(isUnlocked(save, 'capital')).toBe(false)
    const events: string[] = []
    for (const code of ALL_CODES.slice(0, 60)) {
      const r = recordRound(save, round(code, 'correct'))
      save = r.save
      for (const e of r.events) if (e.type === 'unlocked') events.push(e.challenge)
    }
    expect(events).toEqual(['capital', 'neighbors'])
    expect(isUnlocked(save, 'neighbors')).toBe(true)
  })
})

describe('recordGame and atlas', () => {
  const session: Session = {
    style: 'arcade',
    challenge: 'country',
    lives: 0,
    maxLives: 5,
    score: 1200,
    streak: 0,
    bestStreak: 6,
    bestMultiplier: 2,
    correct: 8,
    incorrect: 5,
    hintsUsed: 2,
    rounds: 13,
    missed: ['FRA'],
    identified: [],
    over: true,
  }
  it('tracks personal bests and recent games', () => {
    const a = recordGame(freshSave(), session, 1)
    expect(a.newHighScore).toBe(true)
    expect(a.save.stats.highScores.country).toBe(1200)
    const b = recordGame(a.save, { ...session, score: 900 }, 2)
    expect(b.newHighScore).toBe(false)
    expect(b.save.stats.recentGames).toHaveLength(2)
    expect(b.save.stats.gamesPlayed).toBe(2)
  })
  it('summarises world progress by continent', () => {
    let save = freshSave()
    save = recordRound(save, round('PER', 'correct')).save
    save = recordRound(save, round('JPN', 'wrong')).save
    const s = atlasSummary(save)
    expect(s).toMatchObject({ total: 195, discovered: 1, learning: 1, mastered: 0, unknown: 194, needsReview: 1 })
    expect(s.byContinent.find((c) => c.continent === 'South America')!.discovered).toBe(1)
    expect(s.byContinent.reduce((n, c) => n + c.total, 0)).toBe(195)
  })
})
