/** Visual constants for the globe. Kept in one place so the look can be tuned easily. */
export const GLOBE_THEME = {
  background: '#02050d',
  atmosphere: '#3fbfff',
  atmosphereAltitude: 0.18,
  globeTint: 0xb8c8de,
  landBorder: 0x5fe3ff,
  landBorderOpacity: 0.72,
  coastline: 0x3aa9dd,
  coastlineOpacity: 0.42,
  target: 0x63f3ff,
  targetCore: 0xe8fdff,
  correct: 0x7dffd4,
  wrong: 0xff8a6b,
  hint: 0xffb547,
  discovered: 0x38d6ff,
  mastered: 0xffc857,
} as const

/** Altitudes (fractions of globe radius) — stacked to avoid z-fighting. */
export const LAYER_ALT = {
  fill: 0.0012,
  borders: 0.0022,
  outline: 0.0034,
  beacon: 0.004,
} as const
