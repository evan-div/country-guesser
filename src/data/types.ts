export type Continent = 'Africa' | 'Asia' | 'Europe' | 'North America' | 'South America' | 'Oceania'

export const CONTINENTS: readonly Continent[] = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
]

export interface Focus {
  lat: number
  lng: number
  /** Angular radius (degrees) of the country's main landmass around the focus point. */
  radius: number
}

export interface Country {
  /** ISO 3166-1 alpha-3 code — the stable identifier used everywhere. */
  code: string
  iso2: string
  isoNumeric: string | null
  /** Common English name. */
  name: string
  official: string
  /** Alternate names from the source datasets (not normalized). */
  aliases: string[]
  continent: Continent
  subregion: string
  capitals: string[]
  /** Land-border neighbors (ISO alpha-3), restricted to the 195 playable states. */
  neighbors: string[]
  /** Nearest countries by polygon distance — used for island hints. */
  nearby: { code: string; km: number }[]
  landlocked: boolean
  area: number
  /** Flag emoji (reserved for Flag Mode). */
  flag: string
  languages: string[]
  currencies: string[]
  /** Camera framing: area-weighted centroid of the main landmass + its angular radius. */
  focus: Focus
  /** A point guaranteed to lie inside the country (labels, microstate beacons). */
  label: { lat: number; lng: number }
}
