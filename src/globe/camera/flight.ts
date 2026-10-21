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
export const MIN_FOCUS_ALTITUDE = 0.42
export const MAX_FOCUS_ALTITUDE = 3.2
export const OVERVIEW_ALTITUDE = 2.4

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Smooth ease-in-out (quintic smootherstep). */
export function smootherstep(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * Camera altitude that frames a region of the given angular radius so it fills `fill`
 * of the viewport's narrower half-field-of-view. Exact for a perspective camera looking
 * at the globe centre: a point θ away from the sub-camera point appears at angle α where
 * tan α = sin θ / (d − cos θ), d = 1 + altitude.
 */
export function altitudeForFocus(radiusDeg: number, width: number, height: number, fill = 0.62): number {
  const aspect = width > 0 && height > 0 ? width / height : 1
  const halfV = (CAMERA_FOV_DEG / 2) * D2R
  const halfH = Math.atan(Math.tan(halfV) * aspect)
  const alpha = Math.min(halfV, halfH) * fill
  const theta = clamp(radiusDeg, 0, 89) * D2R
  const d = Math.cos(theta) + Math.sin(theta) / Math.tan(alpha)
  return clamp(d - 1, MIN_FOCUS_ALTITUDE, MAX_FOCUS_ALTITUDE)
}

export function planFlight(from: Pov, to: Pov, opts: { instant?: boolean } = {}): FlightPlan {
  const angle = angularDistance(from.lat, from.lng, to.lat, to.lng)
  if (opts.instant) return { from, to, angle, durationMs: 0, lift: 0 }
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

