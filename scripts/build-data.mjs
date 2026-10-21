// Builds ATLAS RUSH's geographic data from two sources:
//   • Natural Earth 1:50m Admin-0 countries (public domain) — polygons, label points
//   • world-countries (mledoze/countries, ODbL) — names, capitals, borders, regions, flags
//
// Outputs (both committed so the app runs without network access):
//   • public/data/world.topo.json        simplified TopoJSON, one object per country/neutral land
//   • src/data/generated/countries.json  metadata for the 195 playable sovereign states
//
// The script cross-references every country explicitly and exits non-zero if any of
// the 195 states is missing geometry, metadata, a capital or a camera focus.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { feature } from 'topojson-client'
import { geoArea, geoCentroid } from 'd3-geo'

const require = createRequire(import.meta.url)
const mapshaper = require('mapshaper')
const worldCountries = require('world-countries')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NE_FILE = join(ROOT, 'data-src', 'ne_50m_admin_0_countries.geojson')
const OUT_TOPO = join(ROOT, 'public', 'data', 'world.topo.json')
const OUT_META = join(ROOT, 'src', 'data', 'generated', 'countries.json')

const EXPECTED_COUNT = 195
const D2R = Math.PI / 180
const R2D = 180 / Math.PI

// Natural Earth breaks some sovereign states into several features. These are folded
// into the internationally recognised state (UN view) so the whole territory highlights.
const MERGE_INTO = {
  SOL: 'SOM', // Somaliland → Somalia
  CYN: 'CYP', // Northern Cyprus → Cyprus
}

// Corrections to world-countries land borders, verified against Natural Earth geometry.
const BORDER_REMOVALS = [
  ['LKA', 'IND'], // Sri Lanka has no land border with India (Adam's Bridge is a chain of shoals)
]
// French Guiana is an integral part of France (and of France's polygon here), so France
// borders Brazil and Suriname. world-countries lists French Guiana separately.
const BORDER_ADDITIONS = [
  ['FRA', 'BRA'],
  ['FRA', 'SUR'],
]

// Natural Earth sovereignty codes for dependencies → the playable sovereign state.
const SOVEREIGN_OF = { US1: 'USA', GB1: 'GBR', FR1: 'FRA', NL1: 'NLD', DN1: 'DNK', NZ1: 'NZL', AU1: 'AUS', CH1: 'CHN', FI1: 'FIN' }

const errors = []
const fail = (msg) => errors.push(msg)

// ---------------------------------------------------------------------------
// 1. The 195 playable states: 193 UN members + Holy See + Palestine.
//    world-countries flags Vatican City as a UN member, so we key on an explicit
//    observer list and verify the final count rather than trusting the flag.
// ---------------------------------------------------------------------------
const OBSERVERS = ['VAT', 'PSE']
const meta = new Map()
for (const c of worldCountries) {
  if (c.unMember || OBSERVERS.includes(c.cca3)) meta.set(c.cca3, c)
}
if (meta.size !== EXPECTED_COUNT) {
  fail(`Expected ${EXPECTED_COUNT} sovereign states in world-countries, found ${meta.size}`)
}

// ---------------------------------------------------------------------------
// 2. Assign every Natural Earth feature to a playable code (or mark it neutral).
// ---------------------------------------------------------------------------
const ne = JSON.parse(await readFile(NE_FILE, 'utf8'))
const labelPoints = new Map() // code -> [lng, lat] from the "home" feature
const neNames = new Map() // code -> Set of English names from Natural Earth
const neutralNames = []
const territories = [] // non-playable land, so typed answers like "Greenland" are recognised

function codeFor(p) {
  for (const key of ['ISO_A3', 'ISO_A3_EH', 'ADM0_A3']) {
    const v = p[key]
    if (v && v !== '-99' && meta.has(v)) return v
  }
  const merged = MERGE_INTO[p.ADM0_A3]
  return merged ?? null
}

for (const f of ne.features) {
  const p = f.properties
  const code = codeFor(p)
  if (code) {
    // The feature whose own ADM0 code matches is the country's homeland; use its label point.
    const isHome = p.ADM0_A3 === code || p.ISO_A3 === code
    if (isHome || !labelPoints.has(code)) labelPoints.set(code, [p.LABEL_X, p.LABEL_Y])
    if (isHome) {
      const names = neNames.get(code) ?? new Set()
      for (const k of ['NAME', 'NAME_LONG', 'NAME_EN', 'FORMAL_EN', 'ADMIN']) {
        if (p[k] && typeof p[k] === 'string') names.add(p[k])
      }
      neNames.set(code, names)
    }
    f.properties = { c: code }
  } else {
    neutralNames.push(p.NAME)
    if (p.ADM0_A3 !== 'ATA') {
      const names = [...new Set([p.NAME_EN, p.NAME_LONG, p.ADMIN, p.NAME, p.FORMAL_EN].filter((n) => n && n.length > 2))]
      territories.push({
        name: p.NAME_EN || p.NAME_LONG || p.NAME,
        names,
        sovereign: SOVEREIGN_OF[p.SOV_A3] ?? null,
        status: p.TYPE,
      })
    }
    f.properties = { c: `_${p.ADM0_A3}` }
  }
}

for (const code of meta.keys()) {
  if (!labelPoints.has(code)) fail(`No Natural Earth geometry for ${code} (${meta.get(code).name.common})`)
}

// ---------------------------------------------------------------------------
// 3. Dissolve per code, simplify (keeping microstates), emit quantized TopoJSON.
// ---------------------------------------------------------------------------
const outputs = await mapshaper.applyCommands(
  '-i ne.json -dissolve2 c -simplify 38% keep-shapes -rename-layers countries ' +
    '-o format=topojson quantization=60000 out.json',
  { 'ne.json': ne },
)
const topoText = outputs['out.json'].toString()
const topo = JSON.parse(topoText)
const geo = feature(topo, topo.objects.countries)

// ---------------------------------------------------------------------------
// 4. Geometry analysis: winding, camera focus, tiny flag, nearby countries.
// ---------------------------------------------------------------------------
const toVec = ([lng, lat]) => {
  const phi = lat * D2R
  const lam = lng * D2R
  return [Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi)]
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * R2D
const normalize = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const toLngLat = (v) => [Math.atan2(v[1], v[0]) * R2D, Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D]
const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d

function polygonsOf(geometry) {
  if (!geometry) return []
  if (geometry.type === 'Polygon') return [geometry.coordinates]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates
  return []
}

const geomByCode = new Map()
let totalVertices = 0
for (const f of geo.features) {
  const polys = polygonsOf(f.geometry)
  for (const poly of polys) {
    const area = geoArea({ type: 'Polygon', coordinates: poly })
    if (area > 2 * Math.PI) fail(`Inverted winding in ${f.properties.c}`)
    totalVertices += poly.reduce((n, ring) => n + ring.length, 0)
  }
  if (!f.properties.c.startsWith('_')) geomByCode.set(f.properties.c, polys)
}

function analyse(code) {
  const polys = geomByCode.get(code)
  const parts = polys.map((poly) => {
    const verts = poly[0].map(toVec)
    const area = geoArea({ type: 'Polygon', coordinates: poly })
    const centroid = toVec(geoCentroid({ type: 'Polygon', coordinates: poly }))
    return { verts, area, centroid }
  })
  const totalArea = parts.reduce((s, p) => s + p.area, 0)
  const largest = parts.reduce((a, b) => (b.area > a.area ? b : a))
  const label = toVec(labelPoints.get(code))

  // Which polygons belong in the camera frame?
  let cluster
  if (largest.area / totalArea >= 0.5) {
    // Mainland-dominated: frame the homeland and ignore distant territories
    // (French Guiana, Hawaii, the Aleutians beyond the date line, etc.).
    const rMain = Math.max(...largest.verts.map((v) => angle(largest.centroid, v)))
    const reach = Math.max(10, rMain * 1.25)
    cluster = parts.filter((p) => angle(largest.centroid, p.centroid) <= reach)
  } else {
    // Archipelago: the spread of islands around Natural Earth's label point.
    cluster = parts.filter((p) => angle(label, p.centroid) <= 45)
  }
  // Camera centre = area-weighted spherical centroid of the framed polygons.
  const sum = cluster.reduce(
    (s, p) => [s[0] + p.centroid[0] * p.area, s[1] + p.centroid[1] * p.area, s[2] + p.centroid[2] * p.area],
    [0, 0, 0],
  )
  const center = normalize(sum)
  let radius = 0
  for (const p of cluster) for (const v of p.verts) radius = Math.max(radius, angle(center, v))
  const [lng, lat] = toLngLat(center)
  const [labelLng, labelLat] = labelPoints.get(code)
  return {
    focus: { lat: round(lat), lng: round(lng), radius: round(Math.max(radius, 0.05), 3) },
    // Natural Earth's label point is guaranteed to sit inside the country — used for
    // labels and microstate beacons (a centroid can fall outside, e.g. Croatia).
    label: { lat: round(labelLat), lng: round(labelLng) },
    samples: parts.flatMap((p) => p.verts.filter((_, i) => i % Math.max(1, Math.floor(p.verts.length / 160)) === 0)),
    centerVec: center,
    radius,
  }
}

const analysis = new Map()
for (const code of meta.keys()) {
  if (geomByCode.has(code)) analysis.set(code, analyse(code))
}

// Nearest other countries (by sampled polygon distance) — used for island hints.
function nearestCountries(code, count = 3) {
  const a = analysis.get(code)
  const dists = []
  for (const [other, b] of analysis) {
    if (other === code) continue
    // Cheap prefilter on bounding caps.
    if (angle(a.centerVec, b.centerVec) - a.radius - b.radius > 40) continue
    let best = Infinity
    for (const va of a.samples) for (const vb of b.samples) best = Math.min(best, angle(va, vb))
    dists.push([other, best])
  }
  dists.sort((x, y) => x[1] - y[1])
  return dists.slice(0, count).map(([c, d]) => ({ code: c, km: Math.round(d * D2R * 6371) }))
}

// ---------------------------------------------------------------------------
// 5. Metadata join.
// ---------------------------------------------------------------------------
function continentOf(c) {
  if (c.region === 'Americas') return c.subregion === 'South America' ? 'South America' : 'North America'
  return c.region
}

const countries = []
for (const [code, c] of [...meta].sort((a, b) => a[1].name.common.localeCompare(b[1].name.common))) {
  const a = analysis.get(code)
  if (!a) continue
  if (!c.capital?.length) fail(`${code} has no capital`)
  const removed = BORDER_REMOVALS.filter(([a]) => a === code).map(([, b]) => b)
  const added = BORDER_ADDITIONS.flatMap(([a, b]) => (a === code ? [b] : b === code ? [a] : []))
  const neighbors = [...new Set([...(c.borders ?? []), ...added])]
    .filter((b) => meta.has(b) && !removed.includes(b))
    .sort()
  const aliases = new Set([c.name.official, ...(c.altSpellings ?? []), ...(neNames.get(code) ?? [])])
  aliases.delete(c.name.common)
  countries.push({
    code,
    iso2: c.cca2,
    isoNumeric: c.ccn3 || null,
    name: c.name.common,
    official: c.name.official,
    aliases: [...aliases].filter((s) => s && s.length > 2),
    continent: continentOf(c),
    subregion: c.subregion,
    capitals: c.capital,
    neighbors,
    nearby: nearestCountries(code),
    landlocked: Boolean(c.landlocked),
    area: c.area,
    flag: c.flag,
    languages: Object.values(c.languages ?? {}).slice(0, 4),
    currencies: Object.values(c.currencies ?? {}).map((x) => x.name).slice(0, 2),
    focus: a.focus,
    label: a.label,
  })
}

// Neighbor symmetry check — asymmetric borders would make Neighbors Mode inconsistent.
const byCode = new Map(countries.map((c) => [c.code, c]))
for (const c of countries) {
  for (const n of c.neighbors) {
    if (!byCode.get(n)?.neighbors.includes(c.code)) fail(`Asymmetric border ${c.code} ↔ ${n}`)
  }
}
if (countries.length !== EXPECTED_COUNT) fail(`Built ${countries.length} countries, expected ${EXPECTED_COUNT}`)

if (errors.length) {
  console.error('✗ Data build failed:')
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}

await mkdir(dirname(OUT_TOPO), { recursive: true })
await mkdir(dirname(OUT_META), { recursive: true })
await writeFile(OUT_TOPO, topoText)
await writeFile(OUT_META, JSON.stringify(countries, null, 1) + '\n')
await writeFile(
  join(dirname(OUT_META), 'territories.json'),
  JSON.stringify(territories.sort((a, b) => a.name.localeCompare(b.name)), null, 1) + '\n',
)

const tiny = countries.filter((c) => c.focus.radius < 1).map((c) => c.code)
console.log(`✓ ${countries.length} playable countries, ${neutralNames.length} neutral features`)
console.log(`✓ ${totalVertices.toLocaleString()} vertices after simplification`)
console.log(`✓ world.topo.json ${(topoText.length / 1024).toFixed(0)} KB`)
console.log(`  microstates (focus radius < 1°): ${tiny.join(', ')}`)
console.log(`  neutral (non-playable) land: ${neutralNames.join(', ')}`)
