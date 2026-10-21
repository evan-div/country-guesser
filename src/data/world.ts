import { feature, mesh } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { MultiPolygon, Polygon, Position } from 'geojson'

/** A polygon as GeoJSON rings: [exterior, ...holes], each ring a list of [lng, lat]. */
export type PolygonCoords = Position[][]

export interface WorldShape {
  /** ISO alpha-3 for playable states, null for neutral (non-playable) land. */
  code: string | null
  polygons: PolygonCoords[]
}

export interface WorldData {
  shapes: WorldShape[]
  byCode: Map<string, WorldShape>
  /** Shared land borders, each drawn once. */
  landBorders: Position[][]
  /** Coastlines (arcs used by a single shape). */
  coastlines: Position[][]
}

let cache: Promise<WorldData> | null = null

export function loadWorld(): Promise<WorldData> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}data/world.topo.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load map data (HTTP ${r.status})`)
        return r.json() as Promise<Topology>
      })
      .then(parseWorld)
      .catch((err) => {
        cache = null
        throw err
      })
  }
  return cache
}

type CountryProps = { c: string }

export function parseWorld(topo: Topology): WorldData {
  const obj = topo.objects.countries as GeometryCollection<CountryProps>
  const fc = feature(topo, obj)
  const shapes: WorldShape[] = []
  const byCode = new Map<string, WorldShape>()
  for (const f of fc.features) {
    const g = f.geometry as Polygon | MultiPolygon | null
    if (!g) continue
    const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    const raw = f.properties?.c ?? ''
    const shape: WorldShape = { code: raw.startsWith('_') ? null : raw, polygons }
    shapes.push(shape)
    if (shape.code) byCode.set(shape.code, shape)
  }
  const landBorders = mesh(topo, obj, (a, b) => a !== b).coordinates
  const coastlines = mesh(topo, obj, (a, b) => a === b).coordinates
  return { shapes, byCode, landBorders, coastlines }
}
