import { AmbientLight, DirectionalLight, Vector2, Vector3 } from 'three'
import type { GlobeMethods } from 'react-globe.gl'
import type { WorldData } from '../data/world'
import { getCountry, isMicrostate } from '../data/countries'
import { BorderLayer } from './layers/BorderLayer'
import { HighlightLayer, type TargetStyle } from './layers/HighlightLayer'
import { AtlasLayer, type AtlasPaint } from './layers/AtlasLayer'
import { Starfield } from './layers/Starfield'
import { CameraDirector } from './camera/CameraDirector'
import { altitudeForFocus, OVERVIEW_ALTITUDE, type Pov } from './camera/flight'
import { GLOBE_RADIUS } from './geo'
import { GLOBE_THEME } from './theme'

export type Quality = 'high' | 'balanced' | 'saver'

export const PIXEL_RATIO_CAP: Record<Quality, number> = { high: 2, balanced: 1.5, saver: 1 }

/** Resolve "auto" quality from the device: small/low-memory devices get the lighter profile. */
export function detectQuality(): Quality {
  if (typeof navigator === 'undefined') return 'balanced'
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const cores = navigator.hardwareConcurrency ?? 4
  if ((mem !== undefined && mem <= 2) || cores <= 2) return 'saver'
  if ((mem === undefined || mem >= 6) && cores >= 6) return 'high'
  return 'balanced'
}

/**
 * Imperative controller around the single react-globe.gl instance. Owns the custom
 * Three.js layers, lighting, the per-frame animation loop and the camera director.
 * Nothing here is recreated between rounds.
 */
export class GlobeEngine {
  readonly director: CameraDirector
  private readonly borders: BorderLayer
  private readonly highlights: HighlightLayer
  private readonly atlas: AtlasLayer
  private readonly stars: Starfield
  private readonly size = new Vector2(1, 1)
  private readonly sun: DirectionalLight | undefined
  private readonly tmp = new Vector3()
  private readonly up = new Vector3(0, 1, 0)
  private raf = 0
  private last = 0
  private animations = true
  private paused = false
  private contextListeners: ((lost: boolean) => void)[] = []
  private readonly onLost = () => this.contextListeners.forEach((l) => l(true))
  private readonly onRestored = () => this.contextListeners.forEach((l) => l(false))
  private readonly onVisibility = () => this.setPaused(document.hidden)

  constructor(
    private readonly globe: GlobeMethods,
    readonly world: WorldData,
  ) {
    const scene = globe.scene()
    this.borders = new BorderLayer(world)
    this.highlights = new HighlightLayer(world)
    this.atlas = new AtlasLayer(this.highlights.cache)
    this.stars = new Starfield()
    scene.add(this.stars.points, this.atlas.group, this.borders.group, this.highlights.group)

    // Softer ambient + a key light that follows the camera for a consistent ocean glint.
    const lights = globe.lights()
    for (const l of lights) {
      if (l instanceof AmbientLight) l.intensity = 0.62 * Math.PI
      if (l instanceof DirectionalLight) l.intensity = 1.25 * Math.PI
    }
    this.sun = lights.find((l): l is DirectionalLight => l instanceof DirectionalLight)

    const controls = globe.controls()
    controls.minDistance = GLOBE_RADIUS * 1.12
    controls.maxDistance = GLOBE_RADIUS * 5.5
    controls.zoomToCursor = false

    this.director = new CameraDirector(globe)

    const canvas = globe.renderer().domElement
    canvas.addEventListener('webglcontextlost', this.onLost)
    canvas.addEventListener('webglcontextrestored', this.onRestored)
    document.addEventListener('visibilitychange', this.onVisibility)

    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
  }

  private loop(now: number) {
    const dt = this.last ? Math.min(100, now - this.last) : 16
    this.last = now
    const cam = this.globe.camera()
    const camAltitude = cam.position.length() - GLOBE_RADIUS
    this.highlights.tick(dt, camAltitude, this.animations)
    this.atlas.tick(dt)
    if (this.animations) this.stars.tick(dt / 1000)
    if (this.sun) {
      // Key light from the viewer's upper-left.
      this.tmp.copy(cam.position).normalize().applyAxisAngle(this.up, 0.55)
      this.tmp.y += 0.35
      this.sun.position.copy(this.tmp.multiplyScalar(GLOBE_RADIUS * 4))
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  onContextChange(listener: (lost: boolean) => void): () => void {
    this.contextListeners.push(listener)
    return () => {
      this.contextListeners = this.contextListeners.filter((l) => l !== listener)
    }
  }

  setSize(width: number, height: number) {
    this.size.set(Math.max(1, width), Math.max(1, height))
    this.borders.setResolution(this.size)
    this.highlights.setResolution(this.size)
  }

  setQuality(q: Quality) {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    this.globe.renderer().setPixelRatio(Math.min(dpr, PIXEL_RATIO_CAP[q]))
  }

  setAnimationsEnabled(on: boolean) {
    this.animations = on
  }

  setPaused(paused: boolean) {
    if (paused === this.paused) return
    this.paused = paused
    if (paused) {
      this.globe.pauseAnimation()
      cancelAnimationFrame(this.raf)
    } else {
      this.last = 0
      this.globe.resumeAnimation()
      this.raf = requestAnimationFrame(this.loop)
    }
  }

  /** Camera pose that frames a country for the current viewport. */
  focusPov(code: string): Pov {
    const c = getCountry(code)
    return {
      lat: c.focus.lat,
      lng: c.focus.lng,
      altitude: altitudeForFocus(c.focus.radius, this.size.x, this.size.y),
    }
  }

  flyToCountry(code: string, opts: { instant?: boolean } = {}): Promise<boolean> {
    return this.director.fly(this.focusPov(code), opts)
  }

  flyToOverview(opts: { instant?: boolean } = {}): Promise<boolean> {
    const pov = this.director.pov
    return this.director.fly({ lat: Math.max(-35, Math.min(35, pov.lat)), lng: pov.lng, altitude: OVERVIEW_ALTITUDE }, opts)
  }

  showTarget(code: string | null) {
    if (!code) {
      this.highlights.setTarget(null)
      return
    }
    const c = getCountry(code)
    this.highlights.setTarget(code, { beacon: isMicrostate(c), lat: c.label.lat, lng: c.label.lng })
  }

  setTargetStyle(style: TargetStyle) {
    this.highlights.setTargetStyle(style)
  }

  lockOn(code: string) {
    const c = getCountry(code)
    if (this.animations) this.highlights.pulseAt(c.label.lat, c.label.lng, { durationMs: 800, scale: 0.6 })
  }

  celebrate(code: string, color: number = GLOBE_THEME.correct) {
    const c = getCountry(code)
    if (this.animations) this.highlights.pulseAt(c.label.lat, c.label.lng, { color, durationMs: 1100, scale: 1 })
  }

  setHints(codes: string[]) {
    this.highlights.setHints(codes)
  }

  prepare(code: string) {
    this.highlights.prepare(code)
  }

  setAtlasPaint(paint: AtlasPaint | null) {
    this.atlas.setPaint(paint)
    this.borders.setEmphasis(paint ? 0.75 : 1)
  }

  clearHighlights() {
    this.highlights.clear()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.director.dispose()
    const canvas = this.globe.renderer().domElement
    canvas.removeEventListener('webglcontextlost', this.onLost)
    canvas.removeEventListener('webglcontextrestored', this.onRestored)
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.borders.dispose()
    this.highlights.dispose()
    this.atlas.dispose()
    this.stars.dispose()
  }
}
