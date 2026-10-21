import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { GlobeStage, type GlobeLabel } from './globe/GlobeStage'
import { detectQuality, type GlobeEngine, type Quality } from './globe/GlobeEngine'
import type { GlobeController } from './globe/controller'
import { CanvasGlobeController, FallbackGlobe } from './globe/FallbackGlobe'
import { hasWebGL } from './globe/webgl'
import { loadWorld, type WorldData } from './data/world'
import { getCountry } from './data/countries'
import { ProgressProvider, useProgress } from './progress/ProgressContext'
import { isUnlocked, type ProgressEvent } from './progress/progress'
import { useGame } from './game/useGame'
import { CHALLENGES } from './game/challenges'
import type { Challenge, PlayStyle } from './game/types'
import { useAppViewport } from './ui/hooks/useAppViewport'
import { useAnimationsEnabled } from './settings/useMotion'
import { sound } from './feedback/sound'
import { setHapticsEnabled } from './feedback/haptics'
import { HomeScreen } from './screens/HomeScreen'
import { GameScreen } from './screens/game/GameScreen'
import { GameOverScreen } from './screens/GameOverScreen'
import { AtlasScreen } from './screens/AtlasScreen'
import { EchoScreen } from './screens/EchoScreen'
import { SettingsSheet } from './screens/SettingsSheet'
import { UnlockModal } from './screens/UnlockModal'
import { ToastStack, type Toast } from './ui/components/Toasts'
import { Button } from './ui/components/Button'

type Screen = 'home' | 'atlas' | 'echo'

export default function App() {
  return (
    <ProgressProvider>
      <AtlasRush />
    </ProgressProvider>
  )
}

function AtlasRush() {
  const vp = useAppViewport()
  const progress = useProgress()
  const { settings } = progress.save
  const animations = useAnimationsEnabled(settings.motion)
  const quality: Quality = useMemo(
    () => (settings.quality === 'auto' ? detectQuality() : settings.quality),
    [settings.quality],
  )

  const [world, setWorld] = useState<WorldData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [webgl, setWebgl] = useState(() => hasWebGL())
  const [engine, setEngine] = useState<GlobeController | null>(null)
  const [globeReady, setGlobeReady] = useState(false)
  const [contextLost, setContextLost] = useState(false)
  const [screen, setScreen] = useState<Screen>('home')
  const [challenge, setChallenge] = useState<Challenge>('country')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [unlocked, setUnlocked] = useState<Challenge | null>(null)
  const [atlasLabels, setAtlasLabels] = useState<GlobeLabel[]>([])
  const toastId = useRef(0)
  const lastStart = useRef<{ style: PlayStyle; challenge: Challenge; pool?: string[] }>({ style: 'arcade', challenge: 'country' })

  // --- World data ------------------------------------------------------------------------
  const load = useCallback(() => {
    setLoadError(null)
    loadWorld()
      .then(setWorld)
      .catch((e: Error) => setLoadError(e.message))
  }, [])
  useEffect(load, [load])

  // --- Settings side effects ------------------------------------------------------------
  useEffect(() => {
    sound.enabled = settings.sound
    setHapticsEnabled(settings.haptics)
  }, [settings.sound, settings.haptics])
  useEffect(() => engine?.setAnimationsEnabled(animations), [engine, animations])

  // iOS only allows audio after a user gesture.
  useEffect(() => {
    const unlock = () => sound.unlock()
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // --- Progress events → toasts / unlock celebration -------------------------------------
  const pushToast = useCallback((t: Omit<Toast, 'id'>) => {
    setToasts((list) => [...list, { ...t, id: ++toastId.current }])
  }, [])
  const dismissToast = useCallback((id: number) => setToasts((l) => l.filter((t) => t.id !== id)), [])
  const onProgressEvents = useCallback(
    (events: ProgressEvent[]) => {
      for (const e of events) {
        if (e.type === 'discovered')
          pushToast({ icon: getCountry(e.code).flag, title: 'New country discovered', body: getCountry(e.code).name, tone: 'cyan' })
        else if (e.type === 'mastered')
          pushToast({ icon: '👑', title: `${getCountry(e.code).name} mastered`, tone: 'gold' })
        else if (e.type === 'graduated')
          pushToast({ icon: '🎓', title: 'Graduated from Echo Rounds', body: getCountry(e.code).name, tone: 'mint' })
        else if (e.type === 'unlocked') setUnlocked(e.challenge)
      }
    },
    [pushToast],
  )

  const game = useGame({ engine, animations, onProgressEvents })
  const phase = game.state.phase
  const inGame = phase !== 'HOME'

  // --- Globe behaviour per screen -------------------------------------------------------
  useEffect(() => {
    if (!engine || inGame) return
    if (screen === 'home') {
      engine.clearHighlights()
      engine.setFocus(null)
      engine.setInteractive(true)
      engine.setAutoRotate(animations)
      void engine.flyToOverview({ instant: !animations })
    } else if (screen === 'echo') {
      engine.setAutoRotate(animations)
    }
  }, [engine, screen, inGame, animations])

  const onInsets = useCallback((top: number, bottom: number) => engine?.setViewInsets(top, bottom), [engine])

  // --- WebGL lifecycle -------------------------------------------------------------------
  const onEngineReady = useCallback((e: GlobeEngine) => {
    setEngine(e)
    setGlobeReady(true)
  }, [])
  useEffect(() => {
    if (!engine || engine.kind !== 'webgl') return
    let timer = 0
    const off = (engine as GlobeEngine).onContextChange((lost) => {
      setContextLost(lost)
      window.clearTimeout(timer)
      // Give the browser a few seconds to restore the context, then fall back to 2D.
      if (lost) timer = window.setTimeout(() => setWebgl(false), 5000)
    })
    return () => {
      off()
      window.clearTimeout(timer)
    }
  }, [engine])

  const fallback = useMemo(() => (world && !webgl ? new CanvasGlobeController(world) : null), [world, webgl])
  useEffect(() => {
    if (!fallback) return
    setContextLost(false)
    setEngine(fallback)
    setGlobeReady(true)
  }, [fallback])

  // --- Actions ---------------------------------------------------------------------------
  const play = useCallback(
    (style: PlayStyle, ch: Challenge, pool?: string[]) => {
      lastStart.current = { style, challenge: ch, pool }
      setScreen('home')
      game.start(style, ch, pool)
    },
    [game],
  )

  const goHome = useCallback(() => {
    game.quit()
    setScreen('home')
  }, [game])

  const labels = inGame ? game.labels : screen === 'atlas' ? atlasLabels : []

  // Unlocks reached in an earlier visit but never celebrated (e.g. the page was reloaded).
  const { save } = progress
  useEffect(() => {
    if (inGame || unlocked) return
    for (const c of ['capital', 'neighbors'] as Challenge[]) {
      if (isUnlocked(save, c) && !save.announcedUnlocks.includes(c)) {
        setUnlocked(c)
        break
      }
    }
  }, [inGame, unlocked, save])

  // --- Dev-only debug hooks (used by the e2e smoke test) ---------------------------------
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as Record<string, unknown>).__atlas = { game, engine, progress, phase }
  }, [game, engine, progress, phase])

  const rootClass = `${animations ? '' : 'no-anim'} ${quality === 'saver' ? 'perf-saver' : ''}`

  return (
    <div
      className={`fixed inset-x-0 top-0 overflow-hidden bg-ink-950 select-none ${rootClass}`}
      style={{ height: vp.height, transform: vp.offsetTop ? `translateY(${vp.offsetTop}px)` : undefined }}
    >
      {/* Globe layer */}
      {world && (
        <div className="globe-host absolute inset-0" aria-hidden={!inGame}>
          {webgl ? (
            <GlobeStage
              world={world}
              width={vp.width}
              height={vp.height}
              quality={quality}
              animations={animations}
              labels={labels}
              onReady={onEngineReady}
            />
          ) : (
            fallback && <FallbackGlobe controller={fallback} width={vp.width} height={vp.height} labels={labels} />
          )}
        </div>
      )}
      {/* Vignette for legibility */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(2,5,13,0.65)_100%)]" />

      {/* Loading / error */}
      {(!world || !globeReady) && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-ink-950 transition-opacity">
          {loadError ? (
            <div className="px-8 text-center">
              <p className="font-display text-lg font-semibold text-white">Couldn't load the map</p>
              <p className="mt-1 text-sm text-haze">{loadError}</p>
              <Button className="mt-5" variant="primary" onClick={load} icon={<RefreshCw size={18} />}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <div className="relative mx-auto h-20 w-20">
                <div className="absolute inset-0 rounded-full border-2 border-glow/15" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-glow" />
                <div className="absolute inset-3 rounded-full bg-gradient-to-br from-[#1f6fae] to-[#041226] shadow-[0_0_30px_rgba(95,227,255,0.35)]" />
              </div>
              <p className="mt-6 font-display text-sm tracking-[0.35em] text-glow uppercase">Atlas Rush</p>
              <p className="mt-1 text-xs text-haze">Charting 195 nations…</p>
            </div>
          )}
        </div>
      )}

      {contextLost && (
        <div className="absolute inset-x-0 top-1/3 z-40 flex justify-center">
          <div className="glass rounded-2xl px-4 py-2 text-sm text-mist">Restoring the globe…</div>
        </div>
      )}

      {world && globeReady && !inGame && screen === 'home' && (
        <HomeScreen
          challenge={challenge}
          onChallenge={setChallenge}
          onPlay={(style) => play(style, challenge)}
          onAtlas={() => setScreen('atlas')}
          onEcho={() => setScreen('echo')}
          onSettings={() => setSettingsOpen(true)}
          onLocked={(c, have) =>
            pushToast({
              icon: '🔒',
              title: `${CHALLENGES[c].title} unlocks at ${CHALLENGES[c].unlockAt} countries`,
              body: `You've identified ${have} unique ${have === 1 ? 'country' : 'countries'} so far.`,
              tone: 'coral',
            })
          }
          onInsets={onInsets}
        />
      )}
      {world && globeReady && !inGame && screen === 'atlas' && (
        <AtlasScreen
          engine={engine}
          animations={animations}
          onBack={() => setScreen('home')}
          onInsets={onInsets}
          onLabels={setAtlasLabels}
        />
      )}
      {world && globeReady && !inGame && screen === 'echo' && (
        <EchoScreen onBack={() => setScreen('home')} onStart={(codes) => play('echo', 'country', codes)} onInsets={onInsets} />
      )}

      {inGame && phase !== 'GAME_OVER' && (
        <GameScreen
          game={game}
          animations={animations}
          keyboardOpen={vp.keyboardOpen}
          onInsets={onInsets}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      {phase === 'GAME_OVER' && game.session && (
        <GameOverScreen
          session={game.session}
          info={game.gameOverInfo}
          animations={animations}
          onPlayAgain={() => play(lastStart.current.style, lastStart.current.challenge, lastStart.current.pool)}
          onHome={goHome}
          onEchoMissed={(codes) => play('echo', 'country', codes)}
        />
      )}

      <ToastStack toasts={toasts} onDone={dismissToast} />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onReset={() => {
          progress.resetProgress()
          setChallenge('country')
          pushToast({ icon: '🧹', title: 'Progress reset', tone: 'coral' })
        }}
      />

      {unlocked && phase !== 'GUESSING' && phase !== 'CAMERA_TRANSITION' && (
        <UnlockModal
          challenge={unlocked}
          canTry={!inGame || phase === 'GAME_OVER'}
          onClose={() => {
            progress.markUnlockAnnounced(unlocked)
            setUnlocked(null)
          }}
          onTry={() => {
            progress.markUnlockAnnounced(unlocked)
            setChallenge(unlocked)
            setUnlocked(null)
            if (phase === 'GAME_OVER') goHome()
          }}
        />
      )}
    </div>
  )
}
