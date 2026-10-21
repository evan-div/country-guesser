import { describe, expect, it } from 'vitest'
import { COUNTRIES } from '../../data/countries'
import { getNameIndex, resolveCapitalGuess, resolveCountryGuess } from './match'
import { normalizeName, nameKey, editDistance } from './normalize'
import { acceptedCapitals } from './capitals'

const code = (input: string) => {
  const r = resolveCountryGuess(input)
  return r.kind === 'country' ? r.code : r.kind
}

describe('normalizeName', () => {
  it('ignores case, accents, punctuation and extra whitespace', () => {
    expect(normalizeName('  CÔTE   d’Ivoire ')).toBe('cote divoire')
    expect(normalizeName('São Tomé & Príncipe')).toBe('sao tome and principe')
    expect(normalizeName('St. Lucia')).toBe('saint lucia')
    expect(normalizeName('The Gambia')).toBe('gambia')
    expect(normalizeName('Guinea-Bissau')).toBe('guinea bissau')
  })
  it('nameKey drops spaces so spacing variants compare equal', () => {
    expect(nameKey('Cote d Ivoire')).toBe(nameKey("Côte d'Ivoire"))
    expect(nameKey('NewZealand')).toBe(nameKey('New Zealand'))
  })
  it('editDistance counts transpositions as one edit', () => {
    expect(editDistance('colombia', 'columbia')).toBe(1)
    expect(editDistance('ab', 'ba')).toBe(1)
    expect(editDistance('kitten', 'sitting')).toBe(3)
  })
})

describe('resolveCountryGuess', () => {
  it('accepts every country by its common name', () => {
    for (const c of COUNTRIES) expect(code(c.name), c.name).toBe(c.code)
  })

  it('accepts every country by its official name or an equivalent', () => {
    for (const c of COUNTRIES) {
      const r = resolveCountryGuess(c.official)
      expect(r.kind === 'country' ? r.code : r.kind, c.official).toBe(c.code)
    }
  })

  it.each([
    ['USA', 'USA'],
    ['usa', 'USA'],
    ['U.S.', 'USA'],
    ['United States of America', 'USA'],
    ['Czech Republic', 'CZE'],
    ['Czechia', 'CZE'],
    ['Turkey', 'TUR'],
    ['Türkiye', 'TUR'],
    ['Turkiye', 'TUR'],
    ['Ivory Coast', 'CIV'],
    ["Côte d'Ivoire", 'CIV'],
    ['cote divoire', 'CIV'],
    ['UK', 'GBR'],
    ['Great Britain', 'GBR'],
    ['Burma', 'MMR'],
    ['Swaziland', 'SWZ'],
    ['East Timor', 'TLS'],
    ['Cabo Verde', 'CPV'],
    ['Holy See', 'VAT'],
    ['Vatican', 'VAT'],
    ['Holland', 'NLD'],
    ['DRC', 'COD'],
    ['DR Congo', 'COD'],
    ['Republic of the Congo', 'COG'],
    ['South Korea', 'KOR'],
    ['North Korea', 'PRK'],
    ['UAE', 'ARE'],
    ['Bosnia', 'BIH'],
    ['St Kitts and Nevis', 'KNA'],
    ['Saint Vincent & the Grenadines', 'VCT'],
    ['the bahamas', 'BHS'],
    ['  new   zealand  ', 'NZL'],
    ['North Macedonia', 'MKD'],
    ['Palestine', 'PSE'],
    ['Guinea', 'GIN'],
    ['Guinea-Bissau', 'GNB'],
    ['Equatorial Guinea', 'GNQ'],
    ['Niger', 'NER'],
    ['Nigeria', 'NGA'],
    ['Sudan', 'SDN'],
    ['South Sudan', 'SSD'],
    ['Dominica', 'DMA'],
    ['Dominican Republic', 'DOM'],
    ['Austria', 'AUT'],
    ['Australia', 'AUS'],
    ['Iran', 'IRN'],
    ['Iraq', 'IRQ'],
  ])('%s → %s', (input, expected) => {
    expect(code(input)).toBe(expected)
  })

  it('treats names shared by several countries as ambiguous', () => {
    expect(resolveCountryGuess('Congo')).toEqual({ kind: 'ambiguous', options: ['COG', 'COD'] })
    expect(resolveCountryGuess('korea').kind).toBe('ambiguous')
  })

  it('rejects partial names', () => {
    for (const partial of ['united', 'south', 'guin', 'arab', 'republic', 'saint', 'new', 'island', 'states', 'ger'])
      expect(['unknown', 'ambiguous'], `${partial} → ${JSON.stringify(resolveCountryGuess(partial))}`).toContain(resolveCountryGuess(partial).kind)
  })

  it('tolerates a single typo only in longer, unambiguous names', () => {
    expect(resolveCountryGuess('Columbia')).toEqual({ kind: 'country', code: 'COL', typoOf: 'Colombia' })
    expect(code('Phillipines')).toBe('PHL')
    expect(code('Austrailia')).toBe('AUS')
    expect(code('Irak')).toBe('unknown') // too short for typo tolerance
    expect(code('Mali')).toBe('MLI')
    expect(code('Malai')).toBe('unknown')
  })

  it('recognises parts of countries and territories', () => {
    expect(resolveCountryGuess('Scotland')).toEqual({ kind: 'partOf', place: 'Scotland', code: 'GBR' })
    expect(resolveCountryGuess('Greenland')).toMatchObject({ kind: 'territory', sovereign: 'DNK' })
    expect(resolveCountryGuess('Taiwan')).toMatchObject({ kind: 'territory', sovereign: null })
    expect(resolveCountryGuess('   ').kind).toBe('empty')
  })

  it('has no unexpected name collisions between countries', () => {
    const idx = getNameIndex()
    const collisions = [...idx.countries].filter(([, codes]) => codes.size > 1).map(([k]) => k)
    expect(collisions).toEqual([])
  })
})

describe('resolveCapitalGuess', () => {
  it('accepts every listed capital', () => {
    for (const c of COUNTRIES)
      for (const cap of acceptedCapitals(c.code))
        expect(resolveCapitalGuess(c.code, cap).kind, `${c.code} ${cap}`).toBe('correct')
  })
  it.each([
    ['USA', 'washington dc'],
    ['UKR', 'Kiev'],
    ['ZAF', 'Cape Town'],
    ['BOL', 'La Paz'],
    ['KAZ', 'Nur-Sultan'],
    ['COL', 'bogota'],
    ['ISL', 'Reykjavík'],
    ['TCD', "N'Djamena"],
  ])('%s accepts %s', (code, input) => {
    expect(resolveCapitalGuess(code, input).kind).toBe('correct')
  })
  it('flags the capital of a different country', () => {
    expect(resolveCapitalGuess('AUS', 'Wellington')).toEqual({ kind: 'otherCapital', code: 'NZL' })
  })
  it('rejects non-capitals and allows one typo', () => {
    expect(resolveCapitalGuess('AUS', 'Sydney').kind).toBe('wrong')
    expect(resolveCapitalGuess('TUR', 'Istanbul').kind).toBe('wrong')
    expect(resolveCapitalGuess('AUS', 'Canbera')).toEqual({ kind: 'correct', typoOf: 'Canberra' })
  })
})
