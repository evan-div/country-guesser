import { useLayoutEffect, useState, type RefObject } from 'react'

/** Observed height of an element (0 until mounted). */
export function useElementHeight(ref: RefObject<HTMLElement | null>): number {
  const [h, setH] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setH(Math.round(el.getBoundingClientRect().height)))
    ro.observe(el)
    setH(Math.round(el.getBoundingClientRect().height))
    return () => ro.disconnect()
  }, [ref])
  return h
}
