import type { Challenge, PlayStyle } from '../game/types'
import type { CountryRecord } from '../progress/records'

export const SAVE_VERSION = 1
export const STORAGE_KEY = 'atlas-rush:save'
export const BACKUP_KEY = 'atlas-rush:save:backup'

export type MotionPreference = 'system' | 'full' | 'reduced'
export type QualityPreference = 'auto' | 'high' | 'balanced' | 'saver'

export interface Settings {
  motion: MotionPreference
  sound: boolean
  haptics: boolean
  quality: QualityPreference
}

export interface EchoEntry {
  addedAt: number
  misses: number
  lastMissAt: number
  /** Echo Round attempts since it was added, for showing improvement. */
  attempts: number
  hits: number
}

export interface GameSummary {
  at: number
  style: PlayStyle
  challenge: Challenge
  score: number
  correct: number
  incorrect: number
  bestStreak: number
  bestMultiplier: number
  missed: string[]
}

export interface PlayerStats {
  highScores: Record<Challenge, number>
  bestStreak: number
  gamesPlayed: number
  recentGames: GameSummary[]
}

export interface SaveData {
  version: typeof SAVE_VERSION
  settings: Settings
  records: Record<string, CountryRecord>
  /** Echo Rounds review collection: countries answered incorrectly and not yet mastered. */
  echo: Record<string, EchoEntry>
  /** Countries that graduated from Echo Rounds by reaching mastery. */
  graduated: string[]
  stats: PlayerStats
  /** Challenges whose unlock celebration has been shown. */
  announcedUnlocks: Challenge[]
}

export const DEFAULT_SETTINGS: Settings = { motion: 'system', sound: true, haptics: true, quality: 'auto' }

export function freshSave(settings: Settings = DEFAULT_SETTINGS): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { ...settings },
    records: {},
    echo: {},
    graduated: [],
    stats: { highScores: { country: 0, capital: 0, neighbors: 0 }, bestStreak: 0, gamesPlayed: 0, recentGames: [] },
    announcedUnlocks: [],
  }
}
