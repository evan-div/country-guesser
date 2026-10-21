import type { AtlasPaint } from './layers/AtlasLayer'
import type { TargetStyle } from './layers/HighlightLayer'
import type { FlightPlan, Pov } from './camera/flight'

/**
 * What the game needs from a globe. Implemented by the WebGL GlobeEngine and by the
 * Canvas 2D fallback, so every mode works without WebGL.
 */
export interface GlobeController {
  readonly kind: 'webgl' | 'canvas'
  setSize(width: number, height: number): void
  setViewInsets(top: number, bottom: number, immediate?: boolean): void
  setAnimationsEnabled(on: boolean): void
  flyToCountry(code: string, opts?: { instant?: boolean; onStart?: (plan: FlightPlan) => void }): Promise<boolean>
  flyToOverview(opts?: { instant?: boolean; altitude?: number }): Promise<boolean>
  flyToPov(pov: Pov, opts?: { instant?: boolean }): Promise<boolean>
  showTarget(code: string | null): void
  setTargetStyle(style: TargetStyle): void
  setHints(codes: string[]): void
  lockOn(code: string): void
  celebrate(code: string, color?: number): void
  prepare(code: string): void
  clearHighlights(): void
  setFocus(code: string | null): void
  setInteractive(on: boolean): void
  setAutoRotate(on: boolean): void
  setAtlasPaint(paint: AtlasPaint | null): void
  /** Screen position of a lat/lng in CSS px, or null when on the far side (testing aid). */
  screenPoint(lat: number, lng: number): { x: number; y: number } | null
}
