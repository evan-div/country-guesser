import type { GlobeMethods } from 'react-globe.gl'
import { planFlight, poseAt, type FlightPlan, type Pov } from './flight'

/**
 * Drives cinematic camera flights frame-by-frame. Each flight gets a token; starting a
 * new flight or calling cancel() invalidates older ones, so stale completions can never
 * advance the game.
 */
export class CameraDirector {
  private token = 0
  private raf = 0
  private interactive = true
  flying = false

  constructor(private readonly globe: GlobeMethods) {}

  get pov(): Pov {
    return this.globe.pointOfView()
  }

  /** Whether the player may drag/pinch the globe when no flight is running. */
  setInteractive(on: boolean) {
    this.interactive = on
    if (!this.flying) this.globe.controls().enabled = on
  }

  setAutoRotate(on: boolean, speed = 0.35) {
    const c = this.globe.controls()
    c.autoRotate = on
    c.autoRotateSpeed = speed
  }

  /** Resolves true when the flight completes, false if it was cancelled/superseded. */
  fly(
    to: Pov,
    opts: { instant?: boolean; durationMs?: number; onStart?: (plan: FlightPlan) => void } = {},
  ): Promise<boolean> {
    this.cancel()
    const token = ++this.token
    const plan = planFlight(this.pov, to, { instant: opts.instant, durationMs: opts.durationMs })
    opts.onStart?.(plan)
    const controls = this.globe.controls()
    const damping = controls.enableDamping
    controls.enabled = false
    controls.enableDamping = false
    controls.update() // flush any residual drag inertia
    this.flying = true

    const finish = (done: boolean) => {
      if (token !== this.token) return
      this.flying = false
      controls.enableDamping = damping
      controls.enabled = this.interactive
      cancelAnimationFrame(this.raf)
      this.resolve?.(done)
      this.resolve = null
    }

    return new Promise<boolean>((resolve) => {
      this.resolve = resolve
      if (plan.durationMs === 0) {
        this.globe.pointOfView(to, 0)
        finish(true)
        return
      }
      const start = performance.now()
      const step = (now: number) => {
        if (token !== this.token) return
        const t = Math.min(1, (now - start) / plan.durationMs)
        this.globe.pointOfView(poseAt(plan, t), 0)
        if (t < 1) this.raf = requestAnimationFrame(step)
        else finish(true)
      }
      this.raf = requestAnimationFrame(step)
    })
  }

  private resolve: ((done: boolean) => void) | null = null

  cancel() {
    if (!this.flying) return
    const resolve = this.resolve
    this.resolve = null
    this.token++
    cancelAnimationFrame(this.raf)
    this.flying = false
    const controls = this.globe.controls()
    controls.enableDamping = true
    controls.enabled = this.interactive
    resolve?.(false)
  }

  dispose() {
    this.cancel()
  }
}
