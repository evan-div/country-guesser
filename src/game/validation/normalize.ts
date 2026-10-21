const SPECIAL: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ı: 'i',
}

/**
 * Canonical form of a typed place name: accents stripped, lowercase, "&" → "and",
 * apostrophes dropped, other punctuation → spaces, "St." → "saint", leading "the"
 * removed, whitespace collapsed.
 *   "  Côte d’Ivoire " → "cote divoire",  "St. Lucia" → "saint lucia"
 */
export function normalizeName(input: string): string {
  let s = input.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  s = s.replace(/[ßæœøłđðþı]/g, (ch) => SPECIAL[ch] ?? ch)
  s = s.replace(/&/g, ' and ')
  s = s.replace(/['’‘`´ʻʼ]/g, '')
  s = s.replace(/[^a-z0-9]+/g, ' ').trim()
  s = s.replace(/\bst\b/g, 'saint')
  s = s.replace(/^the /, '')
  return s.replace(/\s+/g, ' ')
}

/** Matching key: the normalized name without spaces ("united states" → "unitedstates"). */
export function nameKey(input: string): string {
  return normalizeName(input).replace(/ /g, '')
}

/** Damerau–Levenshtein distance (optimal string alignment), capped for speed. */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0)
    row[0] = i
    return row
  })
  for (let j = 0; j < cols; j++) d[0][j] = j
  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1)
      d[i][j] = v
      rowMin = Math.min(rowMin, v)
    }
    if (rowMin > max) return max + 1
  }
  return d[a.length][b.length]
}
