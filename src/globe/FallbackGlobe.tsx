import { useEffect, useRef } from 'react'
import { geoGraticule10, geoInterpolate, geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import type { WorldData } from '../data/world'
import { framingRadius, getCountry, isMicrostate } from '../data/countries'
import type { GlobeController } from './controller'
import type { AtlasPaint } from './layers/AtlasLayer'
import type { TargetStyle } from './layers/HighlightLayer'
import type { FlightPlan, Pov } from './camera/flight'
import type { GlobeLabel } from './GlobeStage'

const hex = (n: number, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`

/**
 * Canvas 2D orthographic globe used when WebGL is unavailable (or a lost WebGL context
 * cannot be restored). Same game API as the 3D engine; simpler visuals.
 */
export class CanvasGlobeController implements GlobeController {
  readonly kind = 'canvas' as const
  center: [number, number] = [10, 20] // [lng, lat]
  zoom = 1
  target: string | null = null
  style: TargetStyle = 'guess'
  hints: string[] = []
  paint: AtlasPaint | null = null
  labels: GlobeLabel[] = []
  autoRotate = false
  interactive = true
  size = { w: 1, h: 1 }
  insets = { top: 0, bottom: 0 }
  private animations = true
  private token = 0
  private listeners = new Set<() => void>()

  constructor(readonly world: WorldData) {}

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  changed() {
    this.listeners.forEach((l) => l())
  }

  setSize(w: number, h: number) {
    this.size = { w, h }
    this.changed()
  }
  setViewInsets(top: number, bottom: number) {
    this.insets = { top, bottom }
    this.changed()
  }
  setAnimationsEnabled(on: boolean) {
    this.animations = on
  }

  private zoomFor(radiusDeg: number) {
    const r = Math.max(1.2, Math.min(80, radiusDeg)) * (Math.PI / 180)
    return Math.max(1, Math.min(30, 0.75 / Math.sin(r)))
  }

  private animateTo(center: [number, number], zoom: number, instant?: boolean, onStart?: (p: FlightPlan) => void) {
    const token = ++this.token
    const from = this.center
    const z0 = this.zoom
    const interp = geoInterpolate(from, center)
    const distance = (interp as unknown as { distance: number }).distance ?? 0
    const duration = instant || !this.animations ? 0 : Math.min(1800, 700 + distance * 500)
    onStart?.({
      from: { lat: from[1], lng: from[0], altitude: 1 },
      to: { lat: center[1], lng: center[0], altitude: 1 },
      angle: distance,
      durationMs: duration,
      lift: 0,
    })
    return new Promise<boolean>((resolve) => {
      if (!duration) {
        this.center = center
        this.zoom = zoom
        this.changed()
        resolve(true)
        return
      }
      const start = performance.now()
      const step = (now: number) => {
        if (token !== this.token) return resolve(false)
        const t = Math.min(1, (now - start) / duration)
        const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
        this.center = interp(e) as [number, number]
        const dip = Math.sin(Math.PI * t) * Math.min(0.6, distance)
        this.zoom = Math.exp(Math.log(z0) + (Math.log(zoom) - Math.log(z0)) * e) / (1 + dip * 1.5)
        this.changed()
        if (t < 1) requestAnimationFrame(step)
        else resolve(true)
      }
      requestAnimationFrame(step)
    })
  }

  flyToCountry(code: string, opts: { instant?: boolean; onStart?: (plan: FlightPlan) => void } = {}) {
    const c = getCountry(code)
    return this.animateTo([c.focus.lng, c.focus.lat], this.zoomFor(framingRadius(c)), opts.instant, opts.onStart)
  }
  flyToOverview(opts: { instant?: boolean } = {}) {
    return this.animateTo([this.center[0], 15], 1, opts.instant)
  }
  flyToPov(pov: Pov, opts: { instant?: boolean } = {}) {
    return this.animateTo([pov.lng, pov.lat], Math.max(1, 2.4 / pov.altitude), opts.instant)
  }
  showTarget(code: string | null) {
    this.target = code
    this.changed()
  }
  setTargetStyle(style: TargetStyle) {
    this.style = style
    this.changed()
  }
  setHints(codes: string[]) {
    this.hints = codes
    this.changed()
  }
  lockOn() {}
  celebrate() {}
  prepare() {}
  clearHighlights() {
    this.target = null
    this.hints = []
    this.changed()
  }
  setFocus() {}
  setInteractive(on: boolean) {
    this.interactive = on
  }
  setAutoRotate(on: boolean) {
    this.autoRotate = on
  }
  setAtlasPaint(paint: AtlasPaint | null) {
    this.paint = paint
    this.changed()
  }
  screenPoint(lat: number, lng: number) {
    const p = this.projection()
    const xy = p([lng, lat])
    const visible = geoInterpolate([lng, lat], this.center)
    return xy && (visible as unknown as { distance: number }).distance < Math.PI / 2 ? { x: xy[0], y: xy[1] } : null
  }

  projection() {
    const { w, h } = this.size
    const visH = Math.max(120, h - this.insets.top - this.insets.bottom)
    const radius = (Math.min(w, visH) / 2) * 0.86 * this.zoom
    return geoOrthographic()
      .rotate([-this.center[0], -this.center[1]])
      .translate([w / 2, this.insets.top + visH / 2])
      .scale(radius)
      .clipAngle(90)
      .precision(0.6)
  }
}

export default function FallbackGlobe({
  controller,
  width,
  height,
  labels,
}: {
  controller: CanvasGlobeController
  width: number
  height: number
  labels: GlobeLabel[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    controller.labels = labels
    controller.changed()
  }, [controller, labels])

  useEffect(() => controller.setSize(width, height), [controller, width, height])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let last = performance.now()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const graticule = geoGraticule10()

    const draw = () => {
      raf = 0
      const { w, h } = controller.size
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr)
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const projection = controller.projection()
      const path = geoPath(projection, ctx)
      const [cx, cy] = projection.translate()
      const r = projection.scale()

      const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.25)
      glow.addColorStop(0, 'rgba(63,191,255,0.35)')
      glow.addColorStop(1, 'rgba(63,191,255,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)
      const ocean = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
      ocean.addColorStop(0, '#12406b')
      ocean.addColorStop(1, '#061a33')
      ctx.beginPath()
      path({ type: 'Sphere' } as GeoPermissibleObjects)
      ctx.fillStyle = ocean
      ctx.fill()

      ctx.beginPath()
      path(graticule)
      ctx.strokeStyle = 'rgba(120,200,255,0.06)'
      ctx.lineWidth = 0.6
      ctx.stroke()

      const shapeFill = (code: string | null, fill: string) => {
        if (!code) return
        const s = controller.world.byCode.get(code)
        if (!s) return
        ctx.beginPath()
        path({ type: 'MultiPolygon', coordinates: s.polygons })
        ctx.fillStyle = fill
        ctx.fill()
      }

      ctx.beginPath()
      for (const s of controller.world.shapes) path({ type: 'MultiPolygon', coordinates: s.polygons })
      ctx.fillStyle = '#2c4a3c'
      ctx.fill()

      if (controller.paint) {
        for (const c of controller.paint.learning) shapeFill(c, 'rgba(56,214,255,0.45)')
        for (const c of controller.paint.mastered) shapeFill(c, 'rgba(255,200,87,0.55)')
      }
      for (const c of controller.hints) shapeFill(c, 'rgba(255,181,71,0.35)')

      ctx.beginPath()
      path({ type: 'MultiLineString', coordinates: controller.world.landBorders })
      ctx.strokeStyle = 'rgba(95,227,255,0.7)'
      ctx.lineWidth = 0.8
      ctx.stroke()
      ctx.beginPath()
      path({ type: 'MultiLineString', coordinates: controller.world.coastlines })
      ctx.strokeStyle = 'rgba(95,200,255,0.35)'
      ctx.lineWidth = 0.6
      ctx.stroke()

      if (controller.target) {
        const color = controller.style === 'correct' ? 0x7dffd4 : controller.style === 'wrong' ? 0xff8a6b : 0x63f3ff
        shapeFill(controller.target, hex(color, 0.35))
        const s = controller.world.byCode.get(controller.target)
        if (s) {
          ctx.beginPath()
          path({ type: 'MultiPolygon', coordinates: s.polygons })
          ctx.strokeStyle = hex(color, 1)
          ctx.lineWidth = 2
          ctx.shadowColor = hex(color, 0.9)
          ctx.shadowBlur = 12
          ctx.stroke()
          ctx.shadowBlur = 0
        }
        const c = getCountry(controller.target)
        if (isMicrostate(c)) {
          const p = projection([c.label.lng, c.label.lat])
          if (p) {
            const pulse = (performance.now() / 1000) % 1
            ctx.beginPath()
            ctx.arc(p[0], p[1], 8 + pulse * 18, 0, Math.PI * 2)
            ctx.strokeStyle = hex(color, 1 - pulse)
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(p[0], p[1], 4, 0, Math.PI * 2)
            ctx.fillStyle = hex(color, 1)
            ctx.fill()
          }
        }
      }

      ctx.font = '600 13px "Space Grotesk Variable", sans-serif'
      ctx.textAlign = 'center'
      for (const l of controller.labels) {
        const pt = controller.screenPoint(l.lat, l.lng)
        if (!pt) continue
        const text = l.text.toUpperCase()
        const tw = ctx.measureText(text).width + 20
        ctx.fillStyle = 'rgba(4,16,32,0.85)'
        ctx.strokeStyle = l.tone === 'wrong' ? 'rgba(255,138,107,0.8)' : l.tone === 'hint' ? 'rgba(255,181,71,0.7)' : 'rgba(95,227,255,0.8)'
        ctx.beginPath()
        ctx.roundRect(pt.x - tw / 2, pt.y - 40, tw, 24, 12)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#eafcff'
        ctx.fillText(text, pt.x, pt.y - 23)
      }
    }

    const request = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    const unsub = controller.subscribe(request)
    // Ambient loop: auto-rotation on the home screen and the microstate beacon pulse.
    let loopRaf = 0
    const loop = (now: number) => {
      const dt = now - last
      last = now
      if (controller.autoRotate) {
        controller.center = [controller.center[0] + dt * 0.006, controller.center[1]]
        request()
      } else if (controller.target && isMicrostate(getCountry(controller.target))) request()
      loopRaf = requestAnimationFrame(loop)
    }
    loopRaf = requestAnimationFrame(loop)
    request()

    // Drag to rotate, wheel / pinch to zoom.
    const pointers = new Map<number, { x: number; y: number }>()
    let pinch = 0
    const onDown = (e: PointerEvent) => {
      if (!controller.interactive) return
      canvas.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev || !controller.interactive) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch) controller.zoom = Math.max(0.8, Math.min(40, controller.zoom * (d / pinch)))
        pinch = d
      } else {
        const k = 90 / controller.projection().scale()
        controller.center = [
          controller.center[0] - (e.clientX - prev.x) * k,
          Math.max(-85, Math.min(85, controller.center[1] + (e.clientY - prev.y) * k)),
        ]
      }
      request()
    }
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      pinch = 0
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      controller.zoom = Math.max(0.8, Math.min(40, controller.zoom * Math.exp(-e.deltaY * 0.0015)))
      request()
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      unsub()
      cancelAnimationFrame(raf)
      cancelAnimationFrame(loopRaf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [controller])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, touchAction: 'none', display: 'block', background: '#02050d' }}
      aria-label="World map"
    />
  )
}
