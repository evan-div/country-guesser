export type Quality = 'high' | 'balanced' | 'saver'

export const PIXEL_RATIO_CAP: Record<Quality, number> = { high: 2, balanced: 1.5, saver: 1 }

/** Resolve "auto" quality from the device: small/low-memory devices get the lighter profile. */
export function detectQuality(): Quality {
  if (typeof navigator === 'undefined') return 'balanced'
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const cores = navigator.hardwareConcurrency ?? 4
  if ((mem !== undefined && mem <= 2) || cores <= 2) return 'saver'
  if ((mem === undefined || mem >= 6) && cores >= 6) return 'high'
  return 'balanced'
}
