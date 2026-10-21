import { useEffect, useState } from 'react'

export interface AppViewport {
  width: number
  height: number
  /** iOS scrolls the layout viewport when the keyboard opens; we counter-translate by this. */
  offsetTop: number
  keyboardOpen: boolean
}

function read(maxHeight: number): AppViewport {
  const vv = window.visualViewport
  const width = Math.round(vv?.width ?? window.innerWidth)
  const height = Math.round(vv?.height ?? window.innerHeight)
  return {
    width,
    height,
    offsetTop: Math.max(0, Math.round(vv?.offsetTop ?? 0)),
    keyboardOpen: maxHeight - height > 140,
  }
}

/**
 * Tracks the *visual* viewport so the game layout sits above the on-screen keyboard on
 * iOS Safari (which doesn't resize the layout viewport) and Android Chrome alike.
 */
export function useAppViewport(): AppViewport {
  const [vp, setVp] = useState<AppViewport>(() => read(window.innerHeight))

  useEffect(() => {
    let raf = 0
    let maxHeight = window.innerHeight
    let lastWidth = window.innerWidth
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        // Reset the keyboard baseline on rotation / window resize.
        if (window.innerWidth !== lastWidth) {
          lastWidth = window.innerWidth
          maxHeight = window.innerHeight
        }
        maxHeight = Math.max(maxHeight, window.innerHeight, window.visualViewport?.height ?? 0)
        const next = read(maxHeight)
        setVp((prev) =>
          prev.width === next.width &&
          prev.height === next.height &&
          prev.offsetTop === next.offsetTop &&
          prev.keyboardOpen === next.keyboardOpen
            ? prev
            : next,
        )
      })
    }
    const vv = window.visualViewport
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return vp
}
