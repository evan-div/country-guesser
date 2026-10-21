import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  RGBAFormat,
  RingGeometry,
  Vector2,
  Vector3,
} from 'three'
import ConicPolygonGeometry from 'three-conic-polygon-geometry'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import type { WorldData } from '../../data/world'
import { GLOBE_RADIUS, polygonOutlines, polylinesToSegments, toCartesian } from '../geo'
import { GLOBE_THEME, LAYER_ALT } from '../theme'

export type TargetStyle = 'guess' | 'correct' | 'wrong' | 'reveal'

interface ShapeGeometry {
  fill: BufferGeometry
  outline: LineSegmentsGeometry
}

/** LRU cache of per-country fill + outline geometry, shared by every highlight. */
export class ShapeGeometryCache {
  private readonly map = new Map<string, ShapeGeometry>()
  private readonly pinned = new Set<string>()
  constructor(
    private readonly world: WorldData,
    private readonly limit = 48,
  ) {}

  has(code: string) {
    return this.map.has(code)
  }

  get(code: string): ShapeGeometry | null {
    const hit = this.map.get(code)
    if (hit) {
      this.map.delete(code)
      this.map.set(code, hit)
      return hit
    }
    const shape = this.world.byCode.get(code)
    if (!shape) return null
    const built = { fill: buildFill(shape.polygons), outline: buildOutline(shape.polygons) }
    this.map.set(code, built)
    this.evict()
    return built
  }

  /** Keep geometry alive while it is on screen. */
  pin(codes: Iterable<string>) {
    this.pinned.clear()
    for (const c of codes) this.pinned.add(c)
  }

  private evict() {
    for (const [code, g] of this.map) {
      if (this.map.size <= this.limit) break
      if (this.pinned.has(code)) continue
      g.fill.dispose()
      g.outline.dispose()
      this.map.delete(code)
    }
  }

  dispose() {
    for (const g of this.map.values()) {
      g.fill.dispose()
      g.outline.dispose()
    }
    this.map.clear()
  }
}

function buildFill(polygons: number[][][][]): BufferGeometry {
  const r = GLOBE_RADIUS * (1 + LAYER_ALT.fill)
  const chunks: Float32Array[] = []
  let total = 0
  for (const poly of polygons) {
    const g = new ConicPolygonGeometry(poly, r, r, false, true, false, 3)
    const flat = g.index ? g.toNonIndexed() : g
    const arr = flat.getAttribute('position').array as Float32Array
    chunks.push(arr)
    total += arr.length
    if (flat !== g) flat.dispose()
    g.dispose()
  }
  const positions = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    positions.set(c, offset)
    offset += c.length
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.computeBoundingSphere()
  return geometry
}

function buildOutline(polygons: number[][][][]): LineSegmentsGeometry {
  const g = new LineSegmentsGeometry()
  g.setPositions(polylinesToSegments(polygonOutlines(polygons), LAYER_ALT.outline, 0.5))
  return g
}

/** Vertical alpha ramp used for the microstate beacon pillar. */
function makeRampTexture(): DataTexture {
  const h = 64
  const data = new Uint8Array(h * 4)
  for (let i = 0; i < h; i++) {
    const t = i / (h - 1)
    const a = Math.round(255 * (1 - t) ** 1.6)
    data.set([a, a, a, 255], i * 4)
  }
  const tex = new DataTexture(data, 1, h, RGBAFormat)
  tex.needsUpdate = true
  return tex
}

interface HighlightMaterials {
  fill: MeshBasicMaterial
  core: LineMaterial
  halo: LineMaterial | null
}

class Highlight {
  readonly group = new Group()
  constructor(
    readonly code: string,
    geom: ShapeGeometry,
    mats: HighlightMaterials,
  ) {
    const fill = new Mesh(geom.fill, mats.fill)
    fill.renderOrder = 1
    const core = new LineSegments2(geom.outline, mats.core)
    core.renderOrder = 6
    this.group.add(fill, core)
    if (mats.halo) {
      const halo = new LineSegments2(geom.outline, mats.halo)
      halo.renderOrder = 5
      this.group.add(halo)
    }
  }
  dispose() {
    // Geometry is owned by the cache; materials by the layer.
    this.group.removeFromParent()
  }
}

/**
 * Everything that marks countries on the globe: the mystery target (pulsing fill, glowing
 * outline, microstate beacon), hint highlights for neighbours, and one-shot ripples.
 */
export class HighlightLayer {
  readonly group = new Group()
  readonly cache: ShapeGeometryCache

  private readonly targetFill = new MeshBasicMaterial({
    color: GLOBE_THEME.target,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
  private readonly targetCore = new LineMaterial({
    color: GLOBE_THEME.targetCore,
    linewidth: 2.4,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  })
  private readonly targetHalo = new LineMaterial({
    color: GLOBE_THEME.target,
    linewidth: 9,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  private readonly hintFill = new MeshBasicMaterial({
    color: GLOBE_THEME.hint,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
  private readonly hintCore = new LineMaterial({
    color: GLOBE_THEME.hint,
    linewidth: 1.8,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  })

  private target: Highlight | null = null
  private targetStyle: TargetStyle = 'guess'
  private hints: Highlight[] = []

  // Beacon (microstates) + ripple (lock-on / celebration)
  private readonly beacon = new Group()
  private readonly beaconRing: Mesh
  private readonly beaconRing2: Mesh
  private readonly pillar: Mesh
  private readonly ripple: Mesh
  private readonly beaconMat = new MeshBasicMaterial({
    color: GLOBE_THEME.target,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
  private readonly beaconMat2 = this.beaconMat.clone()
  private readonly pillarMat: MeshBasicMaterial
  private readonly rippleMat = new MeshBasicMaterial({
    color: GLOBE_THEME.target,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  })
  private readonly ringGeometry = new RingGeometry(0.78, 1, 64)
  private readonly thinRingGeometry = new RingGeometry(0.955, 1, 96)
  private readonly pillarGeometry: CylinderGeometry
  private readonly rampTexture = makeRampTexture()

  private beaconActive = false
  private beaconPoint = new Vector3()
  private rippleT = 1
  private rippleDuration = 900
  private rippleMaxScale = 1
  private flash = 0
  private time = 0
  private readonly tmpQ = new Quaternion()

  constructor(world: WorldData) {
    this.cache = new ShapeGeometryCache(world)

    this.beaconRing = new Mesh(this.ringGeometry, this.beaconMat)
    this.beaconRing2 = new Mesh(this.thinRingGeometry, this.beaconMat2)
    this.pillarMat = new MeshBasicMaterial({
      color: GLOBE_THEME.target,
      transparent: true,
      opacity: 0.85,
      alphaMap: this.rampTexture,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    })
    this.pillarGeometry = new CylinderGeometry(0.6, 1, 1, 20, 1, true)
    this.pillarGeometry.translate(0, 0.5, 0)
    this.pillar = new Mesh(this.pillarGeometry, this.pillarMat)
    // Rings lie flat on the surface: rotate them from the XY plane into the tangent plane.
    this.beaconRing.rotation.set(-Math.PI / 2, 0, 0)
    this.beaconRing2.rotation.set(-Math.PI / 2, 0, 0)
    this.beacon.add(this.beaconRing, this.beaconRing2, this.pillar)
    this.beacon.visible = false
    this.beaconRing.renderOrder = 7
    this.beaconRing2.renderOrder = 7
    this.pillar.renderOrder = 8

    this.ripple = new Mesh(this.thinRingGeometry, this.rippleMat)
    this.ripple.visible = false
    this.ripple.renderOrder = 9

    this.group.add(this.beacon, this.ripple)
  }

  setResolution(res: Vector2) {
    for (const m of [this.targetCore, this.targetHalo, this.hintCore]) m.resolution.copy(res)
  }

  /** Pre-build geometry (e.g. for the next round while the player reads feedback). */
  prepare(code: string) {
    this.cache.get(code)
  }

  setTarget(code: string | null, opts: { beacon?: boolean; lat?: number; lng?: number } = {}) {
    if (this.target?.code !== code) {
      this.target?.dispose()
      this.target = null
      if (code) {
        const geom = this.cache.get(code)
        if (geom) {
          this.target = new Highlight(code, geom, { fill: this.targetFill, core: this.targetCore, halo: this.targetHalo })
          this.group.add(this.target.group)
        }
      }
    }
    this.beaconActive = Boolean(code && opts.beacon && opts.lat !== undefined && opts.lng !== undefined)
    if (this.beaconActive) {
      const p = toCartesian(opts.lat!, opts.lng!, LAYER_ALT.beacon)
      this.beaconPoint.set(p[0], p[1], p[2])
      this.beacon.position.copy(this.beaconPoint)
      const normal = this.beaconPoint.clone().normalize()
      this.beacon.quaternion.copy(this.tmpQ.setFromUnitVectors(new Vector3(0, 1, 0), normal))
    }
    this.beacon.visible = this.beaconActive
    this.setTargetStyle('guess')
    this.syncPins()
  }

  setTargetStyle(style: TargetStyle) {
    this.targetStyle = style
    const color =
      style === 'correct' ? GLOBE_THEME.correct : style === 'wrong' ? GLOBE_THEME.wrong : GLOBE_THEME.target
    this.targetFill.color.setHex(color)
    this.targetHalo.color.setHex(color)
    this.targetCore.color.setHex(style === 'wrong' ? 0xffe2d8 : GLOBE_THEME.targetCore)
    this.beaconMat.color.setHex(color)
    this.beaconMat2.color.setHex(color)
    this.pillarMat.color.setHex(color)
    if (style === 'correct') this.flash = 1
  }

  setHints(codes: string[]) {
    const keep = new Set(codes)
    this.hints = this.hints.filter((h) => {
      if (keep.has(h.code)) return true
      h.dispose()
      return false
    })
    for (const code of codes) {
      if (this.hints.some((h) => h.code === code)) continue
      const geom = this.cache.get(code)
      if (!geom) continue
      const h = new Highlight(code, geom, { fill: this.hintFill, core: this.hintCore, halo: null })
      this.hints.push(h)
      this.group.add(h.group)
    }
    this.syncPins()
  }

  /** Expanding ring centred on a point — used for lock-on and celebrations. */
  pulseAt(lat: number, lng: number, opts: { color?: number; durationMs?: number; scale?: number } = {}) {
    const p = toCartesian(lat, lng, LAYER_ALT.beacon)
    this.ripple.position.set(p[0], p[1], p[2])
    this.ripple.lookAt(p[0] * 2, p[1] * 2, p[2] * 2)
    this.rippleMat.color.setHex(opts.color ?? GLOBE_THEME.target)
    this.rippleDuration = opts.durationMs ?? 900
    this.rippleMaxScale = opts.scale ?? 1
    this.rippleT = 0
    this.ripple.visible = true
  }

  clear() {
    this.setTarget(null)
    this.setHints([])
  }

  /** Per-frame animation. `camAltitude` is the camera's height above the surface (globe units). */
  tick(dtMs: number, camAltitude: number, animate: boolean) {
    this.time += dtMs / 1000
    const t = this.time
    const pulse = animate ? (Math.sin(t * Math.PI * 1.6) + 1) / 2 : 0.5
    this.flash = Math.max(0, this.flash - dtMs / 700)
    const base = this.targetStyle === 'guess' ? 0.16 : 0.22
    this.targetFill.opacity = base + pulse * 0.12 + this.flash * 0.45
    // Thinner glow when zoomed out so big, intricate coastlines don't turn into a blob.
    const zoomK = Math.min(1, Math.max(0.3, 1.25 / (0.55 + camAltitude / GLOBE_RADIUS)))
    this.targetHalo.opacity = 0.2 + pulse * 0.18 + this.flash * 0.45
    this.targetHalo.linewidth = (6.5 + pulse * 2.5 + this.flash * 7) * zoomK
    this.targetCore.linewidth = 2.4 * Math.max(0.65, zoomK)
    this.hintFill.opacity = 0.1 + pulse * 0.08

    // Screen-constant sizes: scale with camera distance to the surface.
    const s = Math.max(0.05, camAltitude) * 0.05
    if (this.beaconActive) {
      const ringPhase = animate ? (t * 0.9) % 1 : 0.4
      this.beaconRing.scale.setScalar(s * 0.55)
      this.beaconRing2.scale.setScalar(s * (0.6 + ringPhase * 1.6))
      this.beaconMat2.opacity = 0.9 * (1 - ringPhase)
      this.beaconMat.opacity = 0.75 + pulse * 0.25
      this.pillar.scale.set(s * 0.09, s * 5, s * 0.09)
    }

    if (this.ripple.visible) {
      this.rippleT = Math.min(1, this.rippleT + dtMs / this.rippleDuration)
      const e = 1 - (1 - this.rippleT) ** 3
      this.ripple.scale.setScalar(s * (1 + e * 8) * this.rippleMaxScale)
      this.rippleMat.opacity = (1 - this.rippleT) ** 1.5 * 0.75
      if (this.rippleT >= 1) this.ripple.visible = false
    }
  }

  private syncPins() {
    const codes = [this.target?.code, ...this.hints.map((h) => h.code)].filter(Boolean) as string[]
    this.cache.pin(codes)
  }

  dispose() {
    this.clear()
    this.cache.dispose()
    for (const m of [
      this.targetFill,
      this.targetCore,
      this.targetHalo,
      this.hintFill,
      this.hintCore,
      this.beaconMat,
      this.beaconMat2,
      this.pillarMat,
      this.rippleMat,
    ])
      m.dispose()
    this.ringGeometry.dispose()
    this.thinRingGeometry.dispose()
    this.pillarGeometry.dispose()
    this.rampTexture.dispose()
    this.group.removeFromParent()
  }
}
