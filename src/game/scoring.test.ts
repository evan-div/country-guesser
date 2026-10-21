import { describe, expect, it } from 'vitest'
import { baseCapFor, isStreakMilestone, multiplierFor, scoreCorrect } from './scoring'

describe('scoring', () => {
  it('multiplier follows the streak table and caps at 3x', () => {
    const table = [0, 1, 2, 3, 4, 5, 6, 7, 8, 20, 100].map(multiplierFor)
    expect(table).toEqual([1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3])
  })
  it('hint caps reduce the maximum base points', () => {
    expect([0, 1, 2, 3, 4, 9].map(baseCapFor)).toEqual([100, 70, 45, 25, 10, 10])
  })
  it('scores base × multiplier using the streak including this answer', () => {
    expect(scoreCorrect(0, 0)).toEqual({ streak: 1, multiplier: 1, base: 100, points: 100 })
    expect(scoreCorrect(2, 0)).toEqual({ streak: 3, multiplier: 2, base: 100, points: 200 })
    expect(scoreCorrect(6, 1)).toEqual({ streak: 7, multiplier: 3, base: 70, points: 210 })
    expect(scoreCorrect(10, 4)).toEqual({ streak: 11, multiplier: 3, base: 10, points: 30 })
  })
  it('practice ignores hint penalties', () => {
    expect(scoreCorrect(0, 4, false).base).toBe(100)
  })
  it('a full run is deterministic', () => {
    let streak = 0
    let total = 0
    for (let i = 0; i < 10; i++) {
      const a = scoreCorrect(streak, 0)
      streak = a.streak
      total += a.points
    }
    // 2×100 + 4×200 + 4×300
    expect(total).toBe(2200)
  })
  it('milestones', () => {
    expect([3, 7, 10, 15, 4, 11].map(isStreakMilestone)).toEqual([true, true, true, true, false, false])
  })
})
