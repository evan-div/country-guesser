import { COUNTRY_BY_CODE } from '../data/countries'
import {
  BACKUP_KEY,
  DEFAULT_SETTINGS,
  freshSave,
  SAVE_VERSION,
  STORAGE_KEY,
  type SaveData,
  type Settings,
} from './schema'

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): KV | null {
  try {
    const s = window.localStorage
    const probe = '__atlas_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null // private mode / storage disabled: play without persistence
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

function sanitizeSettings(raw: unknown): Settings {
  const s = isObj(raw) ? raw : {}
  return {
    motion: s.motion === 'full' || s.motion === 'reduced' ? s.motion : 'system',
    sound: bool(s.sound, DEFAULT_SETTINGS.sound),
    haptics: bool(s.haptics, DEFAULT_SETTINGS.haptics),
    quality: s.quality === 'high' || s.quality === 'balanced' || s.quality === 'saver' ? s.quality : 'auto',
  }
}

/**
 * Upgrades any stored payload to the current schema. Unknown country codes are dropped,
 * malformed fields fall back to defaults, and a newer-than-supported save is left intact
 * in a backup slot rather than being overwritten silently.
 */
export function migrate(raw: unknown): { data: SaveData; recovered: boolean } {
  if (!isObj(raw)) return { data: freshSave(), recovered: raw !== null && raw !== undefined }
  const version = num(raw.version, 0)
  if (version > SAVE_VERSION) return { data: freshSave(sanitizeSettings(raw.settings)), recovered: true }

  // v0 (pre-release) stored records at the top level under "countries".
  const recordsRaw = isObj(raw.records) ? raw.records : isObj(raw.countries) ? raw.countries : {}
  const data = freshSave(sanitizeSettings(raw.settings))
  for (const [code, r] of Object.entries(recordsRaw)) {
    if (!COUNTRY_BY_CODE.has(code) || !isObj(r)) continue
    data.records[code] = {
      encounters: num(r.encounters),
      correct: num(r.correct),
      incorrect: num(r.incorrect),
      unassistedCorrect: num(r.unassistedCorrect),
      hintsUsed: num(r.hintsUsed),
      lastSeen: num(r.lastSeen),
      lastResult: r.lastResult === 'correct' || r.lastResult === 'wrong' || r.lastResult === 'revealed' ? r.lastResult : null,
      firstCorrectAt: typeof r.firstCorrectAt === 'number' ? r.firstCorrectAt : null,
      ...(isObj(r.capital) ? { capital: { attempts: num(r.capital.attempts), correct: num(r.capital.correct) } } : {}),
      ...(isObj(r.neighbors)
        ? { neighbors: { attempts: num(r.neighbors.attempts), correct: num(r.neighbors.correct) } }
        : {}),
    }
  }
  if (isObj(raw.echo)) {
    for (const [code, e] of Object.entries(raw.echo)) {
      if (!COUNTRY_BY_CODE.has(code) || !isObj(e)) continue
      data.echo[code] = {
        addedAt: num(e.addedAt),
        misses: num(e.misses, 1),
        lastMissAt: num(e.lastMissAt),
        attempts: num(e.attempts),
        hits: num(e.hits),
      }
    }
  }
  if (Array.isArray(raw.graduated)) data.graduated = raw.graduated.filter((c) => COUNTRY_BY_CODE.has(c))
  if (isObj(raw.stats)) {
    const st = raw.stats
    const hs = isObj(st.highScores) ? st.highScores : {}
    data.stats = {
      highScores: { country: num(hs.country), capital: num(hs.capital), neighbors: num(hs.neighbors) },
      bestStreak: num(st.bestStreak),
      gamesPlayed: num(st.gamesPlayed),
      recentGames: Array.isArray(st.recentGames) ? (st.recentGames.filter(isObj) as unknown as SaveData['stats']['recentGames']).slice(0, 12) : [],
    }
  }
  if (Array.isArray(raw.announcedUnlocks))
    data.announcedUnlocks = raw.announcedUnlocks.filter((c) => c === 'capital' || c === 'neighbors')
  return { data, recovered: false }
}

export function loadSave(storage: KV | null = safeStorage()): SaveData {
  if (!storage) return freshSave()
  const text = storage.getItem(STORAGE_KEY)
  if (!text) return freshSave()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    storage.setItem(BACKUP_KEY, text)
    return freshSave()
  }
  const { data, recovered } = migrate(parsed)
  if (recovered) storage.setItem(BACKUP_KEY, text)
  return data
}

export function writeSave(data: SaveData, storage: KV | null = safeStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false // quota exceeded — keep playing in memory
  }
}
