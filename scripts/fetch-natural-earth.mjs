// Downloads the pinned Natural Earth 1:50m Admin-0 countries dataset into data-src/.
// Natural Earth is public domain: https://www.naturalearthdata.com/about/terms-of-use/
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NE_VERSION = 'v5.1.2'
const FILE = 'ne_50m_admin_0_countries.geojson'
const URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_VERSION}/geojson/${FILE}`
const OUT = join(ROOT, 'data-src', FILE)

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

if ((await exists(OUT)) && !process.argv.includes('--force')) {
  console.log(`✓ ${FILE} already present (use --force to re-download)`)
  process.exit(0)
}

console.log(`↓ Natural Earth ${NE_VERSION}: ${URL}`)
const res = await fetch(URL)
if (!res.ok) {
  console.error(`✗ Download failed: HTTP ${res.status}`)
  process.exit(1)
}
const text = await res.text()
const parsed = JSON.parse(text)
if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
  console.error('✗ Unexpected file format')
  process.exit(1)
}
await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, text)
console.log(`✓ Saved ${parsed.features.length} features → data-src/${FILE}`)
