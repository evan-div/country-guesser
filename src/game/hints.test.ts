import { describe, expect, it } from 'vitest'
import { buildHintLadder, letterCount, makePattern, patternText } from './hints'
import { COUNTRIES } from '../data/countries'

describe('hint ladders', () => {
  it('every country gets four non-empty country hints', () => {
    for (const c of COUNTRIES) {
      const ladder = buildHintLadder('country', c.code, 42)
      expect(ladder).toHaveLength(4)
      for (const h of ladder) expect(h.text.length).toBeGreaterThan(10)
      // The answer itself never appears in hint text (neighbor lists may legitimately
      // contain similar names, e.g. Niger ↔ Nigeria, so level 2 is checked separately).
      for (const h of [ladder[0], ladder[2], ladder[3]])
        expect(h.text.toLowerCase(), c.code).not.toContain(c.name.toLowerCase())
    }
  })

  it('continent hint names the continent', () => {
    expect(buildHintLadder('country', 'PER', 1)[0].text).toBe('This country is in South America.')
  })

  it('neighbors hint lists up to three real neighbors and highlights them', () => {
    const h = buildHintLadder('country', 'BRA', 5)[1]
    expect(h.highlight).toHaveLength(3)
    expect(h.text).toMatch(/and 7 more/)
  })

  it('island nations get a sea clue and nearby countries instead', () => {
    const h = buildHintLadder('country', 'JAM', 1)[1]
    expect(h.text).toMatch(/no land borders/)
    expect(h.text).toMatch(/Caribbean/)
    expect(h.highlight?.length).toBe(2)
  })

  it('first-letter hint reveals the first letter and the letter count', () => {
    const h = buildHintLadder('country', 'NZL', 1)[2]
    expect(h.text).toBe('Its name starts with “N” and has 10 letters.')
    expect(patternText(h.pattern!)).toBe('N _ _   _ _ _ _ _ _ _')
  })

  it('capital hint reveals the capital', () => {
    expect(buildHintLadder('country', 'AUS', 1)[3].text).toBe('Its capital is Canberra.')
    expect(buildHintLadder('country', 'BOL', 1)[3].text).toBe('Its capital is Sucre (also La Paz).')
  })

  it('masks capitals that contain the country name', () => {
    expect(buildHintLadder('country', 'MEX', 1)[3].text).toBe(
      'Its capital is ______ City. The hidden part matches the country’s own name.',
    )
    expect(buildHintLadder('country', 'AND', 1)[3].text).toMatch(/_______ la Vella/)
    expect(buildHintLadder('country', 'TUN', 1)[3].text).toMatch(/_____\./)
  })

  it('is deterministic for a given seed', () => {
    expect(buildHintLadder('country', 'DEU', 9)).toEqual(buildHintLadder('country', 'DEU', 9))
  })

  it('capital and neighbor ladders never reveal the full answer', () => {
    const cap = buildHintLadder('capital', 'FRA', 1)
    expect(cap.map((h) => h.text).join(' ')).not.toMatch(/Paris/)
    const nb = buildHintLadder('neighbors', 'FRA', 1)
    expect(nb[0].text).toBe('France has 10 land neighbors.')
    expect(nb[1].highlight).toHaveLength(10)
  })

  it('patterns keep punctuation and count only letters', () => {
    expect(letterCount("Côte d'Ivoire")).toBe(11)
    expect(patternText(makePattern('Guinea-Bissau', (i) => i === 0))).toBe('G _ _ _ _ _ - _ _ _ _ _ _')
  })
})
