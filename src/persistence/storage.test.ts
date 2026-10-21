import { describe, expect, it } from 'vitest'
import { loadSave, migrate, writeSave } from './storage'
import { BACKUP_KEY, freshSave, STORAGE_KEY } from './schema'
import { recordRound } from '../progress/progress'

class MemoryStorage {
  map = new Map<string, string>()
  getItem(k: string) {
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.map.set(k, v)
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
}

describe('persistence', () => {
  it('round-trips a save', () => {
    const store = new MemoryStorage()
    let save = freshSave()
    save = recordRound(save, { code: 'BRA', challenge: 'country', style: 'arcade', outcome: 'correct', hintsUsed: 0, at: 5 }).save
    save.settings.sound = false
    expect(writeSave(save, store)).toBe(true)
    expect(loadSave(store)).toEqual(save)
  })

  it('starts fresh (and backs up) when the save is corrupted', () => {
    const store = new MemoryStorage()
    store.setItem(STORAGE_KEY, '{not json')
    expect(loadSave(store)).toEqual(freshSave())
    expect(store.getItem(BACKUP_KEY)).toBe('{not json')
  })

  it('migrates a pre-release v0 save and drops unknown codes', () => {
    const { data } = migrate({
      countries: { FRA: { encounters: 3, correct: 2, unassistedCorrect: 1 }, XXX: { correct: 9 } },
      settings: { sound: false, motion: 'reduced' },
    })
    expect(data.version).toBe(1)
    expect(data.records.FRA.correct).toBe(2)
    expect(data.records.XXX).toBeUndefined()
    expect(data.settings).toMatchObject({ sound: false, motion: 'reduced', haptics: true })
  })

  it('does not clobber a save from a newer version', () => {
    const store = new MemoryStorage()
    const future = JSON.stringify({ version: 99, records: {} })
    store.setItem(STORAGE_KEY, future)
    loadSave(store)
    expect(store.getItem(BACKUP_KEY)).toBe(future)
  })

  it('works without storage', () => {
    expect(loadSave(null)).toEqual(freshSave())
    expect(writeSave(freshSave(), null)).toBe(false)
  })
})
