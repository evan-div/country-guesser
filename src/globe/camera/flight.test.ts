import { describe, expect, it } from 'vitest'
import { altitudeForFocus, overviewAltitude, longitudeDelta, planFlight, poseAt, MIN_FOCUS_ALTITUDE, MAX_FOCUS_ALTITUDE } from './flight'
import { angularDistance } from '../geo'

describe('camera flight', () => {
  it('crosses the date line the short way (Fiji → Samoa)', () => {
    const plan = planFlight({ lat: -17.8, lng: 178, altitude: 0.8 }, { lat: -13.6, lng: -172.4, altitude: 0.8 })
    expect(plan.angle).toBeLessThan(15)
    expect(Math.abs(longitudeDelta(plan))).toBeLessThan(15)
    // every intermediate pose stays near the date line, never swinging through Africa
    for (let t = 0; t <= 1; t += 0.1) {
      const p = poseAt(plan, t)
      expect(Math.abs(p.lng)).toBeGreaterThan(165)
    }
  })

  it('starts and ends exactly at the endpoints', () => {
    const from = { lat: 10, lng: 20, altitude: 1 }
    const to = { lat: -30, lng: 140, altitude: 0.6 }
    const plan = planFlight(from, to)
    const a = poseAt(plan, 0)
    const b = poseAt(plan, 1)
    expect(angularDistance(a.lat, a.lng, from.lat, from.lng)).toBeLessThan(1e-6)
    expect(angularDistance(b.lat, b.lng, to.lat, to.lng)).toBeLessThan(1e-6)
    expect(b.altitude).toBeCloseTo(0.6, 6)
  })

  it('pulls back on long journeys but not short hops', () => {
    const long = planFlight({ lat: 0, lng: 0, altitude: 0.7 }, { lat: 0, lng: 150, altitude: 0.7 })
    const short = planFlight({ lat: 48, lng: 2, altitude: 0.7 }, { lat: 51, lng: 10, altitude: 0.7 })
    expect(poseAt(long, 0.5).altitude).toBeGreaterThan(2)
    expect(poseAt(short, 0.5).altitude).toBeLessThan(1)
  })

  it('keeps flights brisk', () => {
    const plan = planFlight({ lat: 60, lng: 100, altitude: 3 }, { lat: -40, lng: -70, altitude: 0.42 })
    expect(plan.durationMs).toBeGreaterThanOrEqual(1000)
    expect(plan.durationMs).toBeLessThanOrEqual(2300)
    expect(planFlight(plan.from, plan.to, { instant: true }).durationMs).toBe(0)
  })

  it('frames bigger countries from higher up, within limits', () => {
    const w = 390
    const h = 520
    const tiny = altitudeForFocus(0.05, w, h)
    const mid = altitudeForFocus(7, w, h)
    const huge = altitudeForFocus(60, w, h)
    expect(tiny).toBe(MIN_FOCUS_ALTITUDE)
    expect(mid).toBeGreaterThan(tiny)
    expect(huge).toBe(MAX_FOCUS_ALTITUDE)
    // a narrower (portrait) viewport needs more altitude than a wide one
    expect(altitudeForFocus(7, 390, 800)).toBeGreaterThan(altitudeForFocus(7, 1200, 800))
    // when panels cover part of the screen, the camera pulls back rather than zooming in
    expect(altitudeForFocus(7, 390, 250, 844)).toBeGreaterThan(altitudeForFocus(7, 390, 600, 844))
  })

  it('fits the whole globe in the free area for the overview', () => {
    const tall = overviewAltitude(390, 560, 844)
    const wide = overviewAltitude(1400, 800, 900)
    expect(tall).toBeGreaterThan(wide)
    expect(tall).toBeLessThanOrEqual(5.2)
  })
})
