/** Spherical helpers shared by the globe layers and camera. Matches three-globe's axes. */

export const GLOBE_RADIUS = 100
export const D2R = Math.PI / 180
export const R2D = 180 / Math.PI

export type Vec3 = [number, number, number]

/** Unit vector for a lat/lng, in three-globe's coordinate frame (y up). */
export function toUnit(lat: number, lng: number): Vec3 {
  const phi = (90 - lat) * D2R
  const theta = (90 - lng) * D2R
  const s = Math.sin(phi)
  return [s * Math.cos(theta), Math.cos(phi), s * Math.sin(theta)]
}

export function fromUnit(v: Vec3): { lat: number; lng: number } {
  const [x, y, z] = v
  const r = Math.hypot(x, y, z) || 1
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, y / r))) * R2D
  let lng = 90 - Math.atan2(z, x) * R2D
  if (lng > 180) lng -= 360
  if (lng < -180) lng += 360
  return { lat, lng }
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/** Great-circle angle between two lat/lng points, in degrees. */
export function angularDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.acos(Math.max(-1, Math.min(1, dot(toUnit(lat1, lng1), toUnit(lat2, lng2))))) * R2D
}

/** Spherical linear interpolation between unit vectors (always the short way round). */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const d = Math.max(-1, Math.min(1, dot(a, b)))
  const omega = Math.acos(d)
  if (omega < 1e-6) return [a[0], a[1], a[2]]
  if (Math.PI - omega < 1e-4) {
    // Antipodal: pick a deterministic great circle through the poles.
    const mid: Vec3 = Math.abs(a[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0]
    return t < 0.5 ? slerp(a, mid, t * 2) : slerp(mid, b, (t - 0.5) * 2)
  }
  const s = Math.sin(omega)
  const wa = Math.sin((1 - t) * omega) / s
  const wb = Math.sin(t * omega) / s
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb]
}

/** Cartesian position on (or above) the globe, matching three-globe's getCoords(). */
export function toCartesian(lat: number, lng: number, altitude = 0): Vec3 {
  const r = GLOBE_RADIUS * (1 + altitude)
  const u = toUnit(lat, lng)
  return [u[0] * r, u[1] * r, u[2] * r]
}

/**
 * Converts polylines (arrays of [lng, lat]) into a flat list of line-segment endpoints
 * (x,y,z,x,y,z…) at the given altitude. Long edges are densified so they follow the
 * curvature of the globe, and Natural Earth's artificial cuts along the antimeridian
 * and the South Pole are dropped.
 */
export function polylinesToSegments(lines: number[][][], altitude: number, maxStepDeg = 1): Float32Array {
  const out: number[] = []
  const push = (lng: number, lat: number) => {
    const p = toCartesian(lat, lng, altitude)
    out.push(p[0], p[1], p[2])
  }
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const [lng1, lat1] = line[i - 1]
      const [lng2, lat2] = line[i]
      if (Math.abs(lng1) > 179.9 && Math.abs(lng2) > 179.9) continue // antimeridian cut
      if (lat1 < -89.9 && lat2 < -89.9) continue // polar closure
      if (Math.abs(lng2 - lng1) > 180) continue // wraps the antimeridian
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lng2 - lng1), Math.abs(lat2 - lat1)) / maxStepDeg))
      let pl = lng1
      let pa = lat1
      for (let s = 1; s <= steps; s++) {
        const t = s / steps
        const nl = lng1 + (lng2 - lng1) * t
        const na = lat1 + (lat2 - lat1) * t
        push(pl, pa)
        push(nl, na)
        pl = nl
        pa = na
      }
    }
  }
  return new Float32Array(out)
}

/** Rings of a set of polygons as polylines (outer rings and holes). */
export function polygonOutlines(polygons: number[][][][]): number[][][] {
  return polygons.flatMap((poly) => poly)
}
