import { describe, expect, it } from 'vitest'
import { COUNTRIES, COUNTRY_BY_CODE, framingRadius } from './countries'
import { CONTINENTS } from './types'
import { readFileSync } from 'node:fs'
import { parseWorld } from './world'

const world = parseWorld(JSON.parse(readFileSync(new URL('../../public/data/world.topo.json', import.meta.url), 'utf8')))

describe('country dataset', () => {
  it('has exactly the 195 sovereign states (193 UN members + Holy See + Palestine)', () => {
    expect(COUNTRIES).toHaveLength(195)
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(195)
    expect(COUNTRY_BY_CODE.has('VAT')).toBe(true)
    expect(COUNTRY_BY_CODE.has('PSE')).toBe(true)
    // not sovereign UN members in this game
    for (const code of ['TWN', 'XKX', 'ESH', 'GRL', 'PRI', 'HKG']) expect(COUNTRY_BY_CODE.has(code)).toBe(false)
  })

  it('every country is complete', () => {
    for (const c of COUNTRIES) {
      expect(c.name, c.code).toBeTruthy()
      expect(c.capitals.length, c.code).toBeGreaterThan(0)
      expect(CONTINENTS, c.code).toContain(c.continent)
      expect(c.iso2, c.code).toMatch(/^[A-Z]{2}$/)
      expect(c.flag, c.code).toBeTruthy()
      expect(Number.isFinite(c.focus.lat) && Number.isFinite(c.focus.lng), c.code).toBe(true)
      expect(c.focus.radius, c.code).toBeGreaterThan(0)
      expect(Math.abs(c.label.lat), c.code).toBeLessThanOrEqual(90)
    }
  })

  it('every country has polygon geometry on the map', () => {
    for (const c of COUNTRIES) {
      const shape = world.byCode.get(c.code)
      expect(shape, c.code).toBeDefined()
      expect(shape!.polygons.length, c.code).toBeGreaterThan(0)
    }
    expect(world.byCode.size).toBe(195)
  })

  it('land borders are symmetric and only reference playable countries', () => {
    for (const c of COUNTRIES)
      for (const n of c.neighbors) {
        expect(COUNTRY_BY_CODE.has(n), `${c.code}→${n}`).toBe(true)
        expect(COUNTRY_BY_CODE.get(n)!.neighbors, `${n}→${c.code}`).toContain(c.code)
      }
  })

  it('microstates and island nations are present', () => {
    for (const code of ['VAT', 'MCO', 'SMR', 'LIE', 'NRU', 'TUV', 'MHL', 'PLW', 'KIR', 'FSM', 'MDV', 'SGP'])
      expect(COUNTRY_BY_CODE.has(code)).toBe(true)
    expect(COUNTRIES.filter((c) => !c.neighbors.length).length).toBe(39)
  })

  it('distant territories do not pull the camera away from the homeland', () => {
    const fra = COUNTRY_BY_CODE.get('FRA')!
    expect(fra.focus.lng).toBeGreaterThan(-5)
    expect(fra.focus.lng).toBeLessThan(8)
    const usa = COUNTRY_BY_CODE.get('USA')!
    expect(usa.focus.lat).toBeGreaterThan(30)
    expect(usa.focus.lng).toBeLessThan(-80)
  })

  it('frames remote islands with regional context but keeps enclaves tight', () => {
    const get = (c: string) => COUNTRY_BY_CODE.get(c)!
    expect(framingRadius(get('KIR'))).toBeGreaterThan(10)
    expect(framingRadius(get('TUV'))).toBeGreaterThan(4)
    expect(framingRadius(get('VAT'))).toBe(get('VAT').focus.radius)
    expect(framingRadius(get('AUS'))).toBe(get('AUS').focus.radius)
  })
})
