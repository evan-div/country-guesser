import { Heart } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/** Lives display. The most recently lost heart plays a break animation. */
export function Hearts({ lives, max }: { lives: number; max: number }) {
  const prev = useRef(lives)
  const [breaking, setBreaking] = useState<number | null>(null)
  useEffect(() => {
    if (lives < prev.current) {
      setBreaking(lives)
      const t = window.setTimeout(() => setBreaking(null), 800)
      prev.current = lives
      return () => window.clearTimeout(t)
    }
    prev.current = lives
  }, [lives])

  return (
    <div className="flex items-center gap-1" role="img" aria-label={`${lives} of ${max} lives left`}>
      {Array.from({ length: max }, (_, i) => {
        const alive = i < lives
        return (
          <Heart
            key={i}
            size={18}
            strokeWidth={2.2}
            className={`transition-colors ${
              alive ? 'fill-coral text-coral drop-shadow-[0_0_6px_rgba(255,122,107,0.7)]' : 'fill-transparent text-white/20'
            } ${breaking === i ? 'animate-heart-break' : ''}`}
          />
        )
      })}
    </div>
  )
}
