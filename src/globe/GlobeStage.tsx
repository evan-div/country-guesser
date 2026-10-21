import { memo, useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { Color, MeshPhongMaterial, TextureLoader, type WebGLRendererParameters } from 'three'
import type { WorldData } from '../data/world'
import { GlobeEngine, type Quality } from './GlobeEngine'
import { GLOBE_THEME } from './theme'

export type LabelTone = 'target' | 'correct' | 'wrong' | 'hint' | 'info'

export interface GlobeLabel {
  id: string
  lat: number
  lng: number
  text: string
  tone: LabelTone
}

interface GlobeStageProps {
  world: WorldData
  width: number
  height: number
  quality: Quality
  animations: boolean
  labels: GlobeLabel[]
  onReady: (engine: GlobeEngine) => void
}

const BASE = import.meta.env.BASE_URL
const TEXTURES = {
  high: `${BASE}textures/earth-blue-marble-4k.jpg`,
  low: `${BASE}textures/earth-blue-marble-2k.jpg`,
  bump: `${BASE}textures/earth-topology.png`,
  water: `${BASE}textures/earth-water.png`,
}

const RENDERER_CONFIG: WebGLRendererParameters = {
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
}

function makeLabel(d: object): HTMLElement {
  const label = d as GlobeLabel
  const el = document.createElement('div')
  el.className = `globe-label globe-label--${label.tone}`
  const span = document.createElement('span')
  span.textContent = label.text
  el.appendChild(span)
  return el
}

/**
 * The one and only globe. Mounted once at app level and reused for every screen and
 * round; all per-round changes go through the imperative GlobeEngine.
 */
export const GlobeStage = memo(function GlobeStage({
  world,
  width,
  height,
  quality,
  animations,
  labels,
  onReady,
}: GlobeStageProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const engineRef = useRef<GlobeEngine | null>(null)
  const sizeRef = useRef({ width, height })
  sizeRef.current = { width, height }

  const material = useMemo(
    () =>
      new MeshPhongMaterial({
        color: new Color(GLOBE_THEME.globeTint),
        shininess: 24,
        specular: new Color(0x2c4a66),
        bumpScale: 2.5,
      }),
    [],
  )

  // Ocean specular mask — skipped on the battery-saver profile.
  useEffect(() => {
    if (quality === 'saver') {
      material.specularMap = null
      material.needsUpdate = true
      return
    }
    let cancelled = false
    new TextureLoader().load(TEXTURES.water, (tex) => {
      if (cancelled) return tex.dispose()
      material.specularMap = tex
      material.needsUpdate = true
    })
    return () => {
      cancelled = true
    }
  }, [material, quality])

  const handleReady = useCallback(() => {
    const g = globeRef.current
    if (!g || engineRef.current) return
    const engine = new GlobeEngine(g, world)
    engine.setSize(sizeRef.current.width, sizeRef.current.height)
    engineRef.current = engine
    onReady(engine)
    // onReady is intentionally captured once: the engine lives as long as the globe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world])

  useEffect(() => {
    engineRef.current?.setSize(width, height)
  }, [width, height])

  useEffect(() => {
    engineRef.current?.setQuality(quality)
  }, [quality])

  useEffect(() => {
    engineRef.current?.setAnimationsEnabled(animations)
  }, [animations])

  useEffect(
    () => () => {
      engineRef.current?.dispose()
      engineRef.current = null
      material.dispose()
    },
    [material],
  )

  return (
    <Globe
      ref={globeRef as MutableRefObject<GlobeMethods | undefined>}
      width={width}
      height={height}
      backgroundColor={GLOBE_THEME.background}
      globeImageUrl={quality === 'saver' ? TEXTURES.low : TEXTURES.high}
      bumpImageUrl={quality === 'saver' ? null : TEXTURES.bump}
      globeMaterial={material}
      showAtmosphere
      atmosphereColor={GLOBE_THEME.atmosphere}
      atmosphereAltitude={GLOBE_THEME.atmosphereAltitude}
      globeCurvatureResolution={3}
      animateIn={false}
      waitForGlobeReady
      onGlobeReady={handleReady}
      rendererConfig={RENDERER_CONFIG}
      enablePointerInteraction={false}
      htmlElementsData={labels}
      htmlLat="lat"
      htmlLng="lng"
      htmlAltitude={0.012}
      htmlElement={makeLabel}
      htmlTransitionDuration={0}
    />
  )
})
