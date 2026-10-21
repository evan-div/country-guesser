/**
 * Lightweight synthesized sound effects (Web Audio, no asset downloads).
 * The AudioContext is created on the first user gesture, as iOS requires.
 */
type Wave = OscillatorType

class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  enabled = true

  /** Call from a user gesture (pointerdown / keydown). Safe to call repeatedly. */
  unlock() {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      try {
        this.ctx = new Ctor()
        this.master = this.ctx.createGain()
        this.master.gain.value = 0.55
        this.master.connect(this.ctx.destination)
      } catch {
        this.ctx = null
        return
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined)
  }

  private ready(): AudioContext | null {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return null
    return this.ctx
  }

  private tone(freq: number, at: number, dur: number, opts: { type?: Wave; gain?: number; glide?: number } = {}) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = opts.type ?? 'sine'
    osc.frequency.setValueAtTime(freq, at)
    if (opts.glide) osc.frequency.exponentialRampToValueAtTime(opts.glide, at + dur)
    const peak = opts.gain ?? 0.16
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(g).connect(this.master!)
    osc.start(at)
    osc.stop(at + dur + 0.05)
  }

  private noiseBuffer(ctx: AudioContext) {
    if (!this.noise) {
      const len = ctx.sampleRate * 1.5
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      this.noise = buf
    }
    return this.noise
  }

  tap() {
    const ctx = this.ready()
    if (!ctx) return
    this.tone(880, ctx.currentTime, 0.05, { type: 'triangle', gain: 0.05 })
  }

  correct(multiplier = 1) {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    const base = multiplier >= 3 ? 659.25 : multiplier === 2 ? 587.33 : 523.25
    this.tone(base, t, 0.18, { type: 'triangle', gain: 0.14 })
    this.tone(base * 1.26, t + 0.08, 0.2, { type: 'triangle', gain: 0.13 })
    this.tone(base * 1.5, t + 0.16, 0.45, { type: 'sine', gain: 0.14 })
    this.tone(base * 3, t + 0.16, 0.35, { type: 'sine', gain: 0.03 })
  }

  wrong() {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    this.tone(196, t, 0.28, { type: 'triangle', gain: 0.14, glide: 130 })
    this.tone(98, t, 0.32, { type: 'sine', gain: 0.12 })
  }

  hint() {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    this.tone(1046.5, t, 0.12, { type: 'sine', gain: 0.06 })
    this.tone(1318.5, t + 0.06, 0.16, { type: 'sine', gain: 0.05 })
  }

  milestone() {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.07, 0.3, { type: 'triangle', gain: 0.11 }))
  }

  unlockFanfare() {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    ;[392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.09, 0.5, { type: 'sine', gain: 0.1 }))
  }

  gameOver() {
    const ctx = this.ready()
    if (!ctx) return
    const t = ctx.currentTime
    ;[392, 329.63, 261.63].forEach((f, i) => this.tone(f, t + i * 0.16, 0.45, { type: 'triangle', gain: 0.1 }))
  }

  /** Filtered-noise "air rush" for camera flights. */
  whoosh(durationMs: number) {
    const ctx = this.ready()
    if (!ctx || durationMs < 200) return
    const t = ctx.currentTime
    const dur = durationMs / 1000
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(ctx)
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 0.9
    filter.frequency.setValueAtTime(260, t)
    filter.frequency.exponentialRampToValueAtTime(1300, t + dur * 0.45)
    filter.frequency.exponentialRampToValueAtTime(320, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.09, t + dur * 0.4)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter).connect(g).connect(this.master!)
    src.start(t)
    src.stop(t + Math.min(dur, 1.45))
  }
}

export const sound = new SoundEngine()
