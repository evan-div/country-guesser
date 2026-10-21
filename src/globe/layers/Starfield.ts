import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three'

/** A cheap starfield: one Points draw call, deterministic layout, slow ambient drift. */
export class Starfield {
  readonly points: Points
  private readonly geometry = new BufferGeometry()
  private readonly material: PointsMaterial

  constructor(count = 2400, radius = 9000) {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    let seed = 1337
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1
      const th = rand() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      pos[i * 3] = radius * s * Math.cos(th)
      pos[i * 3 + 1] = radius * u
      pos[i * 3 + 2] = radius * s * Math.sin(th)
      const b = 0.35 + rand() ** 3 * 0.65
      const tint = rand()
      col[i * 3] = b * (tint > 0.8 ? 0.8 : 1)
      col[i * 3 + 1] = b * (tint > 0.8 ? 0.9 : 1)
      col[i * 3 + 2] = b
    }
    this.geometry.setAttribute('position', new BufferAttribute(pos, 3))
    this.geometry.setAttribute('color', new BufferAttribute(col, 3))
    this.material = new PointsMaterial({
      size: 1.7,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
    this.points = new Points(this.geometry, this.material)
    this.points.renderOrder = -1
    this.points.frustumCulled = false
  }

  tick(dt: number) {
    this.points.rotation.y += dt * 0.004
  }

  dispose() {
    this.points.removeFromParent()
    this.geometry.dispose()
    this.material.dispose()
  }
}
