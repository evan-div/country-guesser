import { AmbientLight, DirectionalLight, PerspectiveCamera, Vector2, Vector3 } from 'three'
import type { GlobeMethods } from 'react-globe.gl'
import type { WorldData } from '../data/world'
import { framingRadius, getCountry, isMicrostate } from '../data/countries'
import { BorderLayer } from './layers/BorderLayer'
import { HighlightLayer, type TargetStyle } from './layers/HighlightLayer'
import { AtlasLayer, type AtlasPaint } from './layers/AtlasLayer'
import { Starfield } from './layers/Starfield'
import { CameraDirector } from './camera/CameraDirector'
import { altitudeForFocus, overviewAltitude, type FlightPlan, type Pov } from './camera/flight'
import { GLOBE_RADIUS } from './geo'
import { GLOBE_THEME } from './theme'
import type { GlobeController } from './controller'
import { PIXEL_RATIO_CAP, type Quality } from './quality'

export type { Quality }

/**
 * Imperative controller around the single react-globe.gl instance. Owns the custom
 * Three.js layers, lighting, the per-frame animation loop and the camera director.
 * Nothing here is recreated between rounds.
 */
export class GlobeEngine implements GlobeController {
  readonly kind = 'webgl' as const
  readonly director: CameraDirector
  private readonly borders: BorderLayer
  private readonly highlights: HighlightLayer
  private readonly atlas: AtlasLayer
  private readonly stars: Starfield
  private readonly size = new Vector2(1, 1)
  /** Screen area covered by HUD (top) and panels (bottom); the globe centres in what's left. */
  private insets = { top: 0, bottom: 0 }
  private offsetY = 0
  private offsetTarget = 0
  private readonly sun: DirectionalLight | undefined
  private readonly tmp = new Vector3()
  private readonly up = new Vector3(0, 1, 0)
  private raf = 0
  private last = 0
  private animations = true
  private paused = false
  private contextListeners: ((lost: boolean) => void)[] = []
  /** Country the camera is framing; re-framed when the visible area changes. */
  private focusCode: string | null = null
  private userMoved = false
  private reframeTimer = 0
  private framedFor = { w: 0, h: 0 }
  private readonly onUserStart = () => {
    this.userMoved = true
  }
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
    controls.addEventListener('start', this.onUserStart)
    controls.minDistance = GLOBE_RADIUS * 1.12
    controls.maxDistance = GLOBE_RADIUS * 6.4
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
    if (Math.abs(this.offsetTarget - this.offsetY) > 0.3) {
      const k = this.animations ? 1 - Math.exp(-dt / 110) : 1
      this.offsetY += (this.offsetTarget - this.offsetY) * k
      this.applyViewOffset()
    }
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
    this.applyViewOffset()
    this.scheduleReframe()
  }

  /** Reserve screen space at the top/bottom; the globe's centre eases into the free area. */
  setViewInsets(top: number, bottom: number, immediate = false) {
    this.insets = { top, bottom }
    this.offsetTarget = (top - bottom) / 2
    if (immediate || !this.animations) {
      this.offsetY = this.offsetTarget
      this.applyViewOffset()
    }
    this.scheduleReframe()
  }

  /**
   * When the free area changes a lot (keyboard opens, feedback card appears), gently
   * re-frame the current country — unless the player has moved the camera themselves.
   */
  private scheduleReframe() {
    window.clearTimeout(this.reframeTimer)
    this.reframeTimer = window.setTimeout(() => {
      const code = this.focusCode
      if (!code || this.userMoved || this.director.flying) return
      const { w, h } = this.visibleSize()
      const change = Math.abs(h - this.framedFor.h) / Math.max(1, this.framedFor.h)
      if (change < 0.12 && Math.abs(w - this.framedFor.w) < 40) return
      this.framedFor = { w, h }
      void this.director.fly(this.focusPov(code), { durationMs: this.animations ? 420 : 0 })
    }, 160)
  }

  /** Camera stays on this country (or null) for automatic re-framing. */
  setFocus(code: string | null) {
    this.focusCode = code
    this.userMoved = false
    this.framedFor = this.visibleSize()
  }

  private applyViewOffset() {
    const cam = this.globe.camera() as PerspectiveCamera
    const { x: w, y: h } = this.size
    if (Math.abs(this.offsetY) < 0.5) cam.clearViewOffset()
    else cam.setViewOffset(w, h, 0, -this.offsetY, w, h)
  }

  /** Size of the unobstructed globe area, used to frame countries. */
  private visibleSize(): { w: number; h: number } {
    return { w: this.size.x, h: Math.max(160, this.size.y - this.insets.top - this.insets.bottom) }
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
      altitude: altitudeForFocus(framingRadius(c), this.visibleSize().w, this.visibleSize().h, this.size.y),
    }
  }

  flyToCountry(code: string, opts: { instant?: boolean; onStart?: (plan: FlightPlan) => void } = {}): Promise<boolean> {
    this.focusCode = null
    return this.director.fly(this.focusPov(code), opts).then((done) => {
      if (done) this.setFocus(code)
      return done
    })
  }

  /** Pull back to a whole-Earth view, keeping the current longitude. */
  flyToOverview(opts: { instant?: boolean; altitude?: number } = {}): Promise<boolean> {
    this.focusCode = null
    const pov = this.director.pov
    const { w, h } = this.visibleSize()
    const fit = overviewAltitude(w, h, this.size.y)
    return this.director.fly(
      { lat: Math.max(-30, Math.min(35, pov.lat)), lng: pov.lng, altitude: opts.altitude ?? fit },
      opts,
    )
  }

  /** Fly to a lat/lng with a country-appropriate zoom (Atlas "fly to"). */
  flyToPov(pov: Pov, opts: { instant?: boolean } = {}): Promise<boolean> {
    this.focusCode = null
    return this.director.fly(pov, opts)
  }

  setInteractive(on: boolean) {
    this.director.setInteractive(on)
  }

  setAutoRotate(on: boolean) {
    this.director.setAutoRotate(on, 0.32)
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

  screenPoint(lat: number, lng: number): { x: number; y: number } | null {
    const cam = this.globe.camera().position
    const p = this.globe.getCoords(lat, lng, 0)
    // Hidden behind the globe if the point faces away from the camera.
    if (p.x * cam.x + p.y * cam.y + p.z * cam.z <= 0) return null
    return this.globe.getScreenCoords(lat, lng, 0)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    window.clearTimeout(this.reframeTimer)
    this.globe.controls().removeEventListener('start', this.onUserStart)
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
