import { COUNTRIES } from '../data/countries'
import { CONTINENTS, type Continent } from '../data/types'
import { CHALLENGES } from '../game/challenges'
import type { Challenge, Session } from '../game/types'
import type { GameSummary, SaveData } from '../persistence/schema'
import { applyRound, masteryOf, type Mastery, type RoundOutcome } from './records'

export type ProgressEvent =
  | { type: 'discovered'; code: string }
  | { type: 'mastered'; code: string }
  | { type: 'graduated'; code: string }
  | { type: 'unlocked'; challenge: Challenge }

export function uniqueIdentified(save: SaveData): number {
  let n = 0
  for (const r of Object.values(save.records)) if (r.correct > 0) n++
  return n
}

export function isUnlocked(save: SaveData, challenge: Challenge): boolean {
  return uniqueIdentified(save) >= CHALLENGES[challenge].unlockAt
}

/** Applies a finished round to the save (pure). Returns the new save and notable events. */
export function recordRound(save: SaveData, o: RoundOutcome): { save: SaveData; events: ProgressEvent[] } {
  const events: ProgressEvent[] = []
  const before = save.records[o.code]
  const after = applyRound(before, o)
  const next: SaveData = { ...save, records: { ...save.records, [o.code]: after } }

  if (o.challenge === 'country') {
    const correct = o.outcome === 'correct'
    if (correct && (before?.correct ?? 0) === 0) events.push({ type: 'discovered', code: o.code })
    if (masteryOf(before) !== 'mastered' && masteryOf(after) === 'mastered') events.push({ type: 'mastered', code: o.code })

    const echo = { ...save.echo }
    const entry = echo[o.code]
    if (!correct) {
      echo[o.code] = entry
        ? {
            ...entry,
            misses: entry.misses + 1,
            lastMissAt: o.at,
            attempts: entry.attempts + (o.style === 'echo' ? 1 : 0),
          }
        : { addedAt: o.at, misses: 1, lastMissAt: o.at, attempts: o.style === 'echo' ? 1 : 0, hits: 0 }
    } else if (entry) {
      const updated = { ...entry, attempts: entry.attempts + (o.style === 'echo' ? 1 : 0), hits: entry.hits + 1 }
      if (masteryOf(after) === 'mastered') {
        delete echo[o.code]
        next.graduated = [...save.graduated.filter((c) => c !== o.code), o.code]
        events.push({ type: 'graduated', code: o.code })
      } else {
        echo[o.code] = updated
      }
    }
    next.echo = echo

    const prevCount = uniqueIdentified(save)
    const newCount = uniqueIdentified(next)
    for (const ch of Object.values(CHALLENGES)) {
      if (ch.unlockAt > 0 && prevCount < ch.unlockAt && newCount >= ch.unlockAt)
        events.push({ type: 'unlocked', challenge: ch.id })
    }
  }
  return { save: next, events }
}

export function recordGame(save: SaveData, session: Session, at: number): { save: SaveData; newHighScore: boolean } {
  if (session.rounds === 0) return { save, newHighScore: false }
  const summary: GameSummary = {
    at,
    style: session.style,
    challenge: session.challenge,
    score: session.score,
    correct: session.correct,
    incorrect: session.incorrect,
    bestStreak: session.bestStreak,
    bestMultiplier: session.bestMultiplier,
    missed: session.missed,
  }
  const arcade = session.style === 'arcade'
  const prevHigh = save.stats.highScores[session.challenge]
  const newHighScore = arcade && session.score > prevHigh
  return {
    newHighScore,
    save: {
      ...save,
      stats: {
        highScores: newHighScore ? { ...save.stats.highScores, [session.challenge]: session.score } : save.stats.highScores,
        bestStreak: Math.max(save.stats.bestStreak, session.bestStreak),
        gamesPlayed: save.stats.gamesPlayed + 1,
        recentGames: [summary, ...save.stats.recentGames].slice(0, 12),
      },
    },
  }
}

export interface ContinentProgress {
  continent: Continent
  total: number
  discovered: number
  mastered: number
}

export interface AtlasSummary {
  total: number
  discovered: number
  mastered: number
  learning: number
  unknown: number
  needsReview: number
  percent: number
  byContinent: ContinentProgress[]
  mastery: Map<string, Mastery>
}

export function atlasSummary(save: SaveData): AtlasSummary {
  const mastery = new Map<string, Mastery>()
  const byContinent = new Map<Continent, ContinentProgress>(
    CONTINENTS.map((c) => [c, { continent: c, total: 0, discovered: 0, mastered: 0 }]),
  )
  let mastered = 0
  let learning = 0
  for (const c of COUNTRIES) {
    const m = masteryOf(save.records[c.code])
    mastery.set(c.code, m)
    const cp = byContinent.get(c.continent)!
    cp.total++
    if (m !== 'unknown') cp.discovered++
    if (m === 'mastered') {
      cp.mastered++
      mastered++
    } else if (m === 'learning') learning++
  }
  const discovered = mastered + learning
  return {
    total: COUNTRIES.length,
    discovered,
    mastered,
    learning,
    unknown: COUNTRIES.length - discovered,
    needsReview: Object.keys(save.echo).length,
    percent: Math.round((discovered / COUNTRIES.length) * 1000) / 10,
    byContinent: [...byContinent.values()],
    mastery,
  }
}
