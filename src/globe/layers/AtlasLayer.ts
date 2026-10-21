import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three'
import type { ShapeGeometryCache } from './HighlightLayer'
import { GLOBE_THEME } from '../theme'

export interface AtlasPaint {
  learning: string[]
  mastered: string[]
}

type Bucket = 'learning' | 'mastered'

/**
 * Paints the player's discovered countries onto the globe for the World Atlas view.
 * Each bucket is merged into a single mesh; geometry is gathered a few countries per
 * frame so opening the Atlas never stalls the main thread.
 */
export class AtlasLayer {
  readonly group = new Group()
  private readonly meshes: Record<Bucket, Mesh>
  private readonly materials: Record<Bucket, MeshBasicMaterial>
  private queue: [Bucket, string][] = []
  private chunks: Record<Bucket, Float32Array[]> = { learning: [], mastered: [] }
  private fade = 0
  private active = false

  constructor(private readonly cache: ShapeGeometryCache) {
    const mat = (color: number) =>
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      })
    this.materials = { learning: mat(GLOBE_THEME.discovered), mastered: mat(GLOBE_THEME.mastered) }
    this.meshes = {
      learning: new Mesh(new BufferGeometry(), this.materials.learning),
      mastered: new Mesh(new BufferGeometry(), this.materials.mastered),
    }
    for (const m of Object.values(this.meshes)) {
      m.renderOrder = 1
      m.visible = false
      this.group.add(m)
    }
  }

  setPaint(paint: AtlasPaint | null) {
    this.queue = []
    this.chunks = { learning: [], mastered: [] }
    this.active = Boolean(paint)
    this.fade = 0
    if (!paint) {
      for (const m of Object.values(this.meshes)) m.visible = false
      return
    }
    this.queue = [
      ...paint.mastered.map((c) => ['mastered', c] as [Bucket, string]),
      ...paint.learning.map((c) => ['learning', c] as [Bucket, string]),
    ]
    if (!this.queue.length) this.flush()
  }

  tick(dtMs: number) {
    if (!this.active) return
    if (this.queue.length) {
      const started = performance.now()
      while (this.queue.length && performance.now() - started < 6) {
        const [bucket, code] = this.queue.shift()!
        const g = this.cache.get(code)
        if (g) this.chunks[bucket].push(g.fill.getAttribute('position').array as Float32Array)
      }
      if (!this.queue.length) this.flush()
      return
    }
    this.fade = Math.min(1, this.fade + dtMs / 600)
    this.materials.learning.opacity = 0.26 * this.fade
    this.materials.mastered.opacity = 0.34 * this.fade
  }

  private flush() {
    for (const bucket of ['learning', 'mastered'] as Bucket[]) {
      const parts = this.chunks[bucket]
      const total = parts.reduce((n, p) => n + p.length, 0)
      const positions = new Float32Array(total)
      let o = 0
      for (const p of parts) {
        positions.set(p, o)
        o += p.length
      }
      const mesh = this.meshes[bucket]
      mesh.geometry.dispose()
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new BufferAttribute(positions, 3))
      geometry.computeBoundingSphere()
      mesh.geometry = geometry
      mesh.visible = total > 0
    }
    this.chunks = { learning: [], mastered: [] }
  }

  dispose() {
    this.group.removeFromParent()
    for (const m of Object.values(this.meshes)) m.geometry.dispose()
    for (const m of Object.values(this.materials)) m.dispose()
  }
}
