import raw from './generated/countries.json'
import type { Continent, Country } from './types'

export const COUNTRIES: readonly Country[] = raw as Country[]

export const COUNTRY_BY_CODE: ReadonlyMap<string, Country> = new Map(COUNTRIES.map((c) => [c.code, c]))

export const ALL_CODES: readonly string[] = COUNTRIES.map((c) => c.code)

export function getCountry(code: string): Country {
  const c = COUNTRY_BY_CODE.get(code)
  if (!c) throw new Error(`Unknown country code: ${code}`)
  return c
}

export function countriesIn(continent: Continent): Country[] {
  return COUNTRIES.filter((c) => c.continent === continent)
}

/** Countries smaller than this focus radius get a beacon marker so they stay visible. */
export const MICROSTATE_RADIUS = 0.6

export function isMicrostate(c: Country): boolean {
  return c.focus.radius < MICROSTATE_RADIUS
}

/** Short ocean/sea context for island hints, keyed by subregion. */
const SEA_CONTEXT: Record<string, string> = {
  Caribbean: 'the Caribbean Sea',
  Melanesia: 'the southwestern Pacific Ocean',
  Micronesia: 'the western Pacific Ocean',
  Polynesia: 'the central Pacific Ocean',
  'Australia and New Zealand': 'the South Pacific',
  'South-Eastern Asia': 'Southeast Asian waters',
  'Eastern Africa': 'the Indian Ocean',
  'Middle Africa': 'the Gulf of Guinea',
  'Western Africa': 'the Atlantic Ocean',
  'Southern Asia': 'the Indian Ocean',
  'Western Asia': 'the Persian Gulf region',
  'Southern Europe': 'the Mediterranean Sea',
  'Northern Europe': 'the North Atlantic',
  'Eastern Asia': 'the western Pacific Ocean',
}

export function seaContext(c: Country): string | null {
  if (c.code === 'CYP') return 'the eastern Mediterranean Sea'
  return SEA_CONTEXT[c.subregion] ?? null
}

/** Notes shown with the continent hint for states that straddle continents. */
export const TRANSCONTINENTAL_NOTE: Record<string, string> = {
  RUS: 'It spans Eastern Europe and Northern Asia.',
  TUR: 'It bridges Western Asia and Southeastern Europe.',
  KAZ: 'A small part of it lies west of the Ural River, in Europe.',
  AZE: 'It lies on the boundary of Europe and Asia, in the Caucasus.',
  GEO: 'It lies on the boundary of Europe and Asia, in the Caucasus.',
  EGY: 'Its Sinai Peninsula reaches into Asia.',
  CYP: 'It is geographically in Asia but culturally tied to Europe.',
  ARM: 'It lies in the Caucasus between Europe and Asia.',
  PAN: 'It connects North and South America.',
  IDN: 'Its easternmost islands are often counted as part of Oceania.',
}
