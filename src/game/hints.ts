import { getCountry, seaContext, TRANSCONTINENTAL_NOTE } from '../data/countries'
import { mulberry32, sample } from './rng'
import type { Challenge, Hint, PatternWord } from './types'
import { primaryCapital, displayCapitals } from './validation/capitals'

const isLetter = (ch: string) => /\p{L}/u.test(ch)

export function letterCount(name: string): number {
  return [...name].filter(isLetter).length
}

/** Splits a name into words of characters, hiding letters `reveal` rejects. */
export function makePattern(name: string, reveal: (letterIndex: number, total: number) => boolean): PatternWord[] {
  const total = letterCount(name)
  let li = 0
  return name.split(/\s+/).map((word) =>
    [...word].map((ch) => {
      if (!isLetter(ch)) return ch
      const shown = reveal(li, total)
      li++
      return shown ? ch.toUpperCase() : null
    }),
  )
}

export function patternText(p: PatternWord[]): string {
  return p.map((w) => w.map((c) => c ?? '_').join(' ')).join('   ')
}

export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const nameOf = (code: string) => getCountry(code).name

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/**
 * Hides capital words that echo the country's name ("Mexico City" → "_ _ _ _ _ _ City"),
 * so the capital hint never hands over the answer.
 */
export function maskSharedWords(capital: string, country: string): string {
  const countryWords = fold(country)
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4)
  return capital
    .split(' ')
    .map((word) => {
      const w = fold(word).replace(/[^a-z]/g, '')
      const shared = w.length >= 4 && countryWords.some((cw) => cw.startsWith(w) || w.startsWith(cw))
      return shared ? [...word].map((ch) => (isLetter(ch) ? '_' : ch)).join('') : word
    })
    .join(' ')
}

function countryLadder(code: string, seed: number): Hint[] {
  const c = getCountry(code)
  const rng = mulberry32(seed)
  const ladder: Hint[] = []

  const note = TRANSCONTINENTAL_NOTE[code]
  ladder.push({
    level: 1,
    label: 'Continent',
    text: `This country is in ${c.continent}.${note ? ` ${note}` : ''}`,
  })

  if (c.neighbors.length) {
    const picks = sample(c.neighbors, Math.min(3, c.neighbors.length), rng)
    const names = picks.map(nameOf)
    const extra = c.neighbors.length - picks.length
    const text =
      c.neighbors.length === 1
        ? `It shares a land border with only one country: ${names[0]}.`
        : `It shares land borders with ${listNames(names)}${extra > 0 ? ` — and ${extra} more` : ''}.`
    ladder.push({ level: 2, label: 'Neighbors', text, highlight: picks })
  } else {
    const sea = seaContext(c)
    const near = c.nearby.slice(0, 2).map((n) => n.code)
    ladder.push({
      level: 2,
      label: 'Neighbors',
      text: `It has no land borders — it's an island nation${sea ? ` in ${sea}` : ''}. Its closest neighbors across the water are ${listNames(near.map(nameOf))}.`,
      highlight: near,
    })
  }

  const n = letterCount(c.name)
  ladder.push({
    level: 3,
    label: 'First letter',
    text: `Its name starts with “${c.name[0].toUpperCase()}” and has ${n} letters.`,
    pattern: makePattern(c.name, (i) => i === 0),
  })

  const caps = displayCapitals(code).map((cap) => maskSharedWords(cap, c.name))
  const masked = caps.some((cap) => cap.includes('_'))
  ladder.push({
    level: 4,
    label: 'Capital',
    text:
      (caps.length > 1 ? `Its capital is ${caps[0]} (also ${listNames(caps.slice(1))}).` : `Its capital is ${caps[0]}.`) +
      (masked ? ' The hidden part matches the country’s own name.' : ''),
  })
  return ladder
}

function capitalLadder(code: string): Hint[] {
  const cap = primaryCapital(code)
  const n = letterCount(cap)
  return [
    { level: 1, label: 'Length', text: `The capital's name has ${n} letters.`, pattern: makePattern(cap, () => false) },
    {
      level: 2,
      label: 'First letter',
      text: `It starts with “${cap[0].toUpperCase()}”.`,
      pattern: makePattern(cap, (i) => i === 0),
    },
    {
      level: 3,
      label: 'Bookends',
      text: `It starts with “${cap[0].toUpperCase()}” and ends with “${[...cap].filter(isLetter).pop()!.toUpperCase()}”.`,
      pattern: makePattern(cap, (i, total) => i === 0 || i === total - 1),
    },
    {
      level: 4,
      label: 'Letters',
      text: 'Half of the letters are revealed.',
      pattern: makePattern(cap, (i, total) => i === 0 || i === total - 1 || i % 2 === 0),
    },
  ]
}

function neighborsLadder(code: string, seed: number): Hint[] {
  const c = getCountry(code)
  const rng = mulberry32(seed)
  const count = c.neighbors.length
  const initials = [...new Set(c.neighbors.map((n) => nameOf(n)[0].toUpperCase()))].sort()
  const pick = sample(c.neighbors, 1, rng)[0]
  const pickName = nameOf(pick)
  return [
    {
      level: 1,
      label: 'Count',
      text: count === 1 ? `${c.name} has only one land neighbor.` : `${c.name} has ${count} land neighbors.`,
    },
    {
      level: 2,
      label: 'Map',
      text: `${count === 1 ? 'Its neighbor is' : 'Its neighbors are'} now highlighted in amber on the globe.`,
      highlight: c.neighbors,
    },
    { level: 3, label: 'Initials', text: `Neighbor names start with: ${initials.join(', ')}.` },
    {
      level: 4,
      label: 'Letters',
      text: `One neighbor has ${letterCount(pickName)} letters.`,
      pattern: makePattern(pickName, (i, total) => i === 0 || i === total - 1 || i % 2 === 0),
    },
  ]
}

/** All four hints for a round, generated up front so they are stable for the round. */
export function buildHintLadder(challenge: Challenge, code: string, seed: number): Hint[] {
  if (challenge === 'capital') return capitalLadder(code)
  if (challenge === 'neighbors') return neighborsLadder(code, seed)
  return countryLadder(code, seed)
}
