import { ALL_CODES, COUNTRIES, getCountry } from '../data/countries'
import type { Challenge, NoticeKind } from './types'
import { resolveCapitalGuess, resolveCountryGuess } from './validation/match'
import { displayCapitals } from './validation/capitals'
import { listNames } from './hints'

export interface ChallengeInfo {
  id: Challenge
  title: string
  tagline: string
  /** Unique countries identified needed to unlock (0 = always available). */
  unlockAt: number
  placeholder: string
}

export const CHALLENGES: Record<Challenge, ChallengeInfo> = {
  country: {
    id: 'country',
    title: 'Countries',
    tagline: 'Identify the highlighted country',
    unlockAt: 0,
    placeholder: 'Name this country…',
  },
  capital: {
    id: 'capital',
    title: 'Capitals',
    tagline: 'Name the capital of the highlighted country',
    unlockAt: 25,
    placeholder: 'Type the capital…',
  },
  neighbors: {
    id: 'neighbors',
    title: 'Neighbors',
    tagline: 'Name any country sharing a land border',
    unlockAt: 60,
    placeholder: 'Name a neighbor…',
  },
}

/** Countries that can appear in a challenge. Neighbors excludes countries without land borders. */
export function poolFor(challenge: Challenge): string[] {
  if (challenge === 'neighbors') return COUNTRIES.filter((c) => c.neighbors.length > 0).map((c) => c.code)
  return [...ALL_CODES]
}

export function promptFor(challenge: Challenge, code: string): { title: string; subject?: string } {
  if (challenge === 'capital') return { title: 'What is the capital of', subject: getCountry(code).name }
  if (challenge === 'neighbors') return { title: 'Name a country bordering', subject: getCountry(code).name }
  return { title: 'Which country is this?' }
}

/** The correct answer as shown on the feedback card. */
export function answerFor(challenge: Challenge, code: string): string {
  if (challenge === 'capital') return displayCapitals(code).join(' / ')
  if (challenge === 'neighbors') return listNames(getCountry(code).neighbors.map((n) => getCountry(n).name))
  return getCountry(code).name
}

export type Evaluation =
  | { kind: 'notice'; notice: NoticeKind; text: string }
  | { kind: 'graded'; correct: boolean; guessLabel: string; guessCode?: string; typoOf?: string; note?: string }

const nameOf = (code: string) => getCountry(code).name

/** Grades a submission. "notice" results never cost a life or break a streak. */
export function evaluate(challenge: Challenge, code: string, input: string): Evaluation {
  const trimmed = input.trim().replace(/\s+/g, ' ')
  if (!trimmed) return { kind: 'notice', notice: 'empty', text: 'Type your answer first.' }

  if (challenge === 'capital') {
    const r = resolveCapitalGuess(code, trimmed)
    switch (r.kind) {
      case 'empty':
        return { kind: 'notice', notice: 'empty', text: 'Type your answer first.' }
      case 'correct':
        return { kind: 'graded', correct: true, guessLabel: r.typoOf ?? trimmed, typoOf: r.typoOf }
      case 'otherCapital':
        return {
          kind: 'graded',
          correct: false,
          guessLabel: trimmed,
          note: `${trimmed} is the capital of ${nameOf(r.code)}.`,
        }
      case 'wrong':
        return { kind: 'graded', correct: false, guessLabel: trimmed }
    }
  }

  const target = getCountry(code)
  const r = resolveCountryGuess(trimmed)
  const isNeighbor = (c: string) => target.neighbors.includes(c)

  switch (r.kind) {
    case 'empty':
      return { kind: 'notice', notice: 'empty', text: 'Type your answer first.' }
    case 'unknown':
      return { kind: 'notice', notice: 'unknown', text: `“${trimmed}” isn't a country we recognize. Check the spelling.` }
    case 'ambiguous': {
      if (challenge === 'neighbors' && r.options.every(isNeighbor))
        return { kind: 'graded', correct: true, guessLabel: trimmed }
      if (challenge === 'neighbors' && !r.options.some(isNeighbor))
        return { kind: 'graded', correct: false, guessLabel: trimmed }
      return {
        kind: 'notice',
        notice: 'ambiguous',
        text: `“${trimmed}” could mean ${listNames(r.options.map(nameOf))}. Be more specific.`,
      }
    }
    case 'partOf': {
      const relevant = challenge === 'neighbors' ? isNeighbor(r.code) : r.code === code
      if (relevant)
        return {
          kind: 'notice',
          notice: 'partOf',
          text: `${r.place} is part of a larger country. Name the sovereign state.`,
        }
      return {
        kind: 'graded',
        correct: false,
        guessLabel: r.place,
        note: `${r.place} is part of ${nameOf(r.code)}.`,
      }
    }
    case 'territory':
      return {
        kind: 'graded',
        correct: false,
        guessLabel: r.name,
        note: r.sovereign
          ? `${r.name} is a territory of ${nameOf(r.sovereign)}, not a sovereign state.`
          : `${r.name} isn't one of the 195 sovereign states in this game.`,
      }
    case 'country': {
      if (challenge === 'neighbors') {
        if (r.code === code)
          return {
            kind: 'notice',
            notice: 'self',
            text: `That's ${target.name} itself — name a country that borders it.`,
          }
        const ok = isNeighbor(r.code)
        return {
          kind: 'graded',
          correct: ok,
          guessLabel: nameOf(r.code),
          guessCode: r.code,
          typoOf: r.typoOf,
          note: ok ? undefined : `${nameOf(r.code)} doesn't share a land border with ${target.name}.`,
        }
      }
      return {
        kind: 'graded',
        correct: r.code === code,
        guessLabel: nameOf(r.code),
        guessCode: r.code,
        typoOf: r.typoOf,
      }
    }
  }
}
