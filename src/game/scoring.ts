/** Scoring rules — pure and deterministic. */

export const BASE_POINTS = 100

/** Maximum base points remaining after 0, 1, 2, 3 or 4 hints. */
export const HINT_CAPS = [100, 70, 45, 25, 10] as const

export const MAX_HINTS = HINT_CAPS.length - 1

export function baseCapFor(hintsUsed: number): number {
  return HINT_CAPS[Math.max(0, Math.min(MAX_HINTS, Math.floor(hintsUsed)))]
}

/**
 * Multiplier for a run of consecutive correct answers *including* the current one:
 * 1st–2nd correct → 1×, 3rd–6th → 2×, 7th and beyond → 3× (the maximum).
 */
export function multiplierFor(streak: number): 1 | 2 | 3 {
  if (streak >= 7) return 3
  if (streak >= 3) return 2
  return 1
}

export interface ScoreAward {
  streak: number
  multiplier: 1 | 2 | 3
  base: number
  points: number
}

/** Points for a correct answer given the streak *before* this answer. */
export function scoreCorrect(prevStreak: number, hintsUsed: number, penalizeHints = true): ScoreAward {
  const streak = prevStreak + 1
  const multiplier = multiplierFor(streak)
  const base = penalizeHints ? baseCapFor(hintsUsed) : BASE_POINTS
  return { streak, multiplier, base, points: base * multiplier }
}

/** Streak thresholds worth celebrating (multiplier changes and round numbers). */
export function isStreakMilestone(streak: number): boolean {
  return streak === 3 || streak === 7 || (streak >= 10 && streak % 5 === 0)
}
