/** Vibration feedback where supported (Android). iOS Safari has no vibration API, so it no-ops. */
let enabled = true

export function setHapticsEnabled(on: boolean) {
  enabled = on
}

export const hapticsSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

function buzz(pattern: number | number[]) {
  if (!enabled || !hapticsSupported) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // ignore — some browsers throw when called without user activation
  }
}

export const haptics = {
  tap: () => buzz(8),
  correct: () => buzz([14, 40, 22]),
  wrong: () => buzz([40, 50, 40]),
  milestone: () => buzz([12, 30, 12, 30, 30]),
}
