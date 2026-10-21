import { useEffect, useRef, useState } from 'react'

/** Animates a number toward its target (instantly when animations are off). */
export function useCountUp(target: number, animate: boolean, durationMs = 650): number {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (!animate) {
      from.current = target
      setValue(target)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const e = 1 - (1 - t) ** 3
      setValue(Math.round(a + (target - a) * e))
      if (t < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, animate, durationMs])
  return value
}
