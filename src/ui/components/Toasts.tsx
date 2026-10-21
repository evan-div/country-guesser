import { useEffect } from 'react'

export interface Toast {
  id: number
  icon?: string
  title: string
  body?: string
  tone: 'cyan' | 'gold' | 'mint' | 'coral'
}

const TONES: Record<Toast['tone'], string> = {
  cyan: 'border-glow/40 shadow-[0_0_24px_-6px_rgba(95,227,255,0.55)]',
  gold: 'border-gold/45 shadow-[0_0_24px_-6px_rgba(255,200,87,0.6)]',
  mint: 'border-mint/40 shadow-[0_0_24px_-6px_rgba(125,255,212,0.5)]',
  coral: 'border-coral/40',
}

export function ToastStack({ toasts, onDone }: { toasts: Toast[]; onDone: (id: number) => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+64px)] z-40 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.slice(-3).map((t) => (
        <ToastItem key={t.id} toast={t} onDone={onDone} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(toast.id), 2600)
    return () => window.clearTimeout(timer)
  }, [toast.id, onDone])
  return (
    <div className={`glass-strong flex max-w-sm animate-rise-in items-center gap-3 rounded-2xl border px-4 py-2.5 ${TONES[toast.tone]}`}>
      {toast.icon && <span className="text-xl leading-none">{toast.icon}</span>}
      <div className="min-w-0">
        <div className="font-display text-sm font-semibold text-white">{toast.title}</div>
        {toast.body && <div className="truncate text-xs text-haze">{toast.body}</div>}
      </div>
    </div>
  )
}
