import { fromUnit, slerp, toUnit, angularDistance, D2R } from '../geo'

/** A camera pose in globe terms: looking at lat/lng from `altitude` globe-radii above the surface. */
export interface Pov {
  lat: number
  lng: number
  altitude: number
}

export interface FlightPlan {
  from: Pov
  to: Pov
  /** Great-circle angle travelled, degrees. */
  angle: number
  durationMs: number
  /** Extra altitude added mid-flight to pull back and reveal the globe. */
  lift: number
}

export const CAMERA_FOV_DEG = 50
export const MIN_FOCUS_ALTITUDE = 0.6
export const MAX_FOCUS_ALTITUDE = 3.2

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Smooth ease-in-out (quintic smootherstep). */
export function smootherstep(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * Camera altitude that frames a region of the given angular radius so it fills `fill`
 * of the unobstructed part of the screen. The camera's vertical FOV spans the full
 * canvas height, so a free area of `visibleHeight` px subtends only
 * atan(tan(fov/2)·visibleHeight/fullHeight). Exact for a perspective camera looking at
 * the globe centre: a point θ away appears at angle α where tan α = sin θ / (d − cos θ).
 */
export function altitudeForFocus(
  radiusDeg: number,
  width: number,
  visibleHeight: number,
  fullHeight = visibleHeight,
  fill = 0.55,
): number {
  const t = Math.tan((CAMERA_FOV_DEG / 2) * D2R)
  const H = Math.max(1, fullHeight)
  const halfV = Math.atan((t * Math.max(1, visibleHeight)) / H)
  const halfH = Math.atan((t * Math.max(1, width)) / H)
  const alpha = Math.min(halfV, halfH) * fill
  const theta = clamp(radiusDeg, 0, 89) * D2R
  const d = Math.cos(theta) + Math.sin(theta) / Math.tan(alpha)
  return clamp(d - 1, MIN_FOCUS_ALTITUDE, MAX_FOCUS_ALTITUDE)
}

/** Altitude at which the whole globe fits the free area (diameter ≈ `fill` of it). */
export function overviewAltitude(width: number, visibleHeight: number, fullHeight: number, fill = 1.06): number {
  const f = Math.max(1, fullHeight) / 2 / Math.tan((CAMERA_FOV_DEG / 2) * D2R)
  const targetRadiusPx = (Math.min(width, visibleHeight) / 2) * fill
  const d = Math.sqrt(1 + (f / Math.max(40, targetRadiusPx)) ** 2)
  return clamp(d - 1, 1.6, 5.2)
}

export function planFlight(from: Pov, to: Pov, opts: { instant?: boolean; durationMs?: number } = {}): FlightPlan {
  const angle = angularDistance(from.lat, from.lng, to.lat, to.lng)
  if (opts.instant) return { from, to, angle, durationMs: 0, lift: 0 }
  if (opts.durationMs !== undefined) return { from, to, angle, durationMs: opts.durationMs, lift: 0 }
  const zoomChange = Math.abs(Math.log((to.altitude + 0.05) / (from.altitude + 0.05)))
  const durationMs = Math.round(clamp(950 + angle * 7.5 + zoomChange * 160, 1000, 2300))
  // Long journeys pull back to reveal the curvature of the Earth; short hops stay close.
  const peakTarget = Math.min(2.6, 0.35 + angle / 55)
  const lift = Math.max(0, peakTarget - Math.max(from.altitude, to.altitude))
  return { from, to, angle, durationMs, lift: Math.min(lift, 1.8) }
}

/** Camera pose at normalized time t ∈ [0, 1]. Direction follows the great circle (date-line safe). */
export function poseAt(plan: FlightPlan, t: number): Pov {
  const e = smootherstep(t)
  const dir = slerp(toUnit(plan.from.lat, plan.from.lng), toUnit(plan.to.lat, plan.to.lng), e)
  const { lat, lng } = fromUnit(dir)
  // Zoom in log space so altitude changes feel perceptually even.
  const la = Math.log(plan.from.altitude)
  const lb = Math.log(plan.to.altitude)
  const base = Math.exp(la + (lb - la) * e)
  const arc = plan.lift * Math.sin(Math.PI * clamp(t, 0, 1)) ** 1.2
  return { lat, lng, altitude: base + arc }
}

/** Degrees of longitude travelled when moving along the plan (signed, short way). */
export function longitudeDelta(plan: FlightPlan): number {
  let d = plan.to.lng - plan.from.lng
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return d
}

