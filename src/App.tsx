import { useCallback, useEffect, useState } from 'react'
import { GlobeStage } from './globe/GlobeStage'
import type { GlobeEngine } from './globe/GlobeEngine'
import { loadWorld, type WorldData } from './data/world'
import { useAppViewport } from './ui/hooks/useAppViewport'
import { COUNTRIES } from './data/countries'

// Phase 1 harness: renders the globe and flies through random countries.
export default function App() {
  const vp = useAppViewport()
  const [world, setWorld] = useState<WorldData | null>(null)
  const [engine, setEngine] = useState<GlobeEngine | null>(null)
  const [current, setCurrent] = useState<string>('')

  useEffect(() => {
    loadWorld().then(setWorld)
  }, [])

  const go = useCallback(
    async (code?: string) => {
      if (!engine) return
      const c = code ?? COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)].code
      setCurrent(c)
      engine.prepare(c)
      engine.showTarget(null)
      const ok = await engine.flyToCountry(c)
      if (ok) {
        engine.showTarget(c)
        engine.lockOn(c)
      }
    },
    [engine],
  )

  useEffect(() => {
    if (!engine) return
    const w = window as unknown as { __tour?: (c?: string) => Promise<void>; __engine?: GlobeEngine }
    w.__tour = go
    w.__engine = engine
  }, [engine, go])

  return (
    <div className="fixed inset-x-0 top-0 overflow-hidden" style={{ height: vp.height }}>
      {world && (
        <div className="globe-host absolute inset-0">
          <GlobeStage
            world={world}
            width={vp.width}
            height={vp.height}
            quality="high"
            animations
            labels={[]}
            onReady={setEngine}
          />
        </div>
      )}
      <button className="glass absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full px-6 py-3" onClick={() => go()}>
        Next ({current})
      </button>
    </div>
  )
}
