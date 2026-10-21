import { COUNTRIES, getCountry } from '../../data/countries'
import territoriesRaw from '../../data/generated/territories.json'
import { AMBIGUOUS_NAMES, COUNTRY_ALIASES, EXCLUDED_DATASET_ALIASES, PART_OF } from './aliases'
import { acceptedCapitals } from './capitals'
import { editDistance, nameKey } from './normalize'

interface Territory {
  name: string
  names: string[]
  sovereign: string | null
}
const TERRITORIES = territoriesRaw as Territory[]

export type GuessResolution =
  | { kind: 'empty' }
  /** A playable country. `typoOf` holds the canonical name when matched with a small typo. */
  | { kind: 'country'; code: string; typoOf?: string }
  /** Names several countries (e.g. "Congo"): never penalized. */
  | { kind: 'ambiguous'; options: string[] }
  /** A well-known part of a country (e.g. "Scotland"): never penalized. */
  | { kind: 'partOf'; place: string; code: string }
  /** A real, non-playable territory (e.g. "Greenland"): counts as a guess. */
  | { kind: 'territory'; name: string; sovereign: string | null }
  /** Not a place we recognise: never penalized, the player is asked to check spelling. */
  | { kind: 'unknown' }

interface NameIndex {
  countries: Map<string, Set<string>>
  ambiguous: Map<string, string[]>
  partOf: Map<string, { place: string; code: string }>
  territories: Map<string, Territory>
  /** Keys eligible for typo tolerance, with what they resolve to ("country:FRA", "territory:…"). */
  fuzzy: [string, string][]
}

let index: NameIndex | null = null

/** Builds (once) the lookup of every accepted way to name a country. */
export function getNameIndex(): NameIndex {
  if (index) return index
  const countries = new Map<string, Set<string>>()
  const add = (name: string, code: string, allowShort: boolean) => {
    const key = nameKey(name)
    if (!key || (!allowShort && key.length < 4)) return
    let set = countries.get(key)
    if (!set) countries.set(key, (set = new Set()))
    set.add(code)
  }
  for (const c of COUNTRIES) {
    add(c.name, c.code, true)
    add(c.official, c.code, false)
    for (const a of c.aliases) if (!EXCLUDED_DATASET_ALIASES.has(a)) add(a, c.code, false)
    for (const a of COUNTRY_ALIASES[c.code] ?? []) add(a, c.code, true)
  }

  const ambiguous = new Map<string, string[]>()
  for (const [name, codes] of Object.entries(AMBIGUOUS_NAMES)) ambiguous.set(nameKey(name), codes)
  // Any accidental dataset collision is treated as ambiguous rather than silently picking one.
  for (const [key, codes] of countries) if (codes.size > 1 && !ambiguous.has(key)) ambiguous.set(key, [...codes])

  const partOf = new Map<string, { place: string; code: string }>()
  for (const [place, code] of Object.entries(PART_OF)) partOf.set(nameKey(place), { place, code })

  const territories = new Map<string, Territory>()
  for (const t of TERRITORIES) {
    for (const n of t.names) {
      const key = nameKey(n)
      if (key.length >= 4 && !countries.has(key)) territories.set(key, t)
    }
  }

  const fuzzy: [string, string][] = []
  for (const [key, codes] of countries) if (codes.size === 1 && key.length >= 5) fuzzy.push([key, `country:${[...codes][0]}`])
  for (const [key, t] of territories) fuzzy.push([key, `territory:${t.name}`])
  for (const [key, p] of partOf) fuzzy.push([key, `part:${p.place}`])
  for (const key of ambiguous.keys()) fuzzy.push([key, `ambiguous:${key}`])

  index = { countries, ambiguous, partOf, territories, fuzzy }
  return index
}

/** Allowed edit distance for typo tolerance, by input length. */
export function typoBudget(length: number): number {
  if (length >= 11) return 2
  if (length >= 6) return 1
  return 0
}

/**
 * Resolves free text to a country. Exact (normalized) names and curated aliases only —
 * no prefix or partial matching. A small typo is tolerated for longer names when it
 * points unambiguously at one country.
 */
export function resolveCountryGuess(input: string): GuessResolution {
  const key = nameKey(input)
  if (!key) return { kind: 'empty' }
  const idx = getNameIndex()

  const amb = idx.ambiguous.get(key)
  if (amb) return { kind: 'ambiguous', options: amb }
  const codes = idx.countries.get(key)
  if (codes) return { kind: 'country', code: [...codes][0] }
  const part = idx.partOf.get(key)
  if (part) return { kind: 'partOf', ...part }
  const terr = idx.territories.get(key)
  if (terr) return { kind: 'territory', name: terr.name, sovereign: terr.sovereign }

  const budget = typoBudget(key.length)
  if (budget > 0) {
    const hits = new Set<string>()
    let best = budget + 1
    for (const [k, target] of idx.fuzzy) {
      const d = editDistance(key, k, budget)
      if (d > budget) continue
      if (d < best) {
        best = d
        hits.clear()
      }
      if (d === best) hits.add(target)
    }
    if (hits.size === 1) {
      const [target] = [...hits]
      if (target.startsWith('country:')) {
        const code = target.slice(8)
        return { kind: 'country', code, typoOf: getCountry(code).name }
      }
    }
  }
  return { kind: 'unknown' }
}

// ---------------------------------------------------------------------------
// Capitals
// ---------------------------------------------------------------------------

let capitalIndex: Map<string, Set<string>> | null = null

function getCapitalIndex(): Map<string, Set<string>> {
  if (capitalIndex) return capitalIndex
  capitalIndex = new Map()
  for (const c of COUNTRIES) {
    for (const cap of acceptedCapitals(c.code)) {
      const key = nameKey(cap)
      if (!key) continue
      let set = capitalIndex.get(key)
      if (!set) capitalIndex.set(key, (set = new Set()))
      set.add(c.code)
    }
  }
  return capitalIndex
}

export type CapitalResolution =
  | { kind: 'empty' }
  | { kind: 'correct'; typoOf?: string }
  /** The capital of a different country. */
  | { kind: 'otherCapital'; code: string }
  | { kind: 'wrong' }

export function resolveCapitalGuess(code: string, input: string): CapitalResolution {
  const key = nameKey(input)
  if (!key) return { kind: 'empty' }
  const accepted = acceptedCapitals(code)
  const keys = accepted.map(nameKey)
  if (keys.includes(key)) return { kind: 'correct' }
  const owners = getCapitalIndex().get(key)
  if (owners?.size) return { kind: 'otherCapital', code: [...owners][0] }
  const budget = key.length >= 10 ? 2 : key.length >= 5 ? 1 : 0
  for (let i = 0; i < keys.length; i++) {
    if (budget && editDistance(key, keys[i], budget) <= budget) return { kind: 'correct', typoOf: accepted[i] }
  }
  return { kind: 'wrong' }
}
