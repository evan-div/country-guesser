import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

/** Modal bottom sheet (centered dialog on wide screens). */
export function Sheet({
  open,
  onClose,
  title,
  children,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  labelledBy?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button aria-label="Close" className="absolute inset-0 animate-fade-in bg-ink-950/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className="glass-strong relative max-h-[88%] w-full max-w-lg animate-sheet-in overflow-y-auto rounded-t-[28px] px-safe pt-5 pb-safe sm:rounded-[28px]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 id={labelledBy} className="font-display text-lg font-semibold tracking-wide text-white">
              {title}
            </h2>
            <button aria-label="Close" onClick={onClose} className="-mr-2 rounded-xl p-2 text-haze hover:text-white">
              <X size={20} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
