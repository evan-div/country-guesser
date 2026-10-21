import { describe, expect, it } from 'vitest'
import { ShuffleBag } from './selection'
import { mulberry32 } from './rng'
import { ALL_CODES } from '../data/countries'

describe('ShuffleBag', () => {
  it('shows every country exactly once per cycle', () => {
    const bag = new ShuffleBag(ALL_CODES, mulberry32(1))
    const seen = new Set<string>()
    for (let i = 0; i < ALL_CODES.length; i++) seen.add(bag.next())
    expect(seen.size).toBe(195)
  })

  it('never repeats within the recent window, even across refills', () => {
    const bag = new ShuffleBag(ALL_CODES, mulberry32(7), 12)
    const history: string[] = []
    for (let i = 0; i < 195 * 6; i++) {
      const c = bag.next()
      expect(history.slice(-12)).not.toContain(c)
      history.push(c)
    }
  })

  it('is uniform: first-draw frequency is flat across countries', () => {
    const counts = new Map<string, number>()
    const trials = 39000
    for (let s = 0; s < trials; s++) {
      const c = new ShuffleBag(ALL_CODES, mulberry32(s + 1000)).next()
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    const expected = trials / 195
    let chi = 0
    for (const code of ALL_CODES) chi += ((counts.get(code) ?? 0) - expected) ** 2 / expected
    // 194 degrees of freedom: p = 0.001 critical value ≈ 259
    expect(chi).toBeLessThan(259)
    expect(counts.size).toBe(195)
  })

  it('peek returns the next item without consuming it', () => {
    const bag = new ShuffleBag(['a', 'b', 'c', 'd'], mulberry32(3))
    const p = bag.peek()
    expect(bag.next()).toBe(p)
  })
})
