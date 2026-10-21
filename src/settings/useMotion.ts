import { useEffect, useState } from 'react'
import type { MotionPreference } from '../persistence/schema'

/** Whether full animations should run: the user setting, falling back to the OS preference. */
export function useAnimationsEnabled(pref: MotionPreference): boolean {
  const [systemReduced, setSystemReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setSystemReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  if (pref === 'full') return true
  if (pref === 'reduced') return false
  return !systemReduced
}
