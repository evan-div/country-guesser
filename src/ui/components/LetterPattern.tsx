import type { PatternWord } from '../../game/types'

/** Renders a hint pattern as letter tiles: revealed letters glow, hidden ones are blanks. */
export function LetterPattern({ pattern }: { pattern: PatternWord[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5" aria-hidden>
      {pattern.map((word, wi) => (
        <div key={wi} className="flex gap-[3px]">
          {word.map((ch, ci) =>
            ch !== null && !/\p{L}/u.test(ch) ? (
              <span key={ci} className="w-2 text-center font-display text-sm text-haze">
                {ch}
              </span>
            ) : (
              <span
                key={ci}
                className={`flex h-[22px] w-[17px] items-end justify-center rounded-[5px] border-b-2 pb-px font-display text-[13px] font-bold ${
                  ch ? 'border-gold bg-gold/15 text-gold' : 'border-white/25 bg-white/[0.04]'
                }`}
              >
                {ch}
              </span>
            ),
          )}
        </div>
      ))}
    </div>
  )
}
