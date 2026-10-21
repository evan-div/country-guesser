import type { Challenge, Outcome, PlayStyle } from '../game/types'

export interface ChallengeStats {
  attempts: number
  correct: number
}

/** Everything the player has learned about one country. */
export interface CountryRecord {
  /** Country-identification rounds in which this country was the target. */
  encounters: number
  correct: number
  incorrect: number
  /** Correct identifications made without any hints. */
  unassistedCorrect: number
  hintsUsed: number
  lastSeen: number
  lastResult: Outcome | null
  firstCorrectAt: number | null
  capital?: ChallengeStats
  neighbors?: ChallengeStats
}

export type Mastery = 'unknown' | 'learning' | 'mastered'

export const MASTERY_CORRECT = 3
export const MASTERY_UNASSISTED = 2

/**
 * Unknown: never identified correctly. Learning: identified at least once.
 * Mastered: identified correctly in at least three separate rounds, two of them unassisted.
 */
export function masteryOf(r: CountryRecord | undefined): Mastery {
  if (!r || r.correct === 0) return 'unknown'
  if (r.correct >= MASTERY_CORRECT && r.unassistedCorrect >= MASTERY_UNASSISTED) return 'mastered'
  return 'learning'
}

export function emptyRecord(): CountryRecord {
  return {
    encounters: 0,
    correct: 0,
    incorrect: 0,
    unassistedCorrect: 0,
    hintsUsed: 0,
    lastSeen: 0,
    lastResult: null,
    firstCorrectAt: null,
  }
}

export interface RoundOutcome {
  code: string
  challenge: Challenge
  style: PlayStyle
  outcome: Outcome
  hintsUsed: number
  at: number
}

/** Folds one finished round into a country's record (pure). */
export function applyRound(prev: CountryRecord | undefined, o: RoundOutcome): CountryRecord {
  const r = { ...(prev ?? emptyRecord()) }
  const correct = o.outcome === 'correct'
  if (o.challenge === 'country') {
    r.encounters += 1
    r.hintsUsed += o.hintsUsed
    r.lastSeen = o.at
    r.lastResult = o.outcome
    if (correct) {
      r.correct += 1
      if (o.hintsUsed === 0) r.unassistedCorrect += 1
      r.firstCorrectAt ??= o.at
    } else {
      r.incorrect += 1
    }
  } else {
    const key = o.challenge
    const s = { ...(r[key] ?? { attempts: 0, correct: 0 }) }
    s.attempts += 1
    if (correct) s.correct += 1
    r[key] = s
  }
  return r
}
