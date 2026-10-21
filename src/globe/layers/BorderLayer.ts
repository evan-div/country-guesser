import { BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, Vector2 } from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import type { WorldData } from '../../data/world'
import { polylinesToSegments } from '../geo'
import { GLOBE_THEME, LAYER_ALT } from '../theme'

/**
 * All borders on the globe in two draw calls: shared land borders as screen-space fat
 * lines (crisp on high-DPI phones), coastlines as thin native lines. Built once.
 */
export class BorderLayer {
  readonly group = new Group()
  private readonly landMaterial: LineMaterial
  private readonly coastMaterial: LineBasicMaterial
  private readonly disposables: { dispose(): void }[] = []

  constructor(world: WorldData) {
    const landPositions = polylinesToSegments(world.landBorders, LAYER_ALT.borders)
    const landGeometry = new LineSegmentsGeometry()
    landGeometry.setPositions(landPositions)
    this.landMaterial = new LineMaterial({
      color: GLOBE_THEME.landBorder,
      linewidth: 1.1,
      transparent: true,
      opacity: GLOBE_THEME.landBorderOpacity,
      depthWrite: false,
    })
    const land = new LineSegments2(landGeometry, this.landMaterial)
    land.renderOrder = 3

    const coastGeometry = new BufferGeometry()
    coastGeometry.setAttribute('position', new BufferAttribute(polylinesToSegments(world.coastlines, LAYER_ALT.borders), 3))
    this.coastMaterial = new LineBasicMaterial({
      color: GLOBE_THEME.coastline,
      transparent: true,
      opacity: GLOBE_THEME.coastlineOpacity,
      depthWrite: false,
    })
    const coast = new LineSegments(coastGeometry, this.coastMaterial)
    coast.renderOrder = 2

    this.group.add(coast, land)
    this.disposables.push(landGeometry, this.landMaterial, coastGeometry, this.coastMaterial)
  }

  setResolution(res: Vector2) {
    this.landMaterial.resolution.copy(res)
  }

  /** Dim borders (e.g. behind the Atlas overlay) without rebuilding anything. */
  setEmphasis(level: number) {
    this.landMaterial.opacity = GLOBE_THEME.landBorderOpacity * level
    this.coastMaterial.opacity = GLOBE_THEME.coastlineOpacity * level
  }

  dispose() {
    this.group.removeFromParent()
    for (const d of this.disposables) d.dispose()
  }
}
